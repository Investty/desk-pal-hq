
-- 1. Per-company uniqueness
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_company_user_key UNIQUE (company_id, user_id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_company_email_key UNIQUE (company_id, email);

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_company_user_role_key UNIQUE (company_id, user_id, role);

ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_user_id_date_key;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_company_user_date_key UNIQUE (company_id, user_id, date);

ALTER TABLE public.leave_balances DROP CONSTRAINT IF EXISTS leave_balances_user_id_leave_type_key;
ALTER TABLE public.leave_balances ADD CONSTRAINT leave_balances_company_user_type_key UNIQUE (company_id, user_id, leave_type);

ALTER TABLE public.salary_structures DROP CONSTRAINT IF EXISTS salary_structures_user_id_key;
ALTER TABLE public.salary_structures ADD CONSTRAINT salary_structures_company_user_key UNIQUE (company_id, user_id);

ALTER TABLE public.payslips DROP CONSTRAINT IF EXISTS payslips_user_id_month_year_key;
ALTER TABLE public.payslips ADD CONSTRAINT payslips_company_user_month_year_key UNIQUE (company_id, user_id, month, year);

-- 2. Offboarding columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid,
  ADD COLUMN IF NOT EXISTS removal_reason text,
  ADD COLUMN IF NOT EXISTS last_working_day date;

-- 3. Company plan / status
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS seat_limit integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS trial_ends_at date,
  ADD COLUMN IF NOT EXISTS notes text;

-- 4. Platform owners
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id)
$$;

CREATE POLICY "Owners manage platform admins" ON public.platform_admins
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Users can see own owner row" ON public.platform_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 5. Feature switches per company
CREATE TABLE IF NOT EXISTS public.company_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, feature_key)
);
GRANT SELECT ON public.company_features TO authenticated;
GRANT ALL ON public.company_features TO service_role;
ALTER TABLE public.company_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own company features" ON public.company_features
  FOR SELECT TO authenticated USING (company_id = public.current_company_id() OR public.is_platform_admin());
