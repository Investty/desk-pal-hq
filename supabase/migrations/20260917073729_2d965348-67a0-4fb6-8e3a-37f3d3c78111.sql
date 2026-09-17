
-- SHIFTS
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time NOT NULL DEFAULT '09:30',
  end_time time NOT NULL DEFAULT '18:30',
  break_minutes integer NOT NULL DEFAULT 60,
  grace_minutes integer NOT NULL DEFAULT 15,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view shifts" ON public.shifts FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "HR manage shifts" ON public.shifts FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (company_id = public.current_company_id() AND (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')));
CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX shifts_one_default ON public.shifts(company_id) WHERE is_default;

-- EMPLOYEE MONTHLY SHIFTS
CREATE TABLE public.employee_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  period_month date NOT NULL,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_shifts TO authenticated;
GRANT ALL ON public.employee_shifts TO service_role;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view rosters" ON public.employee_shifts FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "HR manage rosters" ON public.employee_shifts FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (company_id = public.current_company_id() AND (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')));
CREATE TRIGGER employee_shifts_updated_at BEFORE UPDATE ON public.employee_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ATTENDANCE RULES
CREATE TABLE public.attendance_rules (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  early_leave_enabled boolean NOT NULL DEFAULT true,
  early_leave_max_hours numeric NOT NULL DEFAULT 2,
  early_leave_max_per_month integer NOT NULL DEFAULT 2,
  regularization_enabled boolean NOT NULL DEFAULT true,
  regularization_max_per_month integer NOT NULL DEFAULT 3,
  regularization_backdate_days integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.attendance_rules TO authenticated;
GRANT ALL ON public.attendance_rules TO service_role;
ALTER TABLE public.attendance_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view rules" ON public.attendance_rules FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "HR insert rules" ON public.attendance_rules FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "HR update rules" ON public.attendance_rules FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (company_id = public.current_company_id() AND (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')));
CREATE TRIGGER attendance_rules_updated_at BEFORE UPDATE ON public.attendance_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed for existing companies
INSERT INTO public.attendance_rules (company_id) SELECT id FROM public.companies ON CONFLICT DO NOTHING;
INSERT INTO public.shifts (company_id, name, start_time, end_time, is_default)
SELECT id, 'General', '09:30', '18:30', true FROM public.companies;
INSERT INTO public.shifts (company_id, name, start_time, end_time, is_default)
SELECT id, 'Evening', '14:00', '23:00', false FROM public.companies;
INSERT INTO public.shifts (company_id, name, start_time, end_time, is_default)
SELECT id, 'Night', '22:00', '07:00', false FROM public.companies;

-- Effective shift helper
CREATE OR REPLACE FUNCTION public.shift_for(_user uuid, _date date)
RETURNS public.shifts
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.* FROM public.shifts s
  WHERE s.id = (
    SELECT es.shift_id FROM public.employee_shifts es
    WHERE es.user_id = _user AND es.period_month = date_trunc('month', _date)::date
    LIMIT 1
  )
  UNION ALL
  SELECT s.* FROM public.shifts s
  WHERE s.is_default AND s.is_active
    AND s.company_id = (SELECT p.company_id FROM public.profiles p WHERE p.user_id = _user LIMIT 1)
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_shifts es
      WHERE es.user_id = _user AND es.period_month = date_trunc('month', _date)::date
    )
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.shift_for(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shift_for(uuid, date) TO authenticated;

-- clock_in uses the employee's shift
CREATE OR REPLACE FUNCTION public.clock_in()
 RETURNS attendance
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _company uuid; _tz text; _local timestamp; _date date; _row public.attendance;
  _shift public.shifts; _cut time; _st public.attendance_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM set_config('app.attendance_write', 'on', true);
  _company := public.current_company_id();
  IF _company IS NULL THEN RAISE EXCEPTION 'No active company'; END IF;
  SELECT COALESCE(c.timezone, 'Asia/Kolkata') INTO _tz FROM public.companies c WHERE c.id = _company;
  _local := now() AT TIME ZONE _tz;
  _date := _local::date;

  SELECT * INTO _shift FROM public.shift_for(auth.uid(), _date);
  _cut := COALESCE(_shift.start_time, time '10:00') + make_interval(mins => COALESCE(_shift.grace_minutes, 0));
  _st := CASE WHEN _local::time > _cut THEN 'late'::public.attendance_status ELSE 'present'::public.attendance_status END;

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

-- Request validation against company rules
CREATE OR REPLACE FUNCTION public.validate_attendance_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.attendance_rules; _used integer; _cap integer; _tz text; _today date;
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
$$;
REVOKE EXECUTE ON FUNCTION public.validate_attendance_request() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validate_attendance_request ON public.attendance_requests;
CREATE TRIGGER validate_attendance_request BEFORE INSERT ON public.attendance_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_request();
