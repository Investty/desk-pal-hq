CREATE OR REPLACE FUNCTION public.clock_in()
 RETURNS attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _company uuid; _tz text; _local timestamp; _date date; _row public.attendance;
  _shift public.shifts; _mins numeric; _st public.attendance_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM set_config('app.attendance_write', 'on', true);
  _company := public.current_company_id();
  IF _company IS NULL THEN RAISE EXCEPTION 'No active company'; END IF;
  SELECT COALESCE(c.timezone, 'Asia/Kolkata') INTO _tz FROM public.companies c WHERE c.id = _company;
  _local := now() AT TIME ZONE _tz;
  _date := _local::date;

  SELECT * INTO _shift FROM public.shift_for(auth.uid(), _date);
  IF _shift.id IS NOT NULL AND _shift.end_time <= _shift.start_time AND _local::time < _shift.end_time THEN
    _date := _date - 1;
    SELECT * INTO _shift FROM public.shift_for(auth.uid(), _date);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leave_requests lr
     WHERE lr.user_id = auth.uid() AND lr.company_id = _company
       AND lr.status = 'approved' AND lr.day_portion = 'full_day'
       AND _date BETWEEN lr.start_date AND lr.end_date
  ) THEN
    RAISE EXCEPTION 'You are on approved leave on this day, so attendance cannot be marked';
  END IF;

  IF _shift.id IS NULL THEN
    _st := CASE WHEN _local::time > time '10:00' THEN 'late'::public.attendance_status ELSE 'present'::public.attendance_status END;
  ELSE
    _mins := (EXTRACT(EPOCH FROM (_local::time - _shift.start_time)) / 60.0);
    IF _mins < -720 THEN _mins := _mins + 1440; END IF;
    IF _mins > 720 THEN _mins := _mins - 1440; END IF;
    _st := CASE WHEN _mins > COALESCE(_shift.grace_minutes, 0) THEN 'late'::public.attendance_status ELSE 'present'::public.attendance_status END;
  END IF;

  SELECT * INTO _row FROM public.attendance a
   WHERE a.user_id = auth.uid() AND a.company_id = _company AND a.date = _date;

  IF FOUND AND _row.check_in IS NOT NULL THEN
    RAISE EXCEPTION 'You have already checked in today';
  END IF;

  IF FOUND THEN
    UPDATE public.attendance SET check_in = now(), status = _st, updated_at = now()
    WHERE id = _row.id RETURNING * INTO _row;
  ELSE
    INSERT INTO public.attendance (user_id, company_id, date, check_in, status)
    VALUES (auth.uid(), _company, _date, now(), _st) RETURNING * INTO _row;
  END IF;

  PERFORM set_config('app.attendance_write', 'off', true);
  RETURN _row;
END;
$function$;