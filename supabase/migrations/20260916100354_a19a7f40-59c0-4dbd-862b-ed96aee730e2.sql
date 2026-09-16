-- 1. audit_logs: immutable
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;
DROP POLICY IF EXISTS "Insert company audit logs" ON public.audit_logs;
CREATE POLICY "Insert own company audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND (user_id IS NULL OR user_id = auth.uid()));

-- 2. impersonation: require live platform admin
CREATE OR REPLACE FUNCTION public.current_impersonation()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.company_id FROM public.impersonation_sessions s
  WHERE s.admin_user_id = auth.uid()
    AND s.ended_at IS NULL
    AND s.expires_at > now()
    AND EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid())
  ORDER BY s.started_at DESC LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.current_support_session()
RETURNS TABLE(company_id uuid, company_name text, expires_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.company_id, c.name, s.expires_at
  FROM public.impersonation_sessions s
  JOIN public.companies c ON c.id = s.company_id
  WHERE s.admin_user_id = auth.uid()
    AND s.ended_at IS NULL
    AND s.expires_at > now()
    AND EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid())
  ORDER BY s.started_at DESC LIMIT 1
$function$;

-- 3. employee_documents: explicit self-upload path
CREATE POLICY "Upload own documents" ON public.employee_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.current_company_id()
    AND uploaded_by = auth.uid()
  );

-- 4. revoke internal SECURITY DEFINER helpers from clients
REVOKE EXECUTE ON FUNCTION public.current_impersonation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_working_day(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.working_days_between(uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_support_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_support_session() TO authenticated;