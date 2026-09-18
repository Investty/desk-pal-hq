REVOKE ALL ON FUNCTION public.sync_leave_policy_balances_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_leave_policy_balances_trigger() TO service_role;