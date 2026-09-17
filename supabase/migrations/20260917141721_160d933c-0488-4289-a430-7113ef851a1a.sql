
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL,
  filename text,
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR views import batches" ON public.import_batches FOR SELECT TO authenticated
USING (company_id = public.current_company_id() AND (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')));

CREATE TABLE public.pending_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL,
  employee_code text,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  designation text,
  department_id uuid REFERENCES public.departments(id),
  joining_date date,
  date_of_birth date,
  manager_email text,
  shift_name text,
  status text NOT NULL DEFAULT 'pending',
  linked_user_id uuid,
  linked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_employees TO authenticated;
GRANT ALL ON public.pending_employees TO service_role;
ALTER TABLE public.pending_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR manages pending employees" ON public.pending_employees FOR ALL TO authenticated
USING (company_id = public.current_company_id() AND (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')))
WITH CHECK (company_id = public.current_company_id() AND (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')));

CREATE TRIGGER update_pending_employees_updated_at BEFORE UPDATE ON public.pending_employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link a newly signed-up user to their imported record
CREATE OR REPLACE FUNCTION public.link_pending_employee(_user_id uuid, _company_id uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.pending_employees%ROWTYPE;
  v_mgr uuid;
  v_shift uuid;
BEGIN
  SELECT * INTO p FROM public.pending_employees
  WHERE company_id = _company_id AND lower(email) = lower(_email) AND status = 'pending' LIMIT 1;
  IF p.id IS NULL THEN RETURN; END IF;

  IF p.manager_email IS NOT NULL THEN
    SELECT id INTO v_mgr FROM public.profiles
    WHERE company_id = _company_id AND lower(email) = lower(p.manager_email) LIMIT 1;
  END IF;

  UPDATE public.profiles SET
    full_name = COALESCE(NULLIF(p.full_name,''), full_name),
    employee_id = COALESCE(NULLIF(p.employee_code,''), employee_id),
    phone = COALESCE(p.phone, phone),
    designation = COALESCE(p.designation, designation),
    department_id = COALESCE(p.department_id, department_id),
    joining_date = COALESCE(p.joining_date, joining_date),
    date_of_birth = COALESCE(p.date_of_birth, date_of_birth),
    manager_id = COALESCE(v_mgr, manager_id)
  WHERE user_id = _user_id AND company_id = _company_id;

  IF p.shift_name IS NOT NULL THEN
    SELECT id INTO v_shift FROM public.shifts
    WHERE company_id = _company_id AND lower(name) = lower(p.shift_name) AND is_active LIMIT 1;
    IF v_shift IS NOT NULL THEN
      INSERT INTO public.employee_shifts (company_id, user_id, shift_id, period_month)
      VALUES (_company_id, _user_id, v_shift, date_trunc('month', current_date)::date)
      ON CONFLICT (company_id, user_id, period_month) DO UPDATE SET shift_id = EXCLUDED.shift_id;
    END IF;
  END IF;

  UPDATE public.pending_employees
  SET status = 'joined', linked_user_id = _user_id, linked_at = now()
  WHERE id = p.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_pending_employee(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- Import employees from a spreadsheet
CREATE OR REPLACE FUNCTION public.import_employees(_rows jsonb, _filename text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_batch uuid;
  r jsonb;
  v_email text; v_name text; v_dept uuid; v_deptname text;
  v_ok int := 0; v_skip int := 0;
  v_errors jsonb := '[]'::jsonb;
  i int := 0;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'No active company'; END IF;
  IF NOT (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only HR or admin can import employees';
  END IF;

  INSERT INTO public.import_batches (company_id, kind, filename, total_rows, created_by)
  VALUES (v_company, 'employees', _filename, jsonb_array_length(_rows), auth.uid())
  RETURNING id INTO v_batch;

  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    i := i + 1;
    v_email := lower(nullif(trim(r->>'email'), ''));
    v_name := nullif(trim(r->>'full_name'), '');
    IF v_email IS NULL OR v_name IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', r->>'email', 'reason', 'Name and email are required');
      CONTINUE;
    END IF;
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Email address is not valid');
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE company_id = v_company AND lower(email) = v_email) THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Already an employee in this company');
      CONTINUE;
    END IF;

    v_dept := NULL;
    v_deptname := nullif(trim(r->>'department'), '');
    IF v_deptname IS NOT NULL THEN
      SELECT id INTO v_dept FROM public.departments
      WHERE company_id = v_company AND lower(name) = lower(v_deptname) LIMIT 1;
      IF v_dept IS NULL THEN
        INSERT INTO public.departments (company_id, name) VALUES (v_company, left(v_deptname, 50))
        RETURNING id INTO v_dept;
      END IF;
    END IF;

    INSERT INTO public.pending_employees (
      company_id, batch_id, employee_code, full_name, email, phone, designation,
      department_id, joining_date, date_of_birth, manager_email, shift_name, created_by)
    VALUES (
      v_company, v_batch, nullif(trim(r->>'employee_code'), ''), v_name, v_email,
      nullif(trim(r->>'phone'), ''), nullif(trim(r->>'designation'), ''), v_dept,
      (nullif(trim(r->>'joining_date'), ''))::date, (nullif(trim(r->>'date_of_birth'), ''))::date,
      lower(nullif(trim(r->>'manager_email'), '')), nullif(trim(r->>'shift_name'), ''), auth.uid())
    ON CONFLICT (company_id, email) DO UPDATE SET
      employee_code = COALESCE(EXCLUDED.employee_code, public.pending_employees.employee_code),
      full_name = EXCLUDED.full_name,
      phone = COALESCE(EXCLUDED.phone, public.pending_employees.phone),
      designation = COALESCE(EXCLUDED.designation, public.pending_employees.designation),
      department_id = COALESCE(EXCLUDED.department_id, public.pending_employees.department_id),
      joining_date = COALESCE(EXCLUDED.joining_date, public.pending_employees.joining_date),
      date_of_birth = COALESCE(EXCLUDED.date_of_birth, public.pending_employees.date_of_birth),
      manager_email = COALESCE(EXCLUDED.manager_email, public.pending_employees.manager_email),
      shift_name = COALESCE(EXCLUDED.shift_name, public.pending_employees.shift_name),
      batch_id = EXCLUDED.batch_id;
    v_ok := v_ok + 1;
  END LOOP;

  UPDATE public.import_batches SET imported_rows = v_ok, skipped_rows = v_skip WHERE id = v_batch;

  INSERT INTO public.audit_logs (company_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_company, auth.uid(), 'import_employees', 'import_batch', v_batch,
          jsonb_build_object('imported', v_ok, 'skipped', v_skip, 'filename', _filename));

  RETURN jsonb_build_object('batch_id', v_batch, 'imported', v_ok, 'skipped', v_skip, 'errors', v_errors);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_employees(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_employees(jsonb, text) TO authenticated;

-- Import shifts from a spreadsheet
CREATE OR REPLACE FUNCTION public.import_shifts(_rows jsonb, _filename text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_batch uuid; r jsonb; v_name text; v_id uuid;
  v_ok int := 0; v_skip int := 0; v_errors jsonb := '[]'::jsonb; i int := 0;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'No active company'; END IF;
  IF NOT (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only HR or admin can import shifts';
  END IF;

  INSERT INTO public.import_batches (company_id, kind, filename, total_rows, created_by)
  VALUES (v_company, 'shifts', _filename, jsonb_array_length(_rows), auth.uid())
  RETURNING id INTO v_batch;

  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    i := i + 1;
    v_name := nullif(trim(r->>'name'), '');
    IF v_name IS NULL OR nullif(trim(r->>'start_time'),'') IS NULL OR nullif(trim(r->>'end_time'),'') IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'name', r->>'name', 'reason', 'Shift name, start time and end time are required');
      CONTINUE;
    END IF;

    SELECT id INTO v_id FROM public.shifts WHERE company_id = v_company AND lower(name) = lower(v_name) LIMIT 1;
    IF v_id IS NULL THEN
      INSERT INTO public.shifts (company_id, name, start_time, end_time, break_minutes, grace_minutes)
      VALUES (v_company, left(v_name, 50), (r->>'start_time')::time, (r->>'end_time')::time,
              COALESCE((nullif(trim(r->>'break_minutes'),''))::int, 60),
              COALESCE((nullif(trim(r->>'grace_minutes'),''))::int, 15));
    ELSE
      UPDATE public.shifts SET
        start_time = (r->>'start_time')::time,
        end_time = (r->>'end_time')::time,
        break_minutes = COALESCE((nullif(trim(r->>'break_minutes'),''))::int, break_minutes),
        grace_minutes = COALESCE((nullif(trim(r->>'grace_minutes'),''))::int, grace_minutes),
        is_active = true
      WHERE id = v_id;
    END IF;
    v_ok := v_ok + 1;
  END LOOP;

  UPDATE public.import_batches SET imported_rows = v_ok, skipped_rows = v_skip WHERE id = v_batch;

  INSERT INTO public.audit_logs (company_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_company, auth.uid(), 'import_shifts', 'import_batch', v_batch,
          jsonb_build_object('imported', v_ok, 'skipped', v_skip, 'filename', _filename));

  RETURN jsonb_build_object('batch_id', v_batch, 'imported', v_ok, 'skipped', v_skip, 'errors', v_errors);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_shifts(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_shifts(jsonb, text) TO authenticated;
