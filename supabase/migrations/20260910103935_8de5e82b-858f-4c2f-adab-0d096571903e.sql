CREATE OR REPLACE FUNCTION public.notify_leave_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  emp_name text;
  mgr uuid;
  r record;
  note text;
BEGIN
  SELECT full_name INTO emp_name FROM public.profiles WHERE user_id = NEW.user_id;

  IF TG_OP = 'INSERT' THEN
    mgr := public.get_manager_user_id(NEW.user_id);
    IF mgr IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (mgr, 'New leave request',
        COALESCE(emp_name,'An employee') || ' applied for ' || NEW.leave_type || ' leave from ' || NEW.start_date || ' to ' || NEW.end_date || '.',
        'leave');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.manager_status = 'approved' AND OLD.manager_status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Manager approved your leave',
      'Your ' || NEW.leave_type || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') was approved by your reporting manager and sent to HR.', 'leave');
    FOR r IN SELECT user_id FROM public.user_roles WHERE role IN ('hr','admin') LOOP
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (r.user_id, 'Leave awaiting HR approval',
        COALESCE(emp_name,'An employee') || '''s ' || NEW.leave_type || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') was approved by the reporting manager.', 'leave');
    END LOOP;
  END IF;

  IF NEW.manager_status = 'rejected' AND OLD.manager_status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Leave rejected by manager',
      'Your ' || NEW.leave_type || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') was rejected.' || COALESCE(' Note: ' || NEW.manager_comment, ''), 'leave');
  END IF;

  IF NEW.hr_status = 'approved' AND OLD.hr_status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Leave approved',
      'Your ' || NEW.leave_type || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') is fully approved.' || COALESCE(' Note: ' || NEW.hr_comment, ''), 'leave');
  END IF;

  IF NEW.hr_status = 'rejected' AND OLD.hr_status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Leave rejected by HR',
      'Your ' || NEW.leave_type || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') was rejected.' || COALESCE(' Note: ' || NEW.hr_comment, ''), 'leave');
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND auth.uid() IS DISTINCT FROM NEW.user_id THEN
    note := COALESCE(NEW.hr_comment, NEW.manager_comment);
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Leave cancelled',
      'Your ' || NEW.leave_type || ' leave (' || NEW.start_date || ' to ' || NEW.end_date || ') was cancelled and the days returned to your balance.' || COALESCE(' Note: ' || note, ''), 'leave');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_leave_insert ON public.leave_requests;
CREATE TRIGGER notify_leave_insert AFTER INSERT ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_leave_events();

DROP TRIGGER IF EXISTS notify_leave_update ON public.leave_requests;
CREATE TRIGGER notify_leave_update AFTER UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_leave_events();