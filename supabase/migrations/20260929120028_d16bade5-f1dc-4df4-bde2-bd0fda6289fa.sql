ALTER TABLE public.company_invites ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.company_invites ALTER COLUMN expires_at SET DEFAULT now() + interval '30 days';

CREATE OR REPLACE FUNCTION public.guard_invite_expiry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.used_at IS NOT NULL AND OLD.used_at IS NULL
     AND OLD.expires_at IS NOT NULL AND OLD.expires_at < now() THEN
    RAISE EXCEPTION 'This invite code has expired';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_invite_expiry ON public.company_invites;
CREATE TRIGGER trg_guard_invite_expiry BEFORE UPDATE ON public.company_invites
FOR EACH ROW EXECUTE FUNCTION public.guard_invite_expiry();

CREATE OR REPLACE FUNCTION public.check_invite_code(_code text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 OR length(_code) > 32 THEN RETURN 'invalid'; END IF;
  SELECT i.used_at, i.expires_at, c.status INTO v
  FROM public.company_invites i JOIN public.companies c ON c.id = i.company_id
  WHERE i.code = upper(trim(_code));
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  IF v.used_at IS NOT NULL THEN RETURN 'used'; END IF;
  IF v.expires_at IS NOT NULL AND v.expires_at < now() THEN RETURN 'expired'; END IF;
  IF v.status NOT IN ('active','trial') THEN RETURN 'inactive'; END IF;
  RETURN 'valid';
END $$;
REVOKE ALL ON FUNCTION public.check_invite_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_invite_code(text) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.user_password_meta (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_password_meta TO authenticated;
GRANT ALL ON public.user_password_meta TO service_role;
ALTER TABLE public.user_password_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own password meta" ON public.user_password_meta
FOR SELECT TO authenticated USING (user_id = auth.uid());

INSERT INTO public.user_password_meta (user_id, changed_at)
SELECT id, created_at FROM auth.users ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.mark_password_changed()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.user_password_meta (user_id, changed_at) VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET changed_at = now();
$$;
REVOKE ALL ON FUNCTION public.mark_password_changed() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_password_changed() TO authenticated;