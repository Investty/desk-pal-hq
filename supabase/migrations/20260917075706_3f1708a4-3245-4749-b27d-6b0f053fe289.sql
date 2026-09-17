
-- 1. Night-shift aware clock in
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
  -- overnight shift: an early-morning punch belongs to the previous calendar day
  IF _shift.id IS NOT NULL AND _shift.end_time <= _shift.start_time AND _local::time < _shift.end_time THEN
    _date := _date - 1;
    SELECT * INTO _shift FROM public.shift_for(auth.uid(), _date);
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

-- 2. Clock out can close an open overnight shift started the previous day
CREATE OR REPLACE FUNCTION public.clock_out()
 RETURNS attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _company uuid; _tz text; _date date; _row public.attendance;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM set_config('app.attendance_write', 'on', true);
  _company := public.current_company_id();
  IF _company IS NULL THEN RAISE EXCEPTION 'No active company'; END IF;
  SELECT COALESCE(c.timezone, 'Asia/Kolkata') INTO _tz FROM public.companies c WHERE c.id = _company;
  _date := (now() AT TIME ZONE _tz)::date;

  SELECT * INTO _row FROM public.attendance a
   WHERE a.user_id = auth.uid() AND a.company_id = _company
     AND a.date IN (_date, _date - 1)
     AND a.check_in IS NOT NULL AND a.check_out IS NULL
   ORDER BY a.date DESC LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO _row FROM public.attendance a
     WHERE a.user_id = auth.uid() AND a.company_id = _company AND a.date = _date;
    IF NOT FOUND OR _row.check_in IS NULL THEN
      RAISE EXCEPTION 'You have not checked in today';
    END IF;
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

-- 3. Overnight shifts must not be force-closed as 0 hours on the same night
CREATE OR REPLACE FUNCTION public.close_attendance_day()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _c record; _tz text; _today date; _day date;
  _absent int := 0; _closed int := 0; _n int;
BEGIN
  PERFORM set_config('app.attendance_write', 'on', true);
  FOR _c IN SELECT id, COALESCE(timezone,'Asia/Kolkata') AS tz FROM public.companies WHERE status <> 'suspended' LOOP
    _tz := _c.tz;
    _today := (now() AT TIME ZONE _tz)::date;
    _day := _today - 1;

    UPDATE public.attendance a
       SET check_out = a.check_in, working_hours = 0, updated_at = now()
     WHERE a.company_id = _c.id
       AND a.date < _today - 1
       AND a.check_in IS NOT NULL
       AND a.check_out IS NULL;
    GET DIAGNOSTICS _n = ROW_COUNT;
    _closed := _closed + _n;

    IF NOT public.is_working_day(_c.id, _day) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.attendance (user_id, company_id, date, status)
    SELECT p.user_id, _c.id, _day, 'absent'::public.attendance_status
      FROM public.profiles p
     WHERE p.company_id = _c.id
       AND p.is_active = true
       AND p.status = 'active'
       AND p.joining_date <= _day
       AND NOT EXISTS (
         SELECT 1 FROM public.attendance a
          WHERE a.user_id = p.user_id AND a.company_id = _c.id AND a.date = _day)
       AND NOT EXISTS (
         SELECT 1 FROM public.leave_requests lr
          WHERE lr.user_id = p.user_id AND lr.company_id = _c.id
            AND lr.status = 'approved'
            AND lr.start_date <= _day AND lr.end_date >= _day);
    GET DIAGNOSTICS _n = ROW_COUNT;
    _absent := _absent + _n;
  END LOOP;

  PERFORM set_config('app.attendance_write', 'off', true);
  RETURN jsonb_build_object('absent_marked', _absent, 'shifts_closed', _closed);
END;
$function$;

