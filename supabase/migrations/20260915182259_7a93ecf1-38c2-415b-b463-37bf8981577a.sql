
CREATE OR REPLACE FUNCTION public.get_yesterday_attendance()
 RETURNS TABLE(full_name text, check_in timestamp with time zone, check_out timestamp with time zone, working_hours numeric, status attendance_status)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.full_name, a.check_in, a.check_out, a.working_hours, a.status
  FROM public.attendance a
  JOIN public.profiles p ON p.user_id = a.user_id AND p.company_id = a.company_id
  WHERE a.date = CURRENT_DATE - 1
    AND a.company_id = public.current_company_id()
    AND (
      public.is_hr(auth.uid())
      OR public.has_role(auth.uid(), 'admin')
      OR public.is_manager_of(auth.uid(), a.user_id)
      OR a.user_id = auth.uid()
    )
  ORDER BY p.full_name
$function$;

CREATE TABLE IF NOT EXISTS public.comp_off_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  days numeric NOT NULL CHECK (days > 0 AND days <= 30),
  worked_on date NOT NULL,
  reason text NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comp_off_grants TO authenticated;
GRANT ALL ON public.comp_off_grants TO service_role;
ALTER TABLE public.comp_off_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comp off grants"
ON public.comp_off_grants FOR SELECT TO authenticated
USING (
  company_id = public.current_company_id()
  AND (
    user_id = auth.uid()
    OR public.is_hr(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_manager_of(auth.uid(), user_id)
  )
);

CREATE POLICY "Managers and HR grant comp off"
ON public.comp_off_grants FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND granted_by = auth.uid()
  AND user_id <> auth.uid()
  AND (
    public.is_hr(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_manager_of(auth.uid(), user_id)
  )
);

CREATE POLICY "Managers and HR remove comp off"
ON public.comp_off_grants FOR DELETE TO authenticated
USING (
  company_id = public.current_company_id()
  AND (
    public.is_hr(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_manager_of(auth.uid(), user_id)
  )
);

CREATE TRIGGER comp_off_grants_updated_at
BEFORE UPDATE ON public.comp_off_grants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.apply_comp_off_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _delta numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN _delta := NEW.days;
  ELSE _delta := -OLD.days; END IF;

  INSERT INTO public.leave_balances (user_id, company_id, leave_type, total_days, used_days, remaining_days)
  VALUES (COALESCE(NEW.user_id, OLD.user_id), COALESCE(NEW.company_id, OLD.company_id),
          'compensatory', GREATEST(_delta, 0), 0, GREATEST(_delta, 0))
  ON CONFLICT (user_id, company_id, leave_type) DO UPDATE
    SET total_days = GREATEST(public.leave_balances.total_days + _delta, 0),
        remaining_days = GREATEST(public.leave_balances.remaining_days + _delta, 0),
        updated_at = now();
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_comp_off_grant() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER apply_comp_off_grant
AFTER INSERT OR DELETE ON public.comp_off_grants
FOR EACH ROW EXECUTE FUNCTION public.apply_comp_off_grant();

UPDATE public.leave_policies SET default_days = 0 WHERE leave_type = 'compensatory';
