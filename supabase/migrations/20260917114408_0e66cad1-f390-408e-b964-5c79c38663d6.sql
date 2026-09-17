REVOKE EXECUTE ON FUNCTION public.get_people_on_leave_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_people_on_leave_today() TO authenticated;