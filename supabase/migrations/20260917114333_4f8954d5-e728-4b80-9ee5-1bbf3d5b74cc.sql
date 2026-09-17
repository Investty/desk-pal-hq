
-- 1. leave_policies becomes the company leave-type table
ALTER TABLE public.leave_policies
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'all';

UPDATE public.leave_policies SET code = leave_type::text WHERE code IS NULL;
ALTER TABLE public.leave_policies ALTER COLUMN code SET NOT NULL;
ALTER TABLE public.leave_policies ALTER COLUMN leave_type DROP NOT NULL;
ALTER TABLE public.leave_policies DROP CONSTRAINT IF EXISTS leave_policies_company_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS leave_policies_company_code_key
  ON public.leave_policies (company_id, lower(code));
ALTER TABLE public.leave_policies DROP CONSTRAINT IF EXISTS leave_policies_applies_to_chk;
ALTER TABLE public.leave_policies ADD CONSTRAINT leave_policies_applies_to_chk
  CHECK (applies_to IN ('all','selected'));

-- 2. per-employee leave configuration
CREATE TABLE IF NOT EXISTS public.employee_leave_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  policy_id uuid NOT NULL REFERENCES public.leave_policies(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  entitlement_override numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, policy_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_leave_settings TO authenticated;
GRANT ALL ON public.employee_leave_settings TO service_role;
ALTER TABLE public.employee_leave_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own leave settings" ON public.employee_leave_settings
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND user_id = auth.uid());

CREATE POLICY "HR manages leave settings" ON public.employee_leave_settings
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));

CREATE TRIGGER employee_leave_settings_updated_at
  BEFORE UPDATE ON public.employee_leave_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. link balances and requests to the company leave type
ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.leave_policies(id) ON DELETE CASCADE;
UPDATE public.leave_balances lb SET policy_id = lp.id
  FROM public.leave_policies lp
  WHERE lp.company_id = lb.company_id AND lp.leave_type = lb.leave_type AND lb.policy_id IS NULL;
ALTER TABLE public.leave_balances ALTER COLUMN leave_type DROP NOT NULL;
ALTER TABLE public.leave_balances DROP CONSTRAINT IF EXISTS leave_balances_company_user_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS leave_balances_company_user_policy_key
  ON public.leave_balances (company_id, user_id, policy_id);

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.leave_policies(id);
UPDATE public.leave_requests lr SET policy_id = lp.id
  FROM public.leave_policies lp
  WHERE lp.company_id = lr.company_id AND lp.leave_type = lr.leave_type AND lr.policy_id IS NULL;
ALTER TABLE public.leave_requests ALTER COLUMN leave_type DROP NOT NULL;

