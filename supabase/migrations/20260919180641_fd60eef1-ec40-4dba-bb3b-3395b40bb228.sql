CREATE OR REPLACE FUNCTION public.notify_incomplete_profiles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer := 0;
BEGIN
  WITH targets AS (
    SELECT p.user_id, p.company_id
    FROM public.profiles p
    WHERE p.is_active = true
      AND p.status = 'active'
      AND (
        p.phone IS NULL OR btrim(p.phone) = ''
        OR p.date_of_birth IS NULL
        OR p.address IS NULL OR btrim(p.address) = ''
        OR p.emergency_contact_name IS NULL OR btrim(p.emergency_contact_name) = ''
        OR p.emergency_contact_phone IS NULL OR btrim(p.emergency_contact_phone) = ''
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = p.user_id
          AND n.type = 'profile_incomplete'
          AND n.created_at > now() - interval '14 days'
      )
  ), ins AS (
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    SELECT t.user_id, t.company_id,
           'Complete your personal details',
           'Some of your personal details are missing. Please update your phone, date of birth, address and emergency contact in My Profile.',
           'profile_incomplete'
    FROM targets t
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM ins;

  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_incomplete_profiles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_incomplete_profiles() TO service_role;