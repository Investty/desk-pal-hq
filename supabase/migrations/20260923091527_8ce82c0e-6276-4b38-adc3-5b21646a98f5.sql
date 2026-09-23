CREATE TABLE IF NOT EXISTS public.login_throttle (
  email_key text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);

GRANT ALL ON public.login_throttle TO service_role;

ALTER TABLE public.login_throttle ENABLE ROW LEVEL SECURITY;
-- No policies: the table is reachable only through the SECURITY DEFINER functions below.

CREATE OR REPLACE FUNCTION public.login_throttle_key(_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(lower(trim(_email)), 'UTF8')), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.login_lockout_seconds(_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _until timestamptz;
BEGIN
  SELECT locked_until INTO _until
  FROM public.login_throttle
  WHERE email_key = public.login_throttle_key(_email);

  IF _until IS NULL OR _until <= now() THEN
    RETURN 0;
  END IF;
  RETURN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (_until - now())))::integer);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_login_failure(_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key text;
  _row public.login_throttle%ROWTYPE;
  _attempts integer;
BEGIN
  IF _email IS NULL OR length(trim(_email)) = 0 THEN
    RETURN 0;
  END IF;
  _key := public.login_throttle_key(_email);

  SELECT * INTO _row FROM public.login_throttle WHERE email_key = _key FOR UPDATE;

  IF _row.email_key IS NULL THEN
    INSERT INTO public.login_throttle(email_key, attempts)
    VALUES (_key, 1)
    ON CONFLICT (email_key) DO UPDATE SET attempts = public.login_throttle.attempts + 1,
                                          last_attempt_at = now();
    RETURN 0;
  END IF;

  IF _row.first_attempt_at < now() - interval '15 minutes'
     AND (_row.locked_until IS NULL OR _row.locked_until <= now()) THEN
    UPDATE public.login_throttle
      SET attempts = 1, first_attempt_at = now(), last_attempt_at = now(), locked_until = NULL
      WHERE email_key = _key;
    RETURN 0;
  END IF;

  _attempts := _row.attempts + 1;

  UPDATE public.login_throttle
    SET attempts = _attempts,
        last_attempt_at = now(),
        locked_until = CASE WHEN _attempts >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
    WHERE email_key = _key;

  IF _attempts >= 5 THEN
    RETURN 900;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_login_attempts(_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.login_throttle WHERE email_key = public.login_throttle_key(_email);
$$;

REVOKE ALL ON FUNCTION public.login_lockout_seconds(text) FROM public;
REVOKE ALL ON FUNCTION public.record_login_failure(text) FROM public;
REVOKE ALL ON FUNCTION public.clear_login_attempts(text) FROM public;
GRANT EXECUTE ON FUNCTION public.login_lockout_seconds(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_login_failure(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_login_attempts(text) TO anon, authenticated, service_role;