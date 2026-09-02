REVOKE EXECUTE ON FUNCTION public.get_celebrations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_celebrations() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_manager_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager_of(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_manager_user_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_user_id(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;