ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS weekly_offs smallint[] NOT NULL DEFAULT '{0,6}';

CREATE OR REPLACE FUNCTION public.is_working_day(_company uuid, _date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT (
    EXTRACT(DOW FROM _date)::smallint = ANY (
      COALESCE((SELECT c.weekly_offs FROM public.companies c WHERE c.id = _company), '{0,6}'::smallint[])
    )
  ) AND NOT EXISTS (
    SELECT 1 FROM public.holidays h WHERE h.company_id = _company AND h.date = _date
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_working_day(uuid, date) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.working_days_between(_company uuid, _start date, _end date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*), 0)::int
  FROM generate_series(_start, _end, interval '1 day') d
  WHERE public.is_working_day(_company, d::date)
$$;
REVOKE EXECUTE ON FUNCTION public.working_days_between(uuid, date, date) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.leave_days(_start date, _end date)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT GREATEST(
    public.working_days_between(public.current_company_id(), _start, _end),
    0
  )
$$;

CREATE OR REPLACE FUNCTION public.request_days(_start date, _end date, _portion day_portion)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _portion = 'full_day'
      THEN GREATEST(public.working_days_between(public.current_company_id(), _start, _end), 0)::numeric
    ELSE 0.5
  END
$$;

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

  RETURN jsonb_build_object('absent_marked', _absent, 'shifts_closed', _closed);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_leave_calendar(_from date, _to date)
RETURNS TABLE(
  kind text,
  label text,
  start_date date,
  end_date date,
  day_portion day_portion,
  is_self boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'holiday'::text, h.name, h.date, h.date, NULL::day_portion, false
  FROM public.holidays h
  WHERE h.company_id = public.current_company_id()
    AND h.date BETWEEN _from AND _to
  UNION ALL
  SELECT 'leave'::text,
         p.full_name || ' · ' || lr.leave_type::text,
         lr.start_date, lr.end_date, lr.day_portion,
         lr.user_id = auth.uid()
  FROM public.leave_requests lr
  JOIN public.profiles p ON p.user_id = lr.user_id AND p.company_id = lr.company_id
  WHERE lr.company_id = public.current_company_id()
    AND lr.status = 'approved'
    AND lr.start_date <= _to AND lr.end_date >= _from
    AND (lr.user_id = auth.uid() OR lr.is_public = true)
$$;
REVOKE EXECUTE ON FUNCTION public.get_leave_calendar(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leave_calendar(date, date) TO authenticated;