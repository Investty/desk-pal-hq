
CREATE OR REPLACE FUNCTION public.notify_leave_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp_name text; mgr uuid; r record; note text; lbl text;
BEGIN
  IF coalesce(current_setting('app.leave_import', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.notify_leave_events() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.check_leave_balance() SET search_path = public;
ALTER FUNCTION public.sync_leave_request_policy() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.check_leave_balance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_leave_request_policy() FROM PUBLIC, anon, authenticated;
