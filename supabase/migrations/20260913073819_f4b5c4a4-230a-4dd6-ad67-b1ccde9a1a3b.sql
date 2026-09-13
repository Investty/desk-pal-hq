ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';

-- ============ server-authoritative attendance clock ============
CREATE OR REPLACE FUNCTION public.clock_in()
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.clock_out()
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company uuid;
  _tz text;
  _date date;
  _row public.attendance;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
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

  RETURN _row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clock_in() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clock_out() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clock_in() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_out() TO authenticated;

-- ============ nightly close of day ============
CREATE OR REPLACE FUNCTION public.close_attendance_day()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c record;
  _tz text;
  _today date;
  _day date;
  _absent int := 0;
  _closed int := 0;
  _n int;
BEGIN
  FOR _c IN SELECT id, COALESCE(timezone,'Asia/Kolkata') AS tz FROM public.companies WHERE status <> 'suspended' LOOP
    _tz := _c.tz;
    _today := (now() AT TIME ZONE _tz)::date;
    _day := _today - 1;

    -- close forgotten check-outs on any earlier day
    UPDATE public.attendance a
       SET check_out = a.check_in, working_hours = 0, updated_at = now()
     WHERE a.company_id = _c.id
       AND a.date < _today
       AND a.check_in IS NOT NULL
       AND a.check_out IS NULL;
    GET DIAGNOSTICS _n = ROW_COUNT;
    _closed := _closed + _n;

    -- skip weekends and company holidays for absence marking
    IF EXTRACT(DOW FROM _day) IN (0, 6) THEN
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.holidays h WHERE h.company_id = _c.id AND h.date = _day) THEN
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

  RETURN jsonb_build_object('absent_marked', _absent, 'shifts_closed', _closed);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_attendance_day() FROM PUBLIC, anon, authenticated;

-- ============ overlapping leave protection ============
CREATE OR REPLACE FUNCTION public.prevent_leave_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conflict record;
BEGIN
  IF NEW.status IN ('cancelled', 'rejected') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.start_date = NEW.start_date
     AND OLD.end_date = NEW.end_date
     AND OLD.day_portion = NEW.day_portion THEN
    RETURN NEW;
  END IF;

  SELECT lr.start_date, lr.end_date INTO _conflict
    FROM public.leave_requests lr
   WHERE lr.user_id = NEW.user_id
     AND lr.id <> NEW.id
     AND lr.status NOT IN ('cancelled', 'rejected')
     AND lr.start_date <= NEW.end_date
     AND lr.end_date >= NEW.start_date
     AND (lr.day_portion = 'full_day' OR NEW.day_portion = 'full_day' OR lr.day_portion = NEW.day_portion)
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'You already have a leave request covering % to %', _conflict.start_date, _conflict.end_date;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_leave_overlap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_leave_overlap_trigger ON public.leave_requests;
CREATE TRIGGER prevent_leave_overlap_trigger
BEFORE INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.prevent_leave_overlap();