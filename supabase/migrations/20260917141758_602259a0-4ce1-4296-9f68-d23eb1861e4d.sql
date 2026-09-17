
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

  PERFORM public.link_pending_employee(NEW.id, v_company, NEW.email);

  RETURN NEW;
END;
$$;
