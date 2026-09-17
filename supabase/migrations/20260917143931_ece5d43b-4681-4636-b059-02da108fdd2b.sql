
CREATE TABLE IF NOT EXISTS public.pay_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  month int NOT NULL,
  year int NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  processed_at timestamptz,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, month, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pay_periods TO authenticated;
GRANT ALL ON public.pay_periods TO service_role;

ALTER TABLE public.pay_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR manages pay periods" ON public.pay_periods
FOR ALL TO authenticated
USING (company_id = public.current_company_id() AND (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')))
WITH CHECK (company_id = public.current_company_id() AND (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "Employees view pay periods" ON public.pay_periods
FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

CREATE TRIGGER update_pay_periods_updated_at BEFORE UPDATE ON public.pay_periods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.guard_locked_pay_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  v := COALESCE(NEW, OLD);
  IF EXISTS (
    SELECT 1 FROM public.pay_periods pp
    WHERE pp.company_id = v.company_id AND pp.month = v.month AND pp.year = v.year AND pp.status = 'paid'
  ) THEN
    RAISE EXCEPTION 'This pay period is marked paid and locked. Reopen it before changing payslips.';
  END IF;
  RETURN v;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_locked_pay_period() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_locked_pay_period_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.payslips
FOR EACH ROW EXECUTE FUNCTION public.guard_locked_pay_period();

CREATE OR REPLACE FUNCTION public.import_payroll(_rows jsonb, _filename text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_batch uuid;
  r jsonb;
  i int := 0;
  v_ok int := 0; v_skip int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_email text; v_user uuid;
  v_month int; v_year int;
  v_basic numeric; v_da numeric; v_hra numeric; v_sa numeric;
  v_pf numeric; v_pt numeric; v_tds numeric;
  v_gross numeric; v_ded numeric; v_net numeric;
  v_periods jsonb := '[]'::jsonb;
  p jsonb;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'No active company'; END IF;
  IF NOT (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only HR or admin can import payroll';
  END IF;

  INSERT INTO public.import_batches (company_id, kind, filename, total_rows, created_by)
  VALUES (v_company, 'payroll', _filename, jsonb_array_length(_rows), auth.uid())
  RETURNING id INTO v_batch;

  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    i := i + 1;
    v_user := NULL; v_month := NULL; v_year := NULL;
    v_email := lower(nullif(trim(r->>'email'), ''));

    IF v_email IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', r->>'email', 'reason', 'Email is required');
      CONTINUE;
    END IF;

    SELECT user_id INTO v_user FROM public.profiles
    WHERE company_id = v_company AND lower(email) = v_email LIMIT 1;
    IF v_user IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'No employee with this email in the company');
      CONTINUE;
    END IF;

    BEGIN
      v_month := (nullif(trim(r->>'month'), ''))::int;
      v_year := (nullif(trim(r->>'year'), ''))::int;
      v_basic := COALESCE((nullif(trim(r->>'basic'), ''))::numeric, 0);
      v_da := COALESCE((nullif(trim(r->>'da'), ''))::numeric, 0);
      v_hra := COALESCE((nullif(trim(r->>'hra'), ''))::numeric, 0);
      v_sa := COALESCE((nullif(trim(r->>'special_allowance'), ''))::numeric, 0);
      v_pf := COALESCE((nullif(trim(r->>'pf'), ''))::numeric, 0);
      v_pt := COALESCE((nullif(trim(r->>'professional_tax'), ''))::numeric, 0);
      v_tds := COALESCE((nullif(trim(r->>'tds'), ''))::numeric, 0);
      v_gross := (nullif(trim(r->>'gross'), ''))::numeric;
      v_net := (nullif(trim(r->>'net'), ''))::numeric;
      v_ded := (nullif(trim(r->>'deductions'), ''))::numeric;
    EXCEPTION WHEN others THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'One of the amounts or the month/year is not a number');
      CONTINUE;
    END;

    IF v_month IS NULL OR v_month < 1 OR v_month > 12 OR v_year IS NULL OR v_year < 1990 OR v_year > 2999 THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Month must be 1-12 and year must be valid');
      CONTINUE;
    END IF;

    v_gross := COALESCE(v_gross, v_basic + v_da + v_hra + v_sa);
    v_ded := COALESCE(v_ded, v_pf + v_pt + v_tds);
    v_net := COALESCE(v_net, v_gross - v_ded);

    IF v_gross < 0 OR v_ded < 0 THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Amounts cannot be negative');
      CONTINUE;
    END IF;

    BEGIN
      UPDATE public.pay_periods SET status = 'processing'
      WHERE company_id = v_company AND month = v_month AND year = v_year AND status = 'paid';

      INSERT INTO public.payslips (
        company_id, user_id, month, year, basic, da, hra, special_allowance,
        pf, professional_tax, tds, gross, deductions, net, generated_by
      ) VALUES (
        v_company, v_user, v_month, v_year, v_basic, v_da, v_hra, v_sa,
        v_pf, v_pt, v_tds, v_gross, v_ded, v_net, auth.uid()
      )
      ON CONFLICT (user_id, month, year) DO UPDATE SET
        basic = EXCLUDED.basic, da = EXCLUDED.da, hra = EXCLUDED.hra,
        special_allowance = EXCLUDED.special_allowance, pf = EXCLUDED.pf,
        professional_tax = EXCLUDED.professional_tax, tds = EXCLUDED.tds,
        gross = EXCLUDED.gross, deductions = EXCLUDED.deductions, net = EXCLUDED.net,
        updated_at = now();

      v_ok := v_ok + 1;
      IF NOT (v_periods @> jsonb_build_array(jsonb_build_object('m', v_month, 'y', v_year))) THEN
        v_periods := v_periods || jsonb_build_array(jsonb_build_object('m', v_month, 'y', v_year));
      END IF;
    EXCEPTION WHEN others THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', SQLERRM);
    END;
  END LOOP;

  FOR p IN SELECT * FROM jsonb_array_elements(v_periods) LOOP
    INSERT INTO public.pay_periods (company_id, month, year, status, notes, processed_at, paid_at, created_by)
    VALUES (v_company, (p->>'m')::int, (p->>'y')::int, 'paid', 'Imported from ' || COALESCE(_filename, 'a spreadsheet'), now(), now(), auth.uid())
    ON CONFLICT (company_id, month, year) DO UPDATE SET status = 'paid', paid_at = now(), updated_at = now();
  END LOOP;

  UPDATE public.import_batches SET imported_rows = v_ok, skipped_rows = v_skip WHERE id = v_batch;

  INSERT INTO public.audit_logs (company_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_company, auth.uid(), 'import_payroll', 'import_batch', v_batch,
    jsonb_build_object('imported', v_ok, 'skipped', v_skip, 'filename', _filename));

  RETURN jsonb_build_object('batch_id', v_batch, 'imported', v_ok, 'skipped', v_skip, 'errors', v_errors);
END;
$$;

REVOKE ALL ON FUNCTION public.import_payroll(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_payroll(jsonb, text) TO authenticated;