-- 4. Approved corrections follow the employee's own shift, and handle midnight crossing
CREATE OR REPLACE FUNCTION public.apply_attendance_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ci timestamptz; co timestamptz; hrs numeric; st public.attendance_status;
        _tz text; _shift public.shifts; _mins numeric;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM set_config('app.attendance_write', 'on', true);
    SELECT a.check_in, a.check_out INTO ci, co
    FROM public.attendance a WHERE a.user_id = NEW.user_id AND a.date = NEW.date AND a.company_id = NEW.company_id;

    ci := COALESCE(NEW.requested_check_in, ci);
    co := COALESCE(NEW.requested_check_out, co);

    SELECT COALESCE(c.timezone,'Asia/Kolkata') INTO _tz FROM public.companies c WHERE c.id = NEW.company_id;
    SELECT * INTO _shift FROM public.shift_for(NEW.user_id, NEW.date);

    IF ci IS NOT NULL AND co IS NOT NULL THEN
      IF co < ci THEN co := co + interval '1 day'; END IF;
      hrs := ROUND(EXTRACT(EPOCH FROM (co - ci)) / 3600.0, 2);
    ELSE hrs := NULL; END IF;

    IF ci IS NULL THEN
      st := 'absent'::public.attendance_status;
    ELSIF _shift.id IS NULL THEN
      st := CASE WHEN ((ci AT TIME ZONE _tz)::time) > time '10:00'
                 THEN 'late'::public.attendance_status ELSE 'present'::public.attendance_status END;
    ELSE
      _mins := EXTRACT(EPOCH FROM (((ci AT TIME ZONE _tz)::time) - _shift.start_time)) / 60.0;
      IF _mins < -720 THEN _mins := _mins + 1440; END IF;
      IF _mins > 720 THEN _mins := _mins - 1440; END IF;
      st := CASE WHEN _mins > COALESCE(_shift.grace_minutes,0)
                 THEN 'late'::public.attendance_status ELSE 'present'::public.attendance_status END;
    END IF;

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

-- 5. Enforce the early-leave maximum hours in the database too
CREATE OR REPLACE FUNCTION public.validate_attendance_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _r public.attendance_rules; _used integer; _cap integer; _tz text; _today date;
        _shift public.shifts; _early numeric;
BEGIN
  SELECT * INTO _r FROM public.attendance_rules WHERE company_id = NEW.company_id;
  IF NOT FOUND THEN
    INSERT INTO public.attendance_rules (company_id) VALUES (NEW.company_id)
    ON CONFLICT DO NOTHING;
    SELECT * INTO _r FROM public.attendance_rules WHERE company_id = NEW.company_id;
  END IF;

  IF length(btrim(COALESCE(NEW.reason,''))) < 10 THEN
    RAISE EXCEPTION 'Please give a reason of at least 10 characters';
  END IF;

  SELECT COALESCE(c.timezone,'Asia/Kolkata') INTO _tz FROM public.companies c WHERE c.id = NEW.company_id;
  _today := (now() AT TIME ZONE _tz)::date;

  IF NEW.request_type = 'early_leave' THEN
    IF NOT _r.early_leave_enabled THEN
      RAISE EXCEPTION 'Early leave requests are turned off for this company';
    END IF;
    _cap := _r.early_leave_max_per_month;

    SELECT * INTO _shift FROM public.shift_for(NEW.user_id, NEW.date);
    IF _shift.id IS NOT NULL AND NEW.requested_check_out IS NOT NULL AND _r.early_leave_max_hours IS NOT NULL THEN
      _early := EXTRACT(EPOCH FROM (_shift.end_time - ((NEW.requested_check_out AT TIME ZONE _tz)::time))) / 3600.0;
      IF _early < -12 THEN _early := _early + 24; END IF;
      IF _early > 12 THEN _early := _early - 24; END IF;
      IF _early > _r.early_leave_max_hours THEN
        RAISE EXCEPTION 'You can leave at most % hours early (your shift ends at %)', _r.early_leave_max_hours, to_char(_shift.end_time,'HH24:MI');
      END IF;
    END IF;
  ELSE
    IF NOT _r.regularization_enabled THEN
      RAISE EXCEPTION 'Attendance correction requests are turned off for this company';
    END IF;
    _cap := _r.regularization_max_per_month;
    IF NEW.date < _today - _r.regularization_backdate_days THEN
      RAISE EXCEPTION 'You can only correct attendance from the last % days', _r.regularization_backdate_days;
    END IF;
  END IF;

  IF NEW.date > _today THEN
    RAISE EXCEPTION 'You cannot raise a request for a future date';
  END IF;

  SELECT count(*) INTO _used FROM public.attendance_requests ar
   WHERE ar.user_id = NEW.user_id AND ar.company_id = NEW.company_id
     AND ar.request_type = NEW.request_type
     AND ar.status IN ('pending','approved')
     AND date_trunc('month', ar.date) = date_trunc('month', NEW.date);

  IF _cap IS NOT NULL AND _used >= _cap THEN
    RAISE EXCEPTION 'You have used % of % allowed requests of this type for that month', _used, _cap;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_attendance_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_attendance_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_attendance_day() FROM PUBLIC, anon;