-- 4. helpers
CREATE OR REPLACE FUNCTION public.effective_leave_days(_user_id uuid, _policy_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT els.entitlement_override FROM public.employee_leave_settings els
      WHERE els.user_id = _user_id AND els.policy_id = _policy_id),
    (SELECT lp.default_days FROM public.leave_policies lp WHERE lp.id = _policy_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.applicable_leave_types(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(policy_id uuid, code text, label text, leave_type leave_type,
              default_days numeric, entitlement numeric, carry_forward_enabled boolean,
              carry_forward_max numeric, is_override boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lp.id, lp.code, lp.label, lp.leave_type, lp.default_days,
         COALESCE(els.entitlement_override, lp.default_days),
         lp.carry_forward_enabled, lp.carry_forward_max,
         els.entitlement_override IS NOT NULL
  FROM public.leave_policies lp
  LEFT JOIN public.employee_leave_settings els
    ON els.policy_id = lp.id AND els.user_id = _user_id
  WHERE lp.company_id = (SELECT p.company_id FROM public.profiles p WHERE p.user_id = _user_id LIMIT 1)
    AND lp.is_enabled = true
    AND COALESCE(els.is_enabled, lp.applies_to = 'all')
  ORDER BY lp.label
$$;

-- 5. keep policy_id and the legacy enum in sync on requests, and block non-applicable types
CREATE OR REPLACE FUNCTION public.sync_leave_request_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lp public.leave_policies%ROWTYPE;
BEGIN
  IF NEW.policy_id IS NULL THEN
    SELECT * INTO lp FROM public.leave_policies
      WHERE company_id = NEW.company_id AND leave_type = NEW.leave_type LIMIT 1;
    IF lp.id IS NULL THEN RAISE EXCEPTION 'This leave type is not configured for your company'; END IF;
    NEW.policy_id := lp.id;
  ELSE
    SELECT * INTO lp FROM public.leave_policies WHERE id = NEW.policy_id;
    IF lp.id IS NULL OR lp.company_id <> NEW.company_id THEN
      RAISE EXCEPTION 'This leave type is not available in your company';
    END IF;
  END IF;
  NEW.leave_type := lp.leave_type;

  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.applicable_leave_types(NEW.user_id) a WHERE a.policy_id = NEW.policy_id) THEN
      RAISE EXCEPTION 'This leave type is not available to you';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_leave_request_policy_trg ON public.leave_requests;
CREATE TRIGGER sync_leave_request_policy_trg
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_leave_request_policy();

-- 6. balance checks / updates now work off policy_id
CREATE OR REPLACE FUNCTION public.check_leave_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE d numeric; rem numeric;
BEGIN
  IF NEW.day_portion <> 'full_day' AND NEW.start_date <> NEW.end_date THEN
    RAISE EXCEPTION 'A half-day leave must start and end on the same date';
  END IF;
  d := public.request_days(NEW.start_date, NEW.end_date, NEW.day_portion);
  IF d <= 0 THEN RAISE EXCEPTION 'End date must be on or after start date'; END IF;
  SELECT remaining_days INTO rem FROM public.leave_balances
  WHERE user_id = NEW.user_id AND company_id = NEW.company_id AND policy_id = NEW.policy_id;
  IF rem IS NULL THEN RAISE EXCEPTION 'No leave balance configured for this leave type'; END IF;
  IF rem < d THEN
    RAISE EXCEPTION 'Insufficient leave balance: % day(s) remaining, % day(s) requested', rem, d;
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
    WHERE user_id = NEW.user_id AND policy_id = NEW.policy_id AND company_id = NEW.company_id;
  ELSIF OLD.status = 'approved' AND NEW.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.leave_balances
    SET used_days = GREATEST(used_days - d, 0), remaining_days = LEAST(total_days, remaining_days + d)
    WHERE user_id = NEW.user_id AND policy_id = NEW.policy_id AND company_id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_comp_off_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _delta numeric; _company uuid; _user uuid; _policy uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN _delta := NEW.days; ELSE _delta := -OLD.days; END IF;
  _company := COALESCE(NEW.company_id, OLD.company_id);
  _user := COALESCE(NEW.user_id, OLD.user_id);

  SELECT id INTO _policy FROM public.leave_policies
    WHERE company_id = _company AND lower(code) = 'compensatory' LIMIT 1;
  IF _policy IS NULL THEN
    INSERT INTO public.leave_policies (company_id, leave_type, code, label, default_days, is_enabled)
    VALUES (_company, 'compensatory', 'compensatory', 'Compensatory Off', 0, true)
    RETURNING id INTO _policy;
  END IF;

  INSERT INTO public.leave_balances (user_id, company_id, policy_id, leave_type, total_days, used_days, remaining_days)
  VALUES (_user, _company, _policy, 'compensatory', GREATEST(_delta, 0), 0, GREATEST(_delta, 0))
  ON CONFLICT (company_id, user_id, policy_id) DO UPDATE
    SET total_days = GREATEST(public.leave_balances.total_days + _delta, 0),
        remaining_days = GREATEST(public.leave_balances.remaining_days + _delta, 0),
        updated_at = now();
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 7. HR actions
CREATE OR REPLACE FUNCTION public.hr_sync_policy_balances(_policy_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cc uuid; lp public.leave_policies%ROWTYPE;
BEGIN
  cc := public.current_company_id();
  IF NOT public.is_hr(auth.uid()) THEN RAISE EXCEPTION 'Only HR or admin can configure leave types'; END IF;
  SELECT * INTO lp FROM public.leave_policies WHERE id = _policy_id AND company_id = cc;
  IF lp.id IS NULL THEN RAISE EXCEPTION 'Leave type not found'; END IF;

  INSERT INTO public.leave_balances (user_id, company_id, policy_id, leave_type, total_days, used_days, remaining_days)
  SELECT p.user_id, cc, lp.id, lp.leave_type,
         public.effective_leave_days(p.user_id, lp.id), 0, public.effective_leave_days(p.user_id, lp.id)
  FROM public.profiles p
  LEFT JOIN public.employee_leave_settings els ON els.user_id = p.user_id AND els.policy_id = lp.id
  WHERE p.company_id = cc AND p.status = 'active'
    AND COALESCE(els.is_enabled, lp.applies_to = 'all')
  ON CONFLICT (company_id, user_id, policy_id) DO NOTHING;

  -- people still on the company default follow the new default; overrides are untouched
  UPDATE public.leave_balances lb
  SET total_days = lp.default_days,
      remaining_days = GREATEST(lp.default_days - lb.used_days, 0),
      updated_at = now()
  FROM public.employee_leave_settings els
  WHERE lb.company_id = cc AND lb.policy_id = lp.id
    AND els.user_id = lb.user_id AND els.policy_id = lp.id
    AND els.entitlement_override IS NULL
    AND lp.code <> 'compensatory';

  UPDATE public.leave_balances lb
  SET total_days = lp.default_days,
      remaining_days = GREATEST(lp.default_days - lb.used_days, 0),
      updated_at = now()
  WHERE lb.company_id = cc AND lb.policy_id = lp.id
    AND lp.code <> 'compensatory'
    AND NOT EXISTS (SELECT 1 FROM public.employee_leave_settings els
                    WHERE els.user_id = lb.user_id AND els.policy_id = lp.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_set_employee_leave(
  _user_id uuid, _policy_id uuid, _is_enabled boolean, _entitlement numeric, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cc uuid; lp public.leave_policies%ROWTYPE; old_enabled boolean; old_ent numeric; new_total numeric;
BEGIN
  cc := public.current_company_id();
  IF NOT public.is_hr(auth.uid()) THEN RAISE EXCEPTION 'Only HR or admin can configure employee leave'; END IF;
  SELECT * INTO lp FROM public.leave_policies WHERE id = _policy_id AND company_id = cc;
  IF lp.id IS NULL THEN RAISE EXCEPTION 'Leave type not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND company_id = cc) THEN
    RAISE EXCEPTION 'Employee not found in this company';
  END IF;

  SELECT els.is_enabled, els.entitlement_override INTO old_enabled, old_ent
  FROM public.employee_leave_settings els WHERE els.user_id = _user_id AND els.policy_id = _policy_id;

  INSERT INTO public.employee_leave_settings (company_id, user_id, policy_id, is_enabled, entitlement_override, note)
  VALUES (cc, _user_id, _policy_id, _is_enabled, _entitlement, _note)
  ON CONFLICT (company_id, user_id, policy_id) DO UPDATE
    SET is_enabled = EXCLUDED.is_enabled,
        entitlement_override = EXCLUDED.entitlement_override,
        note = EXCLUDED.note,
        updated_at = now();

  new_total := COALESCE(_entitlement, lp.default_days);

  IF _is_enabled AND lp.is_enabled THEN
    INSERT INTO public.leave_balances (user_id, company_id, policy_id, leave_type, total_days, used_days, remaining_days)
    VALUES (_user_id, cc, _policy_id, lp.leave_type, new_total, 0, new_total)
    ON CONFLICT (company_id, user_id, policy_id) DO UPDATE
      SET total_days = new_total,
          remaining_days = GREATEST(new_total - public.leave_balances.used_days, 0),
          updated_at = now();
  END IF;

  INSERT INTO public.audit_logs (user_id, company_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), cc, 'employee_leave_config_changed', 'leave_balance', _user_id,
    jsonb_build_object(
      'leave_type', lp.label,
      'policy_id', _policy_id,
      'previous', jsonb_build_object('enabled', COALESCE(old_enabled, lp.applies_to = 'all'), 'entitlement', COALESCE(old_ent, lp.default_days)),
      'new', jsonb_build_object('enabled', _is_enabled, 'entitlement', new_total),
      'uses_company_default', _entitlement IS NULL,
      'note', _note));
END;
$$;

-- 8. carry forward honours per-employee entitlement
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
    SET total_days = public.effective_leave_days(lb.user_id, lp.id) + LEAST(GREATEST(lb.remaining_days, 0), lp.carry_forward_max),
        used_days = 0,
        remaining_days = public.effective_leave_days(lb.user_id, lp.id) + LEAST(GREATEST(lb.remaining_days, 0), lp.carry_forward_max),
        updated_at = now()
    FROM public.leave_policies lp
    WHERE lp.company_id = cc AND lb.company_id = cc AND lp.id = lb.policy_id
      AND lp.is_enabled = true AND lp.carry_forward_enabled = true
      AND lp.code <> 'compensatory'
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;

  UPDATE public.leave_balances lb
  SET total_days = public.effective_leave_days(lb.user_id, lp.id), used_days = 0,
      remaining_days = public.effective_leave_days(lb.user_id, lp.id), updated_at = now()
  FROM public.leave_policies lp
  WHERE lp.company_id = cc AND lb.company_id = cc AND lp.id = lb.policy_id
    AND lp.is_enabled = true AND lp.carry_forward_enabled = false
    AND lp.code <> 'compensatory';

  UPDATE public.leave_policies SET last_carry_forward_at = now() WHERE company_id = cc;

  INSERT INTO public.audit_logs (user_id, company_id, action, entity_type, details)
  VALUES (auth.uid(), cc, 'leave_carry_forward', 'leave_balances', jsonb_build_object('carried_balances', n));

  RETURN n;
END;
$$;

-- 9. seeding for new companies / restored employees
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid; v_company_name text; v_code text;
  v_invite public.company_invites%ROWTYPE; v_role public.app_role;
BEGIN
  v_company_name := NULLIF(trim(NEW.raw_user_meta_data->>'company_name'), '');
  v_code := NULLIF(upper(trim(NEW.raw_user_meta_data->>'invite_code')), '');

  IF v_code IS NOT NULL THEN
    SELECT * INTO v_invite FROM public.company_invites WHERE code = v_code AND used_at IS NULL;
    IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Invalid or already used invite code'; END IF;
    v_company := v_invite.company_id;
    v_role := v_invite.role;
    UPDATE public.company_invites SET used_at = now(), used_by = NEW.id WHERE id = v_invite.id;
  ELSIF v_company_name IS NOT NULL THEN
    INSERT INTO public.companies (name) VALUES (v_company_name) RETURNING id INTO v_company;
    v_role := 'admin';
    INSERT INTO public.leave_policies (company_id, leave_type, code, label, default_days, is_enabled) VALUES
      (v_company, 'casual', 'casual', 'Casual Leave', 12, true),
      (v_company, 'sick', 'sick', 'Sick Leave', 8, true),
      (v_company, 'paid', 'paid', 'Paid Leave', 15, true),
      (v_company, 'compensatory', 'compensatory', 'Compensatory Off', 0, false),
      (v_company, 'bereavement', 'bereavement', 'Bereavement Leave', 3, false);
  ELSE
    RAISE EXCEPTION 'Sign-up requires a company name or an invite code';
  END IF;

  INSERT INTO public.profiles (user_id, company_id, full_name, email)
  VALUES (NEW.id, v_company, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  INSERT INTO public.user_roles (user_id, company_id, role) VALUES (NEW.id, v_company, v_role);

  INSERT INTO public.leave_balances (user_id, company_id, policy_id, leave_type, total_days, used_days, remaining_days)
  SELECT NEW.id, v_company, lp.id, lp.leave_type, lp.default_days, 0, lp.default_days
  FROM public.leave_policies lp
  WHERE lp.company_id = v_company AND lp.is_enabled = true AND lp.applies_to = 'all';

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_employee(_user_id uuid, _role app_role DEFAULT 'employee'::app_role)
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

  INSERT INTO public.leave_balances (user_id, company_id, policy_id, leave_type, total_days, used_days, remaining_days)
  SELECT _user_id, cc, lp.id, lp.leave_type,
         public.effective_leave_days(_user_id, lp.id), 0, public.effective_leave_days(_user_id, lp.id)
  FROM public.leave_policies lp
  LEFT JOIN public.employee_leave_settings els ON els.user_id = _user_id AND els.policy_id = lp.id
  WHERE lp.company_id = cc AND lp.is_enabled = true
    AND COALESCE(els.is_enabled, lp.applies_to = 'all')
  ON CONFLICT (company_id, user_id, policy_id) DO NOTHING;

  INSERT INTO public.audit_logs (user_id, company_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), cc, 'employee_restored', 'profile', _user_id, jsonb_build_object('role', _role));
END;
$$;

-- 10. labels come from the company's own leave type
CREATE OR REPLACE FUNCTION public.get_leave_calendar(_from date, _to date)
RETURNS TABLE(kind text, label text, start_date date, end_date date, day_portion day_portion, is_self boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'holiday'::text, h.name, h.date, h.date, NULL::day_portion, false
  FROM public.holidays h
  WHERE h.company_id = public.current_company_id() AND h.date BETWEEN _from AND _to
  UNION ALL
  SELECT 'leave'::text,
         p.full_name || ' · ' || COALESCE(lp.label, lr.leave_type::text, 'Leave'),
         lr.start_date, lr.end_date, lr.day_portion,
         lr.user_id = auth.uid()
  FROM public.leave_requests lr
  JOIN public.profiles p ON p.user_id = lr.user_id AND p.company_id = lr.company_id
  LEFT JOIN public.leave_policies lp ON lp.id = lr.policy_id
  WHERE lr.company_id = public.current_company_id()
    AND lr.status = 'approved'
    AND lr.start_date <= _to AND lr.end_date >= _from
    AND (lr.user_id = auth.uid() OR lr.is_public = true)
$$;

DROP FUNCTION IF EXISTS public.get_people_on_leave_today();
CREATE FUNCTION public.get_people_on_leave_today()
RETURNS TABLE(full_name text, leave_type text, start_date date, end_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.full_name, COALESCE(lp.label, lr.leave_type::text, 'Leave'), lr.start_date, lr.end_date
  FROM public.leave_requests lr
  JOIN public.profiles p ON p.user_id = lr.user_id
  LEFT JOIN public.leave_policies lp ON lp.id = lr.policy_id
  WHERE lr.status = 'approved' AND lr.is_public = true
    AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
    AND lr.company_id = public.current_company_id()
  ORDER BY p.full_name
$$;

CREATE OR REPLACE FUNCTION public.notify_leave_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp_name text; mgr uuid; r record; note text; lbl text;
BEGIN
  SELECT full_name INTO emp_name FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT COALESCE(lp.label, NEW.leave_type::text, 'leave') INTO lbl
  FROM public.leave_policies lp WHERE lp.id = NEW.policy_id;
  lbl := COALESCE(lbl, NEW.leave_type::text, 'leave');

  IF TG_OP = 'INSERT' THEN
    mgr := public.get_manager_user_id(NEW.user_id);
    IF mgr IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (mgr, NEW.company_id, 'New leave request',
        COALESCE(emp_name,'An employee') || ' applied for ' || lbl || ' from ' || NEW.start_date || ' to ' || NEW.end_date || '.', 'leave');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.manager_status = 'approved' AND OLD.manager_status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Manager approved your leave',
      'Your ' || lbl || ' (' || NEW.start_date || ' to ' || NEW.end_date || ') was approved by your reporting manager and sent to HR.', 'leave');
    FOR r IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('hr','admin') AND ur.company_id = NEW.company_id LOOP
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (r.user_id, NEW.company_id, 'Leave awaiting HR approval',
        COALESCE(emp_name,'An employee') || '''s ' || lbl || ' (' || NEW.start_date || ' to ' || NEW.end_date || ') was approved by the reporting manager.', 'leave');
    END LOOP;
  END IF;

  IF NEW.manager_status = 'rejected' AND OLD.manager_status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Leave rejected by manager',
      'Your ' || lbl || ' (' || NEW.start_date || ' to ' || NEW.end_date || ') was rejected.' || COALESCE(' Note: ' || NEW.manager_comment, ''), 'leave');
  END IF;

  IF NEW.hr_status = 'approved' AND OLD.hr_status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Leave approved',
      'Your ' || lbl || ' (' || NEW.start_date || ' to ' || NEW.end_date || ') is fully approved.' || COALESCE(' Note: ' || NEW.hr_comment, ''), 'leave');
  END IF;

  IF NEW.hr_status = 'rejected' AND OLD.hr_status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Leave rejected by HR',
      'Your ' || lbl || ' (' || NEW.start_date || ' to ' || NEW.end_date || ') was rejected.' || COALESCE(' Note: ' || NEW.hr_comment, ''), 'leave');
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND auth.uid() IS DISTINCT FROM NEW.user_id THEN
    note := COALESCE(NEW.hr_comment, NEW.manager_comment);
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Leave cancelled',
      'Your ' || lbl || ' (' || NEW.start_date || ' to ' || NEW.end_date || ') was cancelled and the days returned to your balance.' || COALESCE(' Note: ' || note, ''), 'leave');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_leave_request_policy() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.effective_leave_days(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.applicable_leave_types(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.hr_set_employee_leave(uuid, uuid, boolean, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.hr_sync_policy_balances(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.applicable_leave_types(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_set_employee_leave(uuid, uuid, boolean, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_sync_policy_balances(uuid) TO authenticated;
