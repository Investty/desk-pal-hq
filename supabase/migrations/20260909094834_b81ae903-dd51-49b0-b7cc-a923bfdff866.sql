CREATE OR REPLACE FUNCTION public.handle_leave_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    IF OLD.start_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'This leave has already started or passed and can no longer be cancelled';
    END IF;
    NEW.manager_status := 'cancelled';
    NEW.hr_status := 'cancelled';
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_leave_cancellation_trigger ON public.leave_requests;
CREATE TRIGGER handle_leave_cancellation_trigger
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_leave_cancellation();