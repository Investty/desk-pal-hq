CREATE OR REPLACE FUNCTION public.notify_leave_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE emp_name text; mgr uuid; r record; note text; lbl text; span text;
BEGIN
  IF coalesce(current_setting('app.leave_import', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO emp_name FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT COALESCE(lp.label, NEW.leave_type::text, 'leave') INTO lbl
  FROM public.leave_policies lp WHERE lp.id = NEW.policy_id;
  lbl := COALESCE(lbl, NEW.leave_type::text, 'leave');
  span := '(' || NEW.start_date || ' to ' || NEW.end_date || ')';
  mgr := public.get_manager_user_id(NEW.user_id);

  IF TG_OP = 'INSERT' THEN
    IF mgr IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (mgr, NEW.company_id, 'New leave request',
        COALESCE(emp_name,'An employee') || ' applied for ' || lbl || ' from ' || NEW.start_date || ' to ' || NEW.end_date || '.', 'leave');
    END IF;
    FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
             WHERE ur.role IN ('hr','admin') AND ur.company_id = NEW.company_id
               AND ur.user_id IS DISTINCT FROM mgr AND ur.user_id IS DISTINCT FROM NEW.user_id LOOP
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (r.user_id, NEW.company_id, 'New leave request',
        COALESCE(emp_name,'An employee') || ' applied for ' || lbl || ' ' || span || '.', 'leave');
    END LOOP;
    RETURN NEW;
  END IF;

  IF NEW.manager_status = 'approved' AND OLD.manager_status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Manager approved your leave',
      'Your ' || lbl || ' ' || span || ' was approved by your reporting manager and sent to HR.', 'leave');
    FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
             WHERE ur.role IN ('hr','admin') AND ur.company_id = NEW.company_id LOOP
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (r.user_id, NEW.company_id, 'Leave awaiting HR approval',
        COALESCE(emp_name,'An employee') || '''s ' || lbl || ' ' || span || ' was approved by the reporting manager.', 'leave');
    END LOOP;
  END IF;

  IF NEW.manager_status = 'rejected' AND OLD.manager_status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Leave rejected by manager',
      'Your ' || lbl || ' ' || span || ' was rejected.' || COALESCE(' Note: ' || NEW.manager_comment, ''), 'leave');
    FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
             WHERE ur.role IN ('hr','admin') AND ur.company_id = NEW.company_id LOOP
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (r.user_id, NEW.company_id, 'Leave rejected by manager',
        COALESCE(emp_name,'An employee') || '''s ' || lbl || ' ' || span || ' was rejected by the reporting manager.', 'leave');
    END LOOP;
  END IF;

  IF NEW.hr_status = 'approved' AND OLD.hr_status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Leave approved',
      'Your ' || lbl || ' ' || span || ' is fully approved.' || COALESCE(' Note: ' || NEW.hr_comment, ''), 'leave');
    IF mgr IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (mgr, NEW.company_id, 'Leave approved by HR',
        COALESCE(emp_name,'An employee') || '''s ' || lbl || ' ' || span || ' is fully approved.', 'leave');
    END IF;
  END IF;

  IF NEW.hr_status = 'rejected' AND OLD.hr_status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (NEW.user_id, NEW.company_id, 'Leave rejected by HR',
      'Your ' || lbl || ' ' || span || ' was rejected.' || COALESCE(' Note: ' || NEW.hr_comment, ''), 'leave');
    IF mgr IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (mgr, NEW.company_id, 'Leave rejected by HR',
        COALESCE(emp_name,'An employee') || '''s ' || lbl || ' ' || span || ' was rejected by HR.', 'leave');
    END IF;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    note := COALESCE(NEW.hr_comment, NEW.manager_comment);
    IF auth.uid() IS DISTINCT FROM NEW.user_id THEN
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (NEW.user_id, NEW.company_id, 'Leave cancelled',
        'Your ' || lbl || ' ' || span || ' was cancelled and the days returned to your balance.' || COALESCE(' Note: ' || note, ''), 'leave');
    END IF;
    IF mgr IS NOT NULL AND mgr IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (mgr, NEW.company_id, 'Leave cancelled',
        COALESCE(emp_name,'An employee') || '''s ' || lbl || ' ' || span || ' was cancelled.', 'leave');
    END IF;
    FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
             WHERE ur.role IN ('hr','admin') AND ur.company_id = NEW.company_id
               AND ur.user_id IS DISTINCT FROM mgr AND ur.user_id IS DISTINCT FROM auth.uid() LOOP
      INSERT INTO public.notifications (user_id, company_id, title, message, type)
      VALUES (r.user_id, NEW.company_id, 'Leave cancelled',
        COALESCE(emp_name,'An employee') || '''s ' || lbl || ' ' || span || ' was cancelled.', 'leave');
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;