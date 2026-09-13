-- 1) Lock down privileged routines: no public/anon execute; owner routines only for platform admins at runtime
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- owner_end_support must verify the caller is a platform admin
CREATE OR REPLACE FUNCTION public.owner_end_support()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.impersonation_sessions
  SET ended_at = now()
  WHERE admin_user_id = auth.uid() AND ended_at IS NULL;
END $$;

REVOKE ALL ON FUNCTION public.owner_end_support() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_end_support() TO authenticated;

-- 2) Avatars: restrict reads to own file or same-company employees
DROP POLICY IF EXISTS "Authenticated can view avatars" ON storage.objects;

CREATE POLICY "Users can view avatars in their company"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id::text = (storage.foldername(name))[1]
        AND p.company_id = public.current_company_id()
    )
  )
);