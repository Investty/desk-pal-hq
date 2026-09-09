CREATE OR REPLACE FUNCTION public.is_hr(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','hr'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_hr(uuid) FROM anon;

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "HR and admins manage announcements" ON public.announcements FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
CREATE POLICY "HR and admins view all attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "HR and admins view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "HR and admins manage departments" ON public.departments FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all documents" ON public.employee_documents;
CREATE POLICY "HR and admins view all documents" ON public.employee_documents FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage documents" ON public.employee_documents;
CREATE POLICY "HR and admins manage documents" ON public.employee_documents FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage holidays" ON public.holidays;
CREATE POLICY "HR and admins manage holidays" ON public.holidays FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage leave balances" ON public.leave_balances;
CREATE POLICY "HR and admins manage leave balances" ON public.leave_balances FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins manage leave policies" ON public.leave_policies;
CREATE POLICY "HR and admins manage leave policies" ON public.leave_policies FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all requests" ON public.leave_requests;
CREATE POLICY "HR and admins manage all requests" ON public.leave_requests FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage checklists" ON public.onboarding_checklists;
CREATE POLICY "HR and admins manage checklists" ON public.onboarding_checklists FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage payslips" ON public.payslips;
CREATE POLICY "HR and admins manage payslips" ON public.payslips FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage cycles" ON public.performance_cycles;
CREATE POLICY "HR and admins manage cycles" ON public.performance_cycles FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage reviews" ON public.performance_reviews;
CREATE POLICY "HR and admins manage reviews" ON public.performance_reviews FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "HR and admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "HR and admins manage all profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage salaries" ON public.salary_structures;
CREATE POLICY "HR and admins manage salaries" ON public.salary_structures FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));