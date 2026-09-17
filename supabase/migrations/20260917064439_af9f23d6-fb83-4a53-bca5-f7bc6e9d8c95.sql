ALTER TABLE public.leave_policies
  ADD COLUMN IF NOT EXISTS carry_forward_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS carry_forward_max numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_carry_forward_at timestamptz;

CREATE OR REPLACE FUNCTION public.prevent_all_leave_types_disabled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.is_enabled = true AND NEW.is_enabled = false THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.leave_policies
      WHERE company_id = NEW.company_id AND id <> NEW.id AND is_enabled = true
    ) THEN
      RAISE EXCEPTION 'At least one leave type must remain enabled';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_all_leave_types_disabled ON public.leave_policies;
CREATE TRIGGER trg_prevent_all_leave_types_disabled
BEFORE UPDATE ON public.leave_policies
FOR EACH ROW EXECUTE FUNCTION public.prevent_all_leave_types_disabled();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid;
  v_company_name text;
  v_code text;
  v_invite public.company_invites%ROWTYPE;
  v_role public.app_role;
BEGIN
  v_company_name := NULLIF(trim(NEW.raw_user_meta_data->>'company_name'), '');
  v_code := NULLIF(upper(trim(NEW.raw_user_meta_data->>'invite_code')), '');

  IF v_code IS NOT NULL THEN
    SELECT * INTO v_invite FROM public.company_invites WHERE code = v_code AND used_at IS NULL;
    IF v_invite.id IS NULL THEN
      RAISE EXCEPTION 'Invalid or already used invite code';
    END IF;
    v_company := v_invite.company_id;
    v_role := v_invite.role;
    UPDATE public.company_invites SET used_at = now(), used_by = NEW.id WHERE id = v_invite.id;
  ELSIF v_company_name IS NOT NULL THEN
    INSERT INTO public.companies (name) VALUES (v_company_name) RETURNING id INTO v_company;
    v_role := 'admin';
    INSERT INTO public.leave_policies (company_id, leave_type, label, default_days, is_enabled) VALUES
      (v_company, 'casual', 'Casual Leave', 12, true),
      (v_company, 'sick', 'Sick Leave', 8, true),
      (v_company, 'paid', 'Paid Leave', 15, true),
      (v_company, 'compensatory', 'Compensatory Off', 0, false),
      (v_company, 'bereavement', 'Bereavement Leave', 3, false);
  ELSE
    RAISE EXCEPTION 'Sign-up requires a company name or an invite code';
  END IF;

  INSERT INTO public.profiles (user_id, company_id, full_name, email)
  VALUES (NEW.id, v_company, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  INSERT INTO public.user_roles (user_id, company_id, role) VALUES (NEW.id, v_company, v_role);

  INSERT INTO public.leave_balances (user_id, company_id, leave_type, total_days, used_days, remaining_days)
  SELECT NEW.id, v_company, lp.leave_type, lp.default_days, 0, lp.default_days
  FROM public.leave_policies lp WHERE lp.company_id = v_company AND lp.is_enabled = true;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_leave_carry_forward()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cc uuid; n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  cc := public.current_company_id();
  IF cc IS NULL THEN RAISE EXCEPTION 'No active company'; END IF;
  IF NOT public.is_hr(auth.uid()) THEN RAISE EXCEPTION 'Only HR or admin can run year-end carry forward'; END IF;

  WITH upd AS (
    UPDATE public.leave_balances lb
    SET total_days = lp.default_days + LEAST(GREATEST(lb.remaining_days, 0), lp.carry_forward_max),
        used_days = 0,
        remaining_days = lp.default_days + LEAST(GREATEST(lb.remaining_days, 0), lp.carry_forward_max),
        updated_at = now()
    FROM public.leave_policies lp
    WHERE lp.company_id = cc AND lb.company_id = cc AND lp.leave_type = lb.leave_type
      AND lp.is_enabled = true AND lp.carry_forward_enabled = true
      AND lp.leave_type <> 'compensatory'
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;

  UPDATE public.leave_balances lb
  SET total_days = lp.default_days, used_days = 0, remaining_days = lp.default_days, updated_at = now()
  FROM public.leave_policies lp
  WHERE lp.company_id = cc AND lb.company_id = cc AND lp.leave_type = lb.leave_type
    AND lp.is_enabled = true AND lp.carry_forward_enabled = false
    AND lp.leave_type <> 'compensatory';

  UPDATE public.leave_policies SET last_carry_forward_at = now() WHERE company_id = cc;

  INSERT INTO public.audit_logs (user_id, company_id, action, entity_type, details)
  VALUES (auth.uid(), cc, 'leave_carry_forward', 'leave_balances', jsonb_build_object('carried_balances', n));

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.run_leave_carry_forward() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_leave_carry_forward() TO authenticated;
REVOKE ALL ON FUNCTION public.prevent_all_leave_types_disabled() FROM PUBLIC, anon, authenticated;