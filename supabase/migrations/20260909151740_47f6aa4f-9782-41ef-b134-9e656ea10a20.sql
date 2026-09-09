REVOKE ALL ON FUNCTION public.is_hr(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hr(uuid) TO authenticated, service_role;