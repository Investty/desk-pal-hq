
CREATE UNIQUE INDEX IF NOT EXISTS leave_balances_company_user_policy_key
  ON public.leave_balances (company_id, user_id, policy_id);

CREATE OR REPLACE FUNCTION public.hr_sync_policy_balances(_policy_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cc uuid; lp public.leave_policies%ROWTYPE;
BEGIN
  cc := public.current_company_id();
  IF NOT public.is_hr(auth.uid()) THEN RAISE EXCEPTION 'Only HR or admin can configure leave types'; END IF;
  SELECT * INTO lp FROM public.leave_policies WHERE id = _policy_id AND company_id = cc;
  IF lp.id IS NULL THEN RAISE EXCEPTION 'Leave type not found'; END IF;

  IF lp.is_enabled THEN
    INSERT INTO public.leave_balances (user_id, company_id, policy_id, leave_type, total_days, used_days, remaining_days)
    SELECT p.user_id, cc, lp.id, lp.leave_type,
           public.effective_leave_days(p.user_id, lp.id), 0, public.effective_leave_days(p.user_id, lp.id)
    FROM public.profiles p
    LEFT JOIN public.employee_leave_settings els ON els.user_id = p.user_id AND els.policy_id = lp.id
    WHERE p.company_id = cc AND p.status = 'active'
      AND COALESCE(els.is_enabled, lp.applies_to = 'all')
    ON CONFLICT (company_id, user_id, policy_id) DO NOTHING;
  END IF;

  -- people still on the company default follow the new default; overrides are untouched
  UPDATE public.leave_balances lb
  SET total_days = lp.default_days,
      remaining_days = GREATEST(lp.default_days - lb.used_days, 0),
      updated_at = now()
  WHERE lb.company_id = cc AND lb.policy_id = lp.id
    AND lp.code <> 'compensatory'
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_leave_settings els
      WHERE els.user_id = lb.user_id AND els.policy_id = lp.id
        AND els.entitlement_override IS NOT NULL);

  -- people with an override keep their own number, but keep the balance consistent
  UPDATE public.leave_balances lb
  SET total_days = els.entitlement_override,
      remaining_days = GREATEST(els.entitlement_override - lb.used_days, 0),
      updated_at = now()
  FROM public.employee_leave_settings els
  WHERE lb.company_id = cc AND lb.policy_id = lp.id
    AND els.user_id = lb.user_id AND els.policy_id = lp.id
    AND els.entitlement_override IS NOT NULL
    AND lp.code <> 'compensatory';

  -- drop untouched balances for people the type no longer applies to (or when switched off)
  DELETE FROM public.leave_balances lb
  WHERE lb.company_id = cc AND lb.policy_id = lp.id AND lb.used_days = 0
    AND (
      NOT lp.is_enabled
      OR NOT COALESCE(
        (SELECT els.is_enabled FROM public.employee_leave_settings els
          WHERE els.user_id = lb.user_id AND els.policy_id = lp.id),
        lp.applies_to = 'all')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT NEW.id, v_company, lp.id, lp.leave_type,
         COALESCE(els.entitlement_override, lp.default_days), 0,
         COALESCE(els.entitlement_override, lp.default_days)
  FROM public.leave_policies lp
  LEFT JOIN public.employee_leave_settings els ON els.policy_id = lp.id AND els.user_id = NEW.id
  WHERE lp.company_id = v_company AND lp.is_enabled = true
    AND COALESCE(els.is_enabled, lp.applies_to = 'all')
  ON CONFLICT (company_id, user_id, policy_id) DO NOTHING;

  PERFORM public.link_pending_employee(NEW.id, v_company, NEW.email);

  RETURN NEW;
END;
$$;
