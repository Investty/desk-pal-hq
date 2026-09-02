ALTER TABLE public.profiles ADD COLUMN date_of_birth date;

CREATE OR REPLACE FUNCTION public.get_celebrations()
RETURNS TABLE(full_name text, date_of_birth date, joining_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.full_name, p.date_of_birth, p.joining_date
  FROM public.profiles p
  WHERE p.is_active = true
$$;