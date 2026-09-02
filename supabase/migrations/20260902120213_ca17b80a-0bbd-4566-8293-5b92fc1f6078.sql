-- New leave types
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'compensatory';
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'bereavement';

-- Visibility flag on leave requests
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Admin-managed leave policies
CREATE TABLE IF NOT EXISTS public.leave_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type public.leave_type NOT NULL UNIQUE,
  label text NOT NULL,
  default_days integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.leave_policies TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.leave_policies TO authenticated;
GRANT ALL ON public.leave_policies TO service_role;

ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view leave policies"
ON public.leave_policies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage leave policies"
ON public.leave_policies FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_leave_policies_updated_at
BEFORE UPDATE ON public.leave_policies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.leave_policies (leave_type, label, default_days)
VALUES ('sick', 'Sick Leave', 12), ('casual', 'Casual Leave', 12), ('paid', 'Paid Leave', 15)
ON CONFLICT (leave_type) DO NOTHING;

-- Company-wide: who is on leave today (only leaves marked visible)
CREATE OR REPLACE FUNCTION public.get_people_on_leave_today()
RETURNS TABLE(full_name text, leave_type public.leave_type, start_date date, end_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.full_name, lr.leave_type, lr.start_date, lr.end_date
  FROM public.leave_requests lr
  JOIN public.profiles p ON p.user_id = lr.user_id
  WHERE lr.status = 'approved'
    AND lr.is_public = true
    AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
  ORDER BY p.full_name
$$;

REVOKE EXECUTE ON FUNCTION public.get_people_on_leave_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_people_on_leave_today() TO authenticated;

-- Company-wide: yesterday's attendance summary
CREATE OR REPLACE FUNCTION public.get_yesterday_attendance()
RETURNS TABLE(full_name text, check_in timestamptz, check_out timestamptz, working_hours numeric, status public.attendance_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.full_name, a.check_in, a.check_out, a.working_hours, a.status
  FROM public.attendance a
  JOIN public.profiles p ON p.user_id = a.user_id
  WHERE a.date = CURRENT_DATE - 1
  ORDER BY p.full_name
$$;

REVOKE EXECUTE ON FUNCTION public.get_yesterday_attendance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_yesterday_attendance() TO authenticated;