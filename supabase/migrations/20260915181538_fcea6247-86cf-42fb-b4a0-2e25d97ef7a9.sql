
CREATE OR REPLACE FUNCTION public.close_attendance_day()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _c record;
  _tz text;
  _today date;
  _day date;
  _absent int := 0;
  _closed int := 0;
  _n int;
BEGIN
  PERFORM set_config('app.attendance_write', 'on', true);
  FOR _c IN SELECT id, COALESCE(timezone,'Asia/Kolkata') AS tz FROM public.companies WHERE status <> 'suspended' LOOP
    _tz := _c.tz;
    _today := (now() AT TIME ZONE _tz)::date;
    _day := _today - 1;

    UPDATE public.attendance a
       SET check_out = a.check_in, working_hours = 0, updated_at = now()
     WHERE a.company_id = _c.id
       AND a.date < _today
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
REVOKE EXECUTE ON FUNCTION public.close_attendance_day() FROM PUBLIC, anon, authenticated;
