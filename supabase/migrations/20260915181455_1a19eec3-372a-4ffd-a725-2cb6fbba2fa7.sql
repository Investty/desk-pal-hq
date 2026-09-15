
CREATE OR REPLACE FUNCTION public.clock_in()
 RETURNS attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _company uuid;
  _tz text;
  _local timestamp;
  _date date;
  _row public.attendance;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  PERFORM set_config('app.attendance_write', 'on', true);
  _company := public.current_company_id();
  IF _company IS NULL THEN
    RAISE EXCEPTION 'No active company';
  END IF;
  SELECT COALESCE(c.timezone, 'Asia/Kolkata') INTO _tz FROM public.companies c WHERE c.id = _company;
  _local := now() AT TIME ZONE _tz;
  _date := _local::date;

  SELECT * INTO _row FROM public.attendance a
   WHERE a.user_id = auth.uid() AND a.company_id = _company AND a.date = _date;

  IF FOUND AND _row.check_in IS NOT NULL THEN
    RAISE EXCEPTION 'You have already checked in today';
  END IF;

  IF FOUND THEN
    UPDATE public.attendance SET
      check_in = now(),
      status = CASE WHEN _local::time >= time '10:00' THEN 'late'::public.attendance_status ELSE 'present'::public.attendance_status END,
      updated_at = now()
    WHERE id = _row.id
    RETURNING * INTO _row;
  ELSE
    INSERT INTO public.attendance (user_id, company_id, date, check_in, status)
    VALUES (auth.uid(), _company, _date, now(),
      CASE WHEN _local::time >= time '10:00' THEN 'late'::public.attendance_status ELSE 'present'::public.attendance_status END)
    RETURNING * INTO _row;
  END IF;

  PERFORM set_config('app.attendance_write', 'off', true);
  RETURN _row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.clock_out()
 RETURNS attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _company uuid;
  _tz text;
  _date date;
  _row public.attendance;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  PERFORM set_config('app.attendance_write', 'on', true);
  _company := public.current_company_id();
  IF _company IS NULL THEN
    RAISE EXCEPTION 'No active company';
  END IF;
  SELECT COALESCE(c.timezone, 'Asia/Kolkata') INTO _tz FROM public.companies c WHERE c.id = _company;
  _date := (now() AT TIME ZONE _tz)::date;

  SELECT * INTO _row FROM public.attendance a
   WHERE a.user_id = auth.uid() AND a.company_id = _company AND a.date = _date;

  IF NOT FOUND OR _row.check_in IS NULL THEN
    RAISE EXCEPTION 'You have not checked in today';
  END IF;
  IF _row.check_out IS NOT NULL THEN
    RAISE EXCEPTION 'You have already checked out today';
  END IF;

  UPDATE public.attendance SET
    check_out = now(),
    working_hours = round(EXTRACT(EPOCH FROM (now() - _row.check_in)) / 3600.0, 2),
    updated_at = now()
  WHERE id = _row.id
  RETURNING * INTO _row;

  PERFORM set_config('app.attendance_write', 'off', true);
  RETURN _row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_attendance_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ci timestamptz; co timestamptz; hrs numeric; st public.attendance_status;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM set_config('app.attendance_write', 'on', true);
    SELECT a.check_in, a.check_out INTO ci, co
    FROM public.attendance a WHERE a.user_id = NEW.user_id AND a.date = NEW.date AND a.company_id = NEW.company_id;

    ci := COALESCE(NEW.requested_check_in, ci);
    co := COALESCE(NEW.requested_check_out, co);

    IF ci IS NOT NULL AND co IS NOT NULL THEN
      hrs := ROUND(EXTRACT(EPOCH FROM (co - ci)) / 3600.0, 2);
    ELSE hrs := NULL; END IF;

    st := CASE WHEN ci IS NOT NULL AND EXTRACT(HOUR FROM ci AT TIME ZONE 'UTC') >= 10 THEN 'late'::public.attendance_status
               WHEN ci IS NOT NULL THEN 'present'::public.attendance_status
               ELSE 'absent'::public.attendance_status END;

    INSERT INTO public.attendance (user_id, company_id, date, check_in, check_out, working_hours, status)
    VALUES (NEW.user_id, NEW.company_id, NEW.date, ci, co, hrs, st)
    ON CONFLICT (company_id, user_id, date) DO UPDATE
      SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
          working_hours = EXCLUDED.working_hours, status = EXCLUDED.status;
    PERFORM set_config('app.attendance_write', 'off', true);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_attendance_day()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  PERFORM set_config('app.attendance_write', 'on', true);
  SELECT public._close_attendance_day_impl() INTO r;
  PERFORM set_config('app.attendance_write', 'off', true);
  RETURN r;
END;
$function$;
