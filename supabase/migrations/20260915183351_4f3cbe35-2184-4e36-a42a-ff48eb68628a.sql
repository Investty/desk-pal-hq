
CREATE TABLE public.celebration_wishes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  occasion_type text NOT NULL CHECK (occasion_type IN ('birthday','anniversary')),
  occasion_date date NOT NULL,
  message text,
  thanks_message text,
  thanked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_user_id, sender_user_id, occasion_type, occasion_date)
);

GRANT SELECT, INSERT, UPDATE ON public.celebration_wishes TO authenticated;
GRANT ALL ON public.celebration_wishes TO service_role;

ALTER TABLE public.celebration_wishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view wishes"
ON public.celebration_wishes FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

CREATE POLICY "Members can send wishes"
ON public.celebration_wishes FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND sender_user_id = auth.uid()
  AND recipient_user_id <> auth.uid()
);

CREATE POLICY "Recipient can reply with thanks"
ON public.celebration_wishes FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND recipient_user_id = auth.uid())
WITH CHECK (company_id = public.current_company_id() AND recipient_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_celebration_wish_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
     OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
     OR NEW.occasion_type IS DISTINCT FROM OLD.occasion_type
     OR NEW.occasion_date IS DISTINCT FROM OLD.occasion_date
     OR NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'Only the thank-you reply can be updated';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_celebration_wish_update() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_celebration_wish_update
BEFORE UPDATE ON public.celebration_wishes
FOR EACH ROW EXECUTE FUNCTION public.guard_celebration_wish_update();

CREATE OR REPLACE FUNCTION public.notify_celebration_wish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_name text;
  recipient_name text;
  occ text;
BEGIN
  occ := CASE WHEN NEW.occasion_type = 'birthday' THEN 'birthday' ELSE 'work anniversary' END;

  IF TG_OP = 'INSERT' THEN
    SELECT full_name INTO sender_name FROM public.profiles
     WHERE user_id = NEW.sender_user_id AND company_id = NEW.company_id LIMIT 1;
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (
      NEW.recipient_user_id, NEW.company_id,
      COALESCE(sender_name, 'A colleague') || ' wished you!',
      COALESCE(sender_name, 'A colleague') || ' sent you ' || occ || ' wishes'
        || COALESCE(': "' || NEW.message || '"', ''),
      'celebration'
    );
    RETURN NEW;
  END IF;

  IF NEW.thanked_at IS NOT NULL AND OLD.thanked_at IS NULL THEN
    SELECT full_name INTO recipient_name FROM public.profiles
     WHERE user_id = NEW.recipient_user_id AND company_id = NEW.company_id LIMIT 1;
    INSERT INTO public.notifications (user_id, company_id, title, message, type)
    VALUES (
      NEW.sender_user_id, NEW.company_id,
      COALESCE(recipient_name, 'A colleague') || ' thanked you',
      COALESCE(NEW.thanks_message, 'Thank you for your wishes!'),
      'celebration'
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_celebration_wish() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_celebration_wish_ins
AFTER INSERT ON public.celebration_wishes
FOR EACH ROW EXECUTE FUNCTION public.notify_celebration_wish();

CREATE TRIGGER notify_celebration_wish_upd
AFTER UPDATE ON public.celebration_wishes
FOR EACH ROW EXECUTE FUNCTION public.notify_celebration_wish();

DROP FUNCTION IF EXISTS public.get_celebrations();
CREATE FUNCTION public.get_celebrations()
RETURNS TABLE(user_id uuid, full_name text, date_of_birth date, joining_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.full_name, p.date_of_birth, p.joining_date
  FROM public.profiles p
  WHERE p.is_active = true AND p.company_id = public.current_company_id()
$$;
REVOKE EXECUTE ON FUNCTION public.get_celebrations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_celebrations() TO authenticated;
