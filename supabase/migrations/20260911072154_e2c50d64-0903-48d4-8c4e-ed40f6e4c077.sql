
CREATE TYPE public.flag_status AS ENUM ('open', 'resolved');

CREATE TABLE public.attendance_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  status public.flag_status NOT NULL DEFAULT 'open',
  created_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_flags TO authenticated;
GRANT ALL ON public.attendance_flags TO service_role;

ALTER TABLE public.attendance_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees view their own flags" ON public.attendance_flags
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Managers view team flags" ON public.attendance_flags
  FOR SELECT TO authenticated USING (public.is_manager_of(auth.uid(), user_id));
CREATE POLICY "HR views all flags" ON public.attendance_flags
  FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));
CREATE POLICY "HR creates flags" ON public.attendance_flags
  FOR INSERT TO authenticated WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY "HR updates flags" ON public.attendance_flags
  FOR UPDATE TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY "HR deletes flags" ON public.attendance_flags
  FOR DELETE TO authenticated USING (public.is_hr(auth.uid()));

CREATE TRIGGER update_attendance_flags_updated_at
  BEFORE UPDATE ON public.attendance_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.attendance_requests
  ADD COLUMN flag_id uuid REFERENCES public.attendance_flags(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.notify_attendance_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (NEW.user_id, 'Attendance needs correction',
    'HR flagged your attendance from ' || NEW.start_date || ' to ' || NEW.end_date || '. Reason: ' || NEW.reason || '. Please raise a correction request.',
    'attendance');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_attendance_flag() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_attendance_flag_insert
  AFTER INSERT ON public.attendance_flags
  FOR EACH ROW EXECUTE FUNCTION public.notify_attendance_flag();

CREATE OR REPLACE FUNCTION public.resolve_flag_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.flag_id IS NOT NULL AND NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.attendance_flags
      SET status = 'resolved', resolved_at = now()
      WHERE id = NEW.flag_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_flag_on_approval() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER resolve_flag_on_approval_trigger
  AFTER UPDATE ON public.attendance_requests
  FOR EACH ROW EXECUTE FUNCTION public.resolve_flag_on_approval();
