REVOKE EXECUTE ON FUNCTION public.block_support_mode_writes() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_seat_limit() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_storage_limit() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_notification_cap() FROM anon, authenticated, public;