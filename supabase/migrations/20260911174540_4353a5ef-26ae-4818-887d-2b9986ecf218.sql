-- 1. Companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add company_id everywhere (nullable first)
ALTER TABLE public.profiles ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.departments ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.holidays ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.announcements ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.attendance ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_flags ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_requests ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.employee_documents ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.leave_balances ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.leave_policies ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.leave_requests ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.onboarding_checklists ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.payslips ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.performance_cycles ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.performance_reviews ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.salary_structures ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. Backfill existing data into one company
DO $$
DECLARE c uuid;
BEGIN
  INSERT INTO public.companies (name) VALUES ('Demo Company') RETURNING id INTO c;
  UPDATE public.profiles SET company_id = c;
  UPDATE public.user_roles SET company_id = c;
  UPDATE public.departments SET company_id = c;
  UPDATE public.holidays SET company_id = c;
  UPDATE public.announcements SET company_id = c;
  UPDATE public.attendance SET company_id = c;
  UPDATE public.attendance_flags SET company_id = c;
  UPDATE public.attendance_requests SET company_id = c;
  UPDATE public.audit_logs SET company_id = c;
  UPDATE public.employee_documents SET company_id = c;
  UPDATE public.leave_balances SET company_id = c;
  UPDATE public.leave_policies SET company_id = c;
  UPDATE public.leave_requests SET company_id = c;
  UPDATE public.notifications SET company_id = c;
  UPDATE public.onboarding_checklists SET company_id = c;
  UPDATE public.payslips SET company_id = c;
  UPDATE public.performance_cycles SET company_id = c;
  UPDATE public.performance_reviews SET company_id = c;
  UPDATE public.salary_structures SET company_id = c;
END $$;

-- 4. Tenant helper
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 5. NOT NULL + defaults
ALTER TABLE public.profiles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.user_roles ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.departments ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.holidays ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.announcements ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.attendance ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.attendance_flags ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.attendance_requests ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.audit_logs ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.employee_documents ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.leave_balances ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.leave_policies ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.leave_requests ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.notifications ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.onboarding_checklists ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.payslips ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.performance_cycles ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.performance_reviews ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();
ALTER TABLE public.salary_structures ALTER COLUMN company_id SET NOT NULL, ALTER COLUMN company_id SET DEFAULT public.current_company_id();

-- 6. Per-company uniqueness
ALTER TABLE public.departments DROP CONSTRAINT departments_name_key;
ALTER TABLE public.departments ADD CONSTRAINT departments_company_name_key UNIQUE (company_id, name);
ALTER TABLE public.holidays DROP CONSTRAINT holidays_date_name_key;
ALTER TABLE public.holidays ADD CONSTRAINT holidays_company_date_name_key UNIQUE (company_id, date, name);
ALTER TABLE public.leave_policies DROP CONSTRAINT leave_policies_leave_type_key;
ALTER TABLE public.leave_policies ADD CONSTRAINT leave_policies_company_type_key UNIQUE (company_id, leave_type);
ALTER TABLE public.profiles DROP CONSTRAINT profiles_employee_id_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_company_employee_id_key UNIQUE (company_id, employee_id);

-- 7. Invites
CREATE TABLE public.company_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT public.current_company_id(),
  code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  email text,
  role public.app_role NOT NULL DEFAULT 'employee',
  created_by uuid,
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invites TO authenticated;
GRANT ALL ON public.company_invites TO service_role;
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

-- 8. Company-scoped helper functions
CREATE OR REPLACE FUNCTION public.is_manager_of(_manager_user_id uuid, _employee_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles e
    JOIN public.profiles m ON e.manager_id = m.id
    WHERE m.user_id = _manager_user_id AND e.user_id = _employee_user_id
      AND e.company_id = m.company_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_celebrations()
RETURNS TABLE(full_name text, date_of_birth date, joining_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.full_name, p.date_of_birth, p.joining_date
  FROM public.profiles p
  WHERE p.is_active = true AND p.company_id = public.current_company_id()
$$;

CREATE OR REPLACE FUNCTION public.get_people_on_leave_today()
RETURNS TABLE(full_name text, leave_type leave_type, start_date date, end_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.full_name, lr.leave_type, lr.start_date, lr.end_date
  FROM public.leave_requests lr
  JOIN public.profiles p ON p.user_id = lr.user_id
  WHERE lr.status = 'approved' AND lr.is_public = true
    AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
    AND lr.company_id = public.current_company_id()
  ORDER BY p.full_name
$$;

CREATE OR REPLACE FUNCTION public.get_yesterday_attendance()
RETURNS TABLE(full_name text, check_in timestamptz, check_out timestamptz, working_hours numeric, status attendance_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.full_name, a.check_in, a.check_out, a.working_hours, a.status
  FROM public.attendance a
  JOIN public.profiles p ON p.user_id = a.user_id
  WHERE a.date = CURRENT_DATE - 1 AND a.company_id = public.current_company_id()
  ORDER BY p.full_name
$$;

CREATE OR REPLACE FUNCTION public.generate_employee_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 5) AS INTEGER)), 0) + 1
  INTO next_num FROM public.profiles WHERE company_id = NEW.company_id;
  NEW.employee_id := 'EMP-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- notifications created by triggers must carry the company
CREATE OR REPLACE FUNCTION public.notify_attendance_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, company_id, title, message, type)
  VALUES (NEW.user_id, NEW.company_id, 'Attendance needs correction',
    'HR flagged your attendance from ' || NEW.start_date || ' to ' || NEW.end_date || '. Reason: ' || NEW.reason || '. Please raise a correction request.',
    'attendance');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_attendance_request_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp_name text; mgr uuid; kind text;
BEGIN
  SELECT full_name INTO emp_name FROM public.profiles WHERE user_id = NEW.user_id;
  kind := CASE WHEN NEW.request_type = 'early_leave' THEN 'early leave' ELSE 'attendance correction' END;

  IF TG_OP = 'INSERT' THEN
    mgr := public.get_manager_user_id(NEW.user_id);
    IF mgr IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (mgr, NEW.company_id, 'New ' || kind || ' request',
        COALESCE(emp_name,'An employee') || ' raised an ' || kind || ' request for ' || NEW.date || '.', 'attendance');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Request approved',
      'Your ' || kind || ' request for ' || NEW.date || ' was approved.' || COALESCE(' Note: ' || NEW.review_comment, ''), 'attendance');
  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Request rejected',
      'Your ' || kind || ' request for ' || NEW.date || ' was rejected.' || COALESCE(' Note: ' || NEW.review_comment, ''), 'attendance');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_leave_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp_name text; mgr uuid; r record; note text;
BEGIN
  SELECT full_name INTO emp_name FROM public.profiles WHERE user_id = NEW.user_id;

  IF TG_OP = 'INSERT' THEN
    mgr := public.get_manager_user_id(NEW.user_id);
    IF mgr IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (mgr, NEW.company_id, 'New leave request',
        COALESCE(emp_name,'An employee') || ' applied for ' || NEW.leave_type || ' leave from ' || NEW.start_date || ' to ' || NEW.end_date || '.', 'leave');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.manager_status = 'approved' AND OLD.manager_status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Manager approved your leave',
      'Your ' || NEW.leave_type || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') was approved by your reporting manager and sent to HR.', 'leave');
    FOR r IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('hr','admin') AND ur.company_id = NEW.company_id LOOP
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (r.user_id, NEW.company_id, 'Leave awaiting HR approval',
        COALESCE(emp_name,'An employee') || '''s ' || NEW.leave_type || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') was approved by the reporting manager.', 'leave');
    END LOOP;
  END IF;

  IF NEW.manager_status = 'rejected' AND OLD.manager_status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Leave rejected by manager',
      'Your ' || NEW.leave_type || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') was rejected.' || COALESCE(' Note: ' || NEW.manager_comment, ''), 'leave');
  END IF;

  IF NEW.hr_status = 'approved' AND OLD.hr_status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Leave approved',
      'Your ' || NEW.leave_type || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') is fully approved.' || COALESCE(' Note: ' || NEW.hr_comment, ''), 'leave');
  END IF;

  IF NEW.hr_status = 'rejected' AND OLD.hr_status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Leave rejected by HR',
      'Your ' || NEW.leave_type || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') was rejected.' || COALESCE(' Note: ' || NEW.hr_comment, ''), 'leave');
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND auth.uid() IS DISTINCT FROM NEW.user_id THEN
    note := COALESCE(NEW.hr_comment, NEW.manager_comment);
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Leave cancelled',
      'Your ' || NEW.leave_type || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') was cancelled and the days returned to your balance.' || COALESCE(' Note: ' || note, ''), 'leave');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_attendance_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ci timestamptz; co timestamptz; hrs numeric; st public.attendance_status;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    SELECT a.check_in, a.check_out INTO ci, co
    FROM public.attendance a WHERE a.user_id = NEW.user_id AND a.date = NEW.date;

    ci := COALESCE(NEW.requested_check_in, ci);
    co := COALESCE(NEW.requested_check_out, co);

    IF ci IS NOT NULL AND co IS NOT NULL THEN
      hrs := ROUND(EXTRACT(EPOCH FROM (co - ci)) / 3600.0, 2);
    ELSE hrs := NULL; END IF;

    st := CASE WHEN ci IS NOT NULL AND EXTRACT(HOUR FROM ci AT TIME ZONE 'UTC') >= 10 THEN 'late'::public.attendance_status
               WHEN ci IS NOT NULL THEN 'present'::public.attendance_status
               ELSE 'absent'::public.attendance_status END;

    INSERT INTO public.attendance (user_id, company_id, date, check_in, check_out, working_hours, status)
    VALUES (NEW.user_id, NEW.company_id, NEW.date, ci, co, hrs, st)
    ON CONFLICT (user_id, date) DO UPDATE
      SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
          working_hours = EXCLUDED.working_hours, status = EXCLUDED.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_leave_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE d numeric;
BEGIN
  d := public.request_days(NEW.start_date, NEW.end_date, NEW.day_portion);
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.leave_balances
    SET used_days = used_days + d, remaining_days = GREATEST(total_days - (used_days + d), 0)
    WHERE user_id = NEW.user_id AND leave_type = NEW.leave_type AND company_id = NEW.company_id;
  ELSIF OLD.status = 'approved' AND NEW.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.leave_balances
    SET used_days = GREATEST(used_days - d, 0), remaining_days = LEAST(total_days, remaining_days + d)
    WHERE user_id = NEW.user_id AND leave_type = NEW.leave_type AND company_id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 9. Sign-up: create a company or join one via invite
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid;
  v_role public.app_role := 'employee';
  v_invite public.company_invites%ROWTYPE;
  v_company_name text;
  v_code text;
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
      (v_company, 'compensatory', 'Compensatory Off', 5, true),
      (v_company, 'bereavement', 'Bereavement Leave', 3, true);
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

-- 10. Rewrite every policy with company scoping
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- companies
CREATE POLICY "Members view their company" ON public.companies FOR SELECT TO authenticated
  USING (id = public.current_company_id());
CREATE POLICY "Admins update their company" ON public.companies FOR UPDATE TO authenticated
  USING (id = public.current_company_id() AND public.is_hr(auth.uid()));

-- company_invites
CREATE POLICY "HR manages invites" ON public.company_invites FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- profiles
CREATE POLICY "View company profiles" ON public.profiles FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id())
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "HR manages company profiles" ON public.profiles FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- user_roles
CREATE POLICY "View own role" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "HR views company roles" ON public.user_roles FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()));
CREATE POLICY "Admins manage company roles" ON public.user_roles FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'admin'));

-- departments / holidays / announcements / leave_policies / performance_cycles
CREATE POLICY "View company departments" ON public.departments FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "HR manages departments" ON public.departments FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

CREATE POLICY "View company holidays" ON public.holidays FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "HR manages holidays" ON public.holidays FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

CREATE POLICY "View company announcements" ON public.announcements FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "HR manages announcements" ON public.announcements FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

CREATE POLICY "View company leave policies" ON public.leave_policies FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "HR manages leave policies" ON public.leave_policies FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

CREATE POLICY "View company cycles" ON public.performance_cycles FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "HR manages cycles" ON public.performance_cycles FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- attendance
CREATE POLICY "View own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Managers view team attendance" ON public.attendance FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_manager_of(auth.uid(), user_id));
CREATE POLICY "HR views company attendance" ON public.attendance FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()));
CREATE POLICY "Insert own attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Update own attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id())
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "HR updates company attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- attendance_flags
CREATE POLICY "View own flags" ON public.attendance_flags FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Managers view team flags" ON public.attendance_flags FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_manager_of(auth.uid(), user_id));
CREATE POLICY "HR manages flags" ON public.attendance_flags FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- attendance_requests
CREATE POLICY "View own attendance requests" ON public.attendance_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Create own attendance requests" ON public.attendance_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Withdraw own pending attendance requests" ON public.attendance_requests FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Managers view team attendance requests" ON public.attendance_requests FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_manager_of(auth.uid(), user_id));
CREATE POLICY "Managers act on team attendance requests" ON public.attendance_requests FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_manager_of(auth.uid(), user_id))
  WITH CHECK (company_id = public.current_company_id() AND public.is_manager_of(auth.uid(), user_id));
CREATE POLICY "HR manages attendance requests" ON public.attendance_requests FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- audit_logs
CREATE POLICY "Insert company audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "HR views company audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- employee_documents
CREATE POLICY "View own documents" ON public.employee_documents FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "HR manages company documents" ON public.employee_documents FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- leave_balances
CREATE POLICY "View own leave balance" ON public.leave_balances FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "HR manages leave balances" ON public.leave_balances FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- leave_requests
CREATE POLICY "View own leave requests" ON public.leave_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Create own leave requests" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Cancel own leave requests" ON public.leave_requests FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id())
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Managers view team leave requests" ON public.leave_requests FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_manager_of(auth.uid(), user_id));
CREATE POLICY "Managers update team leave requests" ON public.leave_requests FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_manager_of(auth.uid(), user_id))
  WITH CHECK (company_id = public.current_company_id() AND public.is_manager_of(auth.uid(), user_id));
CREATE POLICY "HR manages leave requests" ON public.leave_requests FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- notifications
CREATE POLICY "View own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id())
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());

-- onboarding_checklists
CREATE POLICY "View own checklist" ON public.onboarding_checklists FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Mark own tasks done" ON public.onboarding_checklists FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id())
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Managers view team checklists" ON public.onboarding_checklists FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_manager_of(auth.uid(), user_id));
CREATE POLICY "HR manages checklists" ON public.onboarding_checklists FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- payslips
CREATE POLICY "View own payslips" ON public.payslips FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "HR manages payslips" ON public.payslips FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- performance_reviews
CREATE POLICY "View own review" ON public.performance_reviews FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Update own review" ON public.performance_reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id())
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "Managers view team reviews" ON public.performance_reviews FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_manager_of(auth.uid(), user_id));
CREATE POLICY "Managers update team reviews" ON public.performance_reviews FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_manager_of(auth.uid(), user_id))
  WITH CHECK (company_id = public.current_company_id() AND public.is_manager_of(auth.uid(), user_id));
CREATE POLICY "HR manages reviews" ON public.performance_reviews FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- salary_structures
CREATE POLICY "View own salary" ON public.salary_structures FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY "HR manages salaries" ON public.salary_structures FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

-- 11. Indexes
CREATE INDEX ON public.profiles(company_id);
CREATE INDEX ON public.attendance(company_id, date);
CREATE INDEX ON public.leave_requests(company_id, status);
CREATE INDEX ON public.notifications(company_id, user_id);