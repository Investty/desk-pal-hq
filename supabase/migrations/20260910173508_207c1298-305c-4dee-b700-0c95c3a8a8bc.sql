-- ============ Half-day leave support ============
CREATE TYPE public.day_portion AS ENUM ('full_day','first_half','second_half');

ALTER TABLE public.leave_requests
  ADD COLUMN day_portion public.day_portion NOT NULL DEFAULT 'full_day';

ALTER TABLE public.leave_balances
  ALTER COLUMN total_days TYPE numeric(6,1),
  ALTER COLUMN used_days TYPE numeric(6,1),
  ALTER COLUMN remaining_days TYPE numeric(6,1);

ALTER TABLE public.leave_policies
  ALTER COLUMN default_days TYPE numeric(6,1);

CREATE OR REPLACE FUNCTION public.request_days(_start date, _end date, _portion public.day_portion)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN _portion = 'full_day' THEN ((_end - _start) + 1)::numeric ELSE 0.5 END
$$;

CREATE OR REPLACE FUNCTION public.check_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d numeric;
  rem numeric;
BEGIN
  IF NEW.day_portion <> 'full_day' AND NEW.start_date <> NEW.end_date THEN
    RAISE EXCEPTION 'A half-day leave must start and end on the same date';
  END IF;
  d := public.request_days(NEW.start_date, NEW.end_date, NEW.day_portion);
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

CREATE OR REPLACE FUNCTION public.apply_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d numeric;
BEGIN
  d := public.request_days(NEW.start_date, NEW.end_date, NEW.day_portion);
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

-- ============ Attendance regularization / early leave ============
CREATE TYPE public.attendance_request_type AS ENUM ('regularization','early_leave');

CREATE TABLE public.attendance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  request_type public.attendance_request_type NOT NULL DEFAULT 'regularization',
  requested_check_in timestamptz,
  requested_check_out timestamptz,
  reason text NOT NULL,
  status public.approval_stage_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_requests TO authenticated;
GRANT ALL ON public.attendance_requests TO service_role;

ALTER TABLE public.attendance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own attendance requests"
  ON public.attendance_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own attendance requests"
  ON public.attendance_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users withdraw own pending attendance requests"
  ON public.attendance_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

CREATE POLICY "Managers view team attendance requests"
  ON public.attendance_requests FOR SELECT TO authenticated
  USING (public.is_manager_of(auth.uid(), user_id));

CREATE POLICY "Managers act on team attendance requests"
  ON public.attendance_requests FOR UPDATE TO authenticated
  USING (public.is_manager_of(auth.uid(), user_id))
  WITH CHECK (public.is_manager_of(auth.uid(), user_id));

CREATE POLICY "HR and admins manage attendance requests"
  ON public.attendance_requests FOR ALL TO authenticated
  USING (public.is_hr(auth.uid()))
  WITH CHECK (public.is_hr(auth.uid()));

CREATE TRIGGER update_attendance_requests_updated_at
BEFORE UPDATE ON public.attendance_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.apply_attendance_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ci timestamptz;
  co timestamptz;
  hrs numeric;
  st public.attendance_status;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    SELECT a.check_in, a.check_out INTO ci, co
    FROM public.attendance a WHERE a.user_id = NEW.user_id AND a.date = NEW.date;

    ci := COALESCE(NEW.requested_check_in, ci);
    co := COALESCE(NEW.requested_check_out, co);

    IF ci IS NOT NULL AND co IS NOT NULL THEN
      hrs := ROUND(EXTRACT(EPOCH FROM (co - ci)) / 3600.0, 2);
    ELSE
      hrs := NULL;
    END IF;

    st := CASE WHEN ci IS NOT NULL AND EXTRACT(HOUR FROM ci AT TIME ZONE 'UTC') >= 10 THEN 'late'::public.attendance_status
               WHEN ci IS NOT NULL THEN 'present'::public.attendance_status
               ELSE 'absent'::public.attendance_status END;

    INSERT INTO public.attendance (user_id, date, check_in, check_out, working_hours, status)
    VALUES (NEW.user_id, NEW.date, ci, co, hrs, st)
    ON CONFLICT (user_id, date) DO UPDATE
      SET check_in = EXCLUDED.check_in,
          check_out = EXCLUDED.check_out,
          working_hours = EXCLUDED.working_hours,
          status = EXCLUDED.status;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_attendance_request() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER apply_attendance_request_trigger
AFTER UPDATE ON public.attendance_requests
FOR EACH ROW EXECUTE FUNCTION public.apply_attendance_request();

CREATE OR REPLACE FUNCTION public.notify_attendance_request_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_name text;
  mgr uuid;
  kind text;
BEGIN
  SELECT full_name INTO emp_name FROM public.profiles WHERE user_id = NEW.user_id;
  kind := CASE WHEN NEW.request_type = 'early_leave' THEN 'early leave' ELSE 'attendance correction' END;

  IF TG_OP = 'INSERT' THEN
    mgr := public.get_manager_user_id(NEW.user_id);
    IF mgr IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (mgr, 'New ' || kind || ' request',
        COALESCE(emp_name,'An employee') || ' raised an ' || kind || ' request for ' || NEW.date || '.', 'attendance');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Request approved',
      'Your ' || kind || ' request for ' || NEW.date || ' was approved.' || COALESCE(' Note: ' || NEW.review_comment, ''), 'attendance');
  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'Request rejected',
      'Your ' || kind || ' request for ' || NEW.date || ' was rejected.' || COALESCE(' Note: ' || NEW.review_comment, ''), 'attendance');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_attendance_request_events() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_attendance_request_insert
AFTER INSERT ON public.attendance_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_attendance_request_events();

CREATE TRIGGER notify_attendance_request_update
AFTER UPDATE ON public.attendance_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_attendance_request_events();