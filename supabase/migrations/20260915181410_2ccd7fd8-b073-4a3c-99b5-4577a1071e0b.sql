
-- mark trusted server-side attendance writes
CREATE OR REPLACE FUNCTION public.guard_attendance_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('app.attendance_write', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')
     OR public.is_manager_of(auth.uid(), NEW.user_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id = auth.uid() THEN
    IF NEW.check_in IS DISTINCT FROM OLD.check_in
       OR NEW.check_out IS DISTINCT FROM OLD.check_out
       OR NEW.working_hours IS DISTINCT FROM OLD.working_hours
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.date IS DISTINCT FROM OLD.date
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'Attendance can only be changed by checking in/out or through an approved correction request';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_attendance_self_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_attendance_self_update ON public.attendance;
CREATE TRIGGER guard_attendance_self_update
BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_self_update();

CREATE OR REPLACE FUNCTION public.guard_performance_review_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')
     OR public.is_manager_of(auth.uid(), NEW.user_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id = auth.uid() THEN
    IF NEW.manager_rating IS DISTINCT FROM OLD.manager_rating
       OR NEW.manager_feedback IS DISTINCT FROM OLD.manager_feedback
       OR NEW.cycle_id IS DISTINCT FROM OLD.cycle_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'Only your manager or HR can change manager feedback on a review';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (OLD.status = 'pending' AND NEW.status = 'self_review') THEN
      RAISE EXCEPTION 'You can only submit your self review';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_performance_review_self_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_performance_review_self_update ON public.performance_reviews;
CREATE TRIGGER guard_performance_review_self_update
BEFORE UPDATE ON public.performance_reviews
FOR EACH ROW EXECUTE FUNCTION public.guard_performance_review_self_update();
