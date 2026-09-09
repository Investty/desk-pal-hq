
CREATE OR REPLACE FUNCTION public.leave_days(_start date, _end date)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (_end - _start) + 1
$$;
REVOKE EXECUTE ON FUNCTION public.leave_days(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_days(date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_leave_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  d integer;
  rem integer;
BEGIN
  d := (NEW.end_date - NEW.start_date) + 1;
  IF d <= 0 THEN
    RAISE EXCEPTION 'End date must be on or after start date';
  END IF;
  SELECT remaining_days INTO rem FROM public.leave_balances
  WHERE user_id = NEW.user_id AND leave_type = NEW.leave_type;
  IF rem IS NULL THEN
    RAISE EXCEPTION 'No leave balance configured for this leave type';
  END IF;
  IF rem < d THEN
    RAISE EXCEPTION 'Insufficient leave balance: % day(s) remaining, % day(s) requested', rem, d;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_leave_balance_trigger ON public.leave_requests;
CREATE TRIGGER check_leave_balance_trigger
BEFORE INSERT ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.check_leave_balance();

CREATE OR REPLACE FUNCTION public.apply_leave_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  d integer;
BEGIN
  d := (NEW.end_date - NEW.start_date) + 1;
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.leave_balances
    SET used_days = used_days + d,
        remaining_days = GREATEST(total_days - (used_days + d), 0)
    WHERE user_id = NEW.user_id AND leave_type = NEW.leave_type;
  ELSIF OLD.status = 'approved' AND NEW.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.leave_balances
    SET used_days = GREATEST(used_days - d, 0),
        remaining_days = LEAST(total_days, remaining_days + d)
    WHERE user_id = NEW.user_id AND leave_type = NEW.leave_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_leave_balance_trigger ON public.leave_requests;
CREATE TRIGGER apply_leave_balance_trigger
AFTER UPDATE OF status ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.apply_leave_balance();

DROP POLICY IF EXISTS "Users can cancel own pending requests" ON public.leave_requests;
CREATE POLICY "Users can cancel own pending requests"
ON public.leave_requests FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'cancelled');
