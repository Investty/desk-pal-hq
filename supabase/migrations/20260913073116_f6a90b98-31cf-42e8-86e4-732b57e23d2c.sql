REVOKE EXECUTE ON FUNCTION public.guard_attendance_request_self_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_leave_request_self_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_self_update() FROM anon, authenticated;