CREATE POLICY "Owners manage features" ON public.company_features
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE TRIGGER update_company_features_updated_at BEFORE UPDATE ON public.company_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners manage companies" ON public.companies
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- 6. Active company selection
CREATE TABLE IF NOT EXISTS public.user_active_company (
  user_id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_active_company TO authenticated;
GRANT ALL ON public.user_active_company TO service_role;
ALTER TABLE public.user_active_company ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own active company" ON public.user_active_company
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. Company-scoped helpers
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT uac.company_id FROM public.user_active_company uac
      JOIN public.profiles p ON p.user_id = uac.user_id AND p.company_id = uac.company_id
      WHERE uac.user_id = auth.uid() AND p.status = 'active'),
    (SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.status = 'active'
      ORDER BY p.created_at LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND company_id = public.current_company_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_hr(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','hr') AND company_id = public.current_company_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.get_manager_user_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id FROM public.profiles p
  JOIN public.profiles m ON p.manager_id = m.id
  WHERE p.user_id = _user_id AND p.status = 'active'
  ORDER BY p.created_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.apply_attendance_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE ci timestamptz; co timestamptz; hrs numeric; st public.attendance_status;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    SELECT a.check_in, a.check_out INTO ci, co
    FROM public.attendance a WHERE a.user_id = NEW.user_id AND a.date = NEW.date AND a.company_id = NEW.company_id;

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
    ON CONFLICT (company_id, user_id, date) DO UPDATE
      SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
          working_hours = EXCLUDED.working_hours, status = EXCLUDED.status;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_leave_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE d numeric; rem numeric;
BEGIN
  IF NEW.day_portion <> 'full_day' AND NEW.start_date <> NEW.end_date THEN
    RAISE EXCEPTION 'A half-day leave must start and end on the same date';
  END IF;
  d := public.request_days(NEW.start_date, NEW.end_date, NEW.day_portion);
  IF d <= 0 THEN RAISE EXCEPTION 'End date must be on or after start date'; END IF;
  SELECT remaining_days INTO rem FROM public.leave_balances
  WHERE user_id = NEW.user_id AND leave_type = NEW.leave_type AND company_id = NEW.company_id;
  IF rem IS NULL THEN RAISE EXCEPTION 'No leave balance configured for this leave type'; END IF;
  IF rem < d THEN
    RAISE EXCEPTION 'Insufficient leave balance: % day(s) remaining, % day(s) requested', rem, d;
  END IF;
  RETURN NEW;
END;
$function$;

-- 8. Membership listing
CREATE OR REPLACE FUNCTION public.get_my_memberships()
RETURNS TABLE(company_id uuid, company_name text, role app_role, status text, company_status text, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, ur.role, p.status, c.status,
         c.id = public.current_company_id()
  FROM public.profiles p
  JOIN public.companies c ON c.id = p.company_id
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.company_id = p.company_id
  WHERE p.user_id = auth.uid() AND p.status = 'active'
  ORDER BY c.name
$$;

CREATE OR REPLACE FUNCTION public.set_active_company(_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND company_id = _company_id AND status = 'active') THEN
    RAISE EXCEPTION 'You are not an active member of this company';
  END IF;
  INSERT INTO public.user_active_company (user_id, company_id, updated_at)
  VALUES (auth.uid(), _company_id, now())
  ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id, updated_at = now();
END;
$$;

-- 9. Remove / restore employee
CREATE OR REPLACE FUNCTION public.remove_employee(_user_id uuid, _reason text DEFAULT NULL, _last_working_day date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cc uuid; admin_count int;
BEGIN
  cc := public.current_company_id();
  IF NOT public.is_hr(auth.uid()) THEN RAISE EXCEPTION 'Only HR or admin can remove employees'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot remove yourself'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND company_id = cc AND status = 'active') THEN
    RAISE EXCEPTION 'This person is not an active member of your company';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND company_id = cc AND role = 'admin') THEN
    SELECT count(*) INTO admin_count FROM public.user_roles WHERE company_id = cc AND role = 'admin';
    IF admin_count <= 1 THEN RAISE EXCEPTION 'You cannot remove the last admin of the company'; END IF;
  END IF;

  UPDATE public.profiles
    SET status = 'removed', is_active = false, removed_at = now(), removed_by = auth.uid(),
        removal_reason = _reason, last_working_day = COALESCE(_last_working_day, CURRENT_DATE)
    WHERE user_id = _user_id AND company_id = cc;

  UPDATE public.profiles SET manager_id = NULL
    WHERE company_id = cc AND manager_id IN (SELECT id FROM public.profiles WHERE user_id = _user_id AND company_id = cc);
  UPDATE public.profiles SET functional_manager_id = NULL
    WHERE company_id = cc AND functional_manager_id IN (SELECT id FROM public.profiles WHERE user_id = _user_id AND company_id = cc);

  DELETE FROM public.user_roles WHERE user_id = _user_id AND company_id = cc;
  DELETE FROM public.user_active_company WHERE user_id = _user_id AND company_id = cc;

  INSERT INTO public.audit_logs (user_id, company_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), cc, 'employee_removed', 'profile', _user_id, jsonb_build_object('reason', _reason, 'last_working_day', _last_working_day));
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_employee(_user_id uuid, _role app_role DEFAULT 'employee')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cc uuid; seats int; used int;
BEGIN
  cc := public.current_company_id();
  IF NOT public.is_hr(auth.uid()) THEN RAISE EXCEPTION 'Only HR or admin can restore employees'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND company_id = cc AND status = 'removed') THEN
    RAISE EXCEPTION 'No removed record found for this person';
  END IF;
  SELECT seat_limit INTO seats FROM public.companies WHERE id = cc;
  SELECT count(*) INTO used FROM public.profiles WHERE company_id = cc AND status = 'active';
  IF used >= seats THEN RAISE EXCEPTION 'Seat limit reached for your plan'; END IF;

  UPDATE public.profiles SET status = 'active', is_active = true, removed_at = NULL, removed_by = NULL,
    removal_reason = NULL, last_working_day = NULL
    WHERE user_id = _user_id AND company_id = cc;

  INSERT INTO public.user_roles (user_id, company_id, role) VALUES (_user_id, cc, _role)
  ON CONFLICT (company_id, user_id, role) DO NOTHING;

  INSERT INTO public.leave_balances (user_id, company_id, leave_type, total_days, used_days, remaining_days)
  SELECT _user_id, cc, lp.leave_type, lp.default_days, 0, lp.default_days
  FROM public.leave_policies lp
  WHERE lp.company_id = cc AND lp.is_enabled = true
    AND NOT EXISTS (SELECT 1 FROM public.leave_balances lb WHERE lb.user_id = _user_id AND lb.company_id = cc AND lb.leave_type = lp.leave_type);

  INSERT INTO public.audit_logs (user_id, company_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), cc, 'employee_restored', 'profile', _user_id, jsonb_build_object('role', _role));
END;
$$;

-- 10. Join a company with an invite code as an existing user
CREATE OR REPLACE FUNCTION public.redeem_invite(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invite public.company_invites%ROWTYPE; v_email text; v_name text; seats int; used int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  SELECT * INTO v_invite FROM public.company_invites WHERE code = upper(trim(_code)) AND used_at IS NULL;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Invalid or already used invite code'; END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND company_id = v_invite.company_id AND status = 'active') THEN
    RAISE EXCEPTION 'You are already a member of this company';
  END IF;

  SELECT seat_limit INTO seats FROM public.companies WHERE id = v_invite.company_id;
  SELECT count(*) INTO used FROM public.profiles WHERE company_id = v_invite.company_id AND status = 'active';
  IF used >= seats THEN RAISE EXCEPTION 'This company has reached its seat limit'; END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email) INTO v_email, v_name
  FROM auth.users WHERE id = auth.uid();

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND company_id = v_invite.company_id) THEN
    UPDATE public.profiles SET status = 'active', is_active = true, removed_at = NULL, removed_by = NULL,
      removal_reason = NULL, last_working_day = NULL
      WHERE user_id = auth.uid() AND company_id = v_invite.company_id;
  ELSE
    INSERT INTO public.profiles (user_id, company_id, full_name, email)
    VALUES (auth.uid(), v_invite.company_id, v_name, v_email);
  END IF;

  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (auth.uid(), v_invite.company_id, v_invite.role)
  ON CONFLICT (company_id, user_id, role) DO NOTHING;

  INSERT INTO public.leave_balances (user_id, company_id, leave_type, total_days, used_days, remaining_days)
  SELECT auth.uid(), v_invite.company_id, lp.leave_type, lp.default_days, 0, lp.default_days
  FROM public.leave_policies lp
  WHERE lp.company_id = v_invite.company_id AND lp.is_enabled = true
    AND NOT EXISTS (SELECT 1 FROM public.leave_balances lb WHERE lb.user_id = auth.uid() AND lb.company_id = v_invite.company_id AND lb.leave_type = lp.leave_type);

  UPDATE public.company_invites SET used_at = now(), used_by = auth.uid() WHERE id = v_invite.id;

  INSERT INTO public.user_active_company (user_id, company_id, updated_at)
  VALUES (auth.uid(), v_invite.company_id, now())
  ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id, updated_at = now();

  RETURN v_invite.company_id;
END;
$$;

-- 11. Owner functions
CREATE OR REPLACE FUNCTION public.owner_list_companies()
RETURNS TABLE(id uuid, name text, plan text, status text, seat_limit integer, trial_ends_at date, notes text,
              created_at timestamptz, active_people bigint, removed_people bigint, admins bigint,
              features jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.plan, c.status, c.seat_limit, c.trial_ends_at, c.notes, c.created_at,
    (SELECT count(*) FROM public.profiles p WHERE p.company_id = c.id AND p.status = 'active'),
    (SELECT count(*) FROM public.profiles p WHERE p.company_id = c.id AND p.status = 'removed'),
    (SELECT count(*) FROM public.user_roles ur WHERE ur.company_id = c.id AND ur.role = 'admin'),
    COALESCE((SELECT jsonb_object_agg(cf.feature_key, cf.is_enabled) FROM public.company_features cf WHERE cf.company_id = c.id), '{}'::jsonb)
  FROM public.companies c
  WHERE public.is_platform_admin()
  ORDER BY c.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.owner_update_company(
  _company_id uuid, _name text DEFAULT NULL, _plan text DEFAULT NULL, _status text DEFAULT NULL,
  _seat_limit integer DEFAULT NULL, _trial_ends_at date DEFAULT NULL, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.companies SET
    name = COALESCE(NULLIF(trim(_name), ''), name),
    plan = COALESCE(_plan, plan),
    status = COALESCE(_status, status),
    seat_limit = COALESCE(_seat_limit, seat_limit),
    trial_ends_at = COALESCE(_trial_ends_at, trial_ends_at),
    notes = COALESCE(_notes, notes),
    updated_at = now()
  WHERE id = _company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_set_feature(_company_id uuid, _feature_key text, _is_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  INSERT INTO public.company_features (company_id, feature_key, is_enabled)
  VALUES (_company_id, _feature_key, _is_enabled)
  ON CONFLICT (company_id, feature_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.is_platform_admin() THEN jsonb_build_object(
    'companies', (SELECT count(*) FROM public.companies),
    'active_companies', (SELECT count(*) FROM public.companies WHERE status = 'active'),
    'suspended_companies', (SELECT count(*) FROM public.companies WHERE status <> 'active'),
    'people', (SELECT count(*) FROM public.profiles WHERE status = 'active'),
    'removed_people', (SELECT count(*) FROM public.profiles WHERE status = 'removed'),
    'signups', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT to_char(date_trunc('month', created_at), 'Mon YYYY') AS month, count(*) AS companies
        FROM public.companies GROUP BY 1, date_trunc('month', created_at) ORDER BY date_trunc('month', created_at)) x)
  ) ELSE '{}'::jsonb END
$$;

REVOKE EXECUTE ON FUNCTION public.apply_attendance_request() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_leave_balance() FROM anon, authenticated;

-- 12. Seed the first product owner
INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE email = 'varunagoyal98@gmail.com'
ON CONFLICT DO NOTHING;
