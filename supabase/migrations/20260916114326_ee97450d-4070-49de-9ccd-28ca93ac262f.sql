-- 1. Attendance requests: employee self-update limited to cancelling a pending request
DROP POLICY IF EXISTS "Withdraw own pending attendance requests" ON public.attendance_requests;
CREATE POLICY "Withdraw own pending attendance requests"
ON public.attendance_requests FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND company_id = current_company_id() AND status = 'pending'::approval_stage_status)
WITH CHECK (
  user_id = auth.uid()
  AND company_id = current_company_id()
  AND status = 'cancelled'::approval_stage_status
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND review_comment IS NULL
);

-- 2. Leave requests: employee self-update limited to cancelling
DROP POLICY IF EXISTS "Cancel own leave requests" ON public.leave_requests;
CREATE POLICY "Cancel own leave requests"
ON public.leave_requests FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND company_id = current_company_id()
       AND status IN ('pending'::leave_status, 'approved'::leave_status))
WITH CHECK (
  user_id = auth.uid()
  AND company_id = current_company_id()
  AND status = 'cancelled'::leave_status
);

-- 3. Performance reviews: self-update cannot reach manager-owned outcome states
DROP POLICY IF EXISTS "Update own review" ON public.performance_reviews;
CREATE POLICY "Update own review"
ON public.performance_reviews FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND company_id = current_company_id())
WITH CHECK (
  user_id = auth.uid()
  AND company_id = current_company_id()
  AND status IN ('pending', 'self_review')
);

-- 4. Profiles: keep self-update, sensitive columns enforced by guard trigger
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
CREATE POLICY "Update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND company_id = current_company_id())
WITH CHECK (
  user_id = auth.uid()
  AND company_id = current_company_id()
  AND is_active = true
  AND status = 'active'
);

-- 5. SECURITY DEFINER exposure: remove PUBLIC/anon execute on definer routines
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;