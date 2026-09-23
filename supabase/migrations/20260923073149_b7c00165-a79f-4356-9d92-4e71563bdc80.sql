
CREATE OR REPLACE FUNCTION public.feature_enabled(_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.company_features
    WHERE company_id = public.current_company_id()
      AND feature_key = _key
      AND is_enabled = false
  );
$$;

REVOKE ALL ON FUNCTION public.feature_enabled(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feature_enabled(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Documents feature must be enabled" ON public.employee_documents;
CREATE POLICY "Documents feature must be enabled"
ON public.employee_documents
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.feature_enabled('documents'))
WITH CHECK (public.feature_enabled('documents'));

DROP POLICY IF EXISTS "Onboarding feature must be enabled" ON public.onboarding_checklists;
CREATE POLICY "Onboarding feature must be enabled"
ON public.onboarding_checklists
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.feature_enabled('onboarding'))
WITH CHECK (public.feature_enabled('onboarding'));

CREATE OR REPLACE FUNCTION public.org_chart()
RETURNS TABLE(id uuid, full_name text, employee_id text, manager_id uuid, department text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF NOT public.feature_enabled('org_chart') THEN
    RAISE EXCEPTION 'The org chart is not enabled for this company';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.employee_id, p.manager_id, d.name
    FROM public.profiles p
    LEFT JOIN public.departments d ON d.id = p.department_id
    WHERE p.company_id = public.current_company_id()
      AND p.is_active = true
      AND p.status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.org_chart() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_chart() TO authenticated, service_role;

DROP POLICY IF EXISTS "Anyone signed in can read plans" ON public.plans;
CREATE POLICY "Platform admins can read plans"
ON public.plans
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));
