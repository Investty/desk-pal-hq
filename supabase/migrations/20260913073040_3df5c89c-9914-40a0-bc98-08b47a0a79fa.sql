-- 1. Attendance requests: employees may only withdraw (cancel) their own pending requests
CREATE OR REPLACE FUNCTION public.guard_attendance_request_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.user_id
     AND NOT public.is_hr(auth.uid())
     AND NOT public.is_manager_of(auth.uid(), NEW.user_id) THEN
    IF NEW.status <> 'cancelled'::approval_stage_status
       OR OLD.status <> 'pending'::approval_stage_status
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.date IS DISTINCT FROM OLD.date
       OR NEW.request_type IS DISTINCT FROM OLD.request_type
       OR NEW.requested_check_in IS DISTINCT FROM OLD.requested_check_in
       OR NEW.requested_check_out IS DISTINCT FROM OLD.requested_check_out
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.flag_id IS DISTINCT FROM OLD.flag_id
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.review_comment IS DISTINCT FROM OLD.review_comment THEN
      RAISE EXCEPTION 'You can only withdraw your own pending attendance request';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_attendance_request_self_update ON public.attendance_requests;
CREATE TRIGGER guard_attendance_request_self_update
BEFORE UPDATE ON public.attendance_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_request_self_update();

-- 2. Leave requests: employees may only cancel their own requests
CREATE OR REPLACE FUNCTION public.guard_leave_request_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.user_id
     AND NOT public.is_hr(auth.uid())
     AND NOT public.is_manager_of(auth.uid(), NEW.user_id) THEN
    IF NEW.status <> 'cancelled'::leave_status
       OR OLD.status NOT IN ('pending'::leave_status, 'approved'::leave_status)
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.leave_type IS DISTINCT FROM OLD.leave_type
       OR NEW.start_date IS DISTINCT FROM OLD.start_date
       OR NEW.end_date IS DISTINCT FROM OLD.end_date
       OR NEW.day_portion IS DISTINCT FROM OLD.day_portion
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.is_public IS DISTINCT FROM OLD.is_public
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.manager_status IS DISTINCT FROM OLD.manager_status
       OR NEW.manager_reviewed_by IS DISTINCT FROM OLD.manager_reviewed_by
       OR NEW.manager_reviewed_at IS DISTINCT FROM OLD.manager_reviewed_at
       OR NEW.manager_comment IS DISTINCT FROM OLD.manager_comment
       OR NEW.hr_status IS DISTINCT FROM OLD.hr_status
       OR NEW.hr_reviewed_by IS DISTINCT FROM OLD.hr_reviewed_by
       OR NEW.hr_reviewed_at IS DISTINCT FROM OLD.hr_reviewed_at
       OR NEW.hr_comment IS DISTINCT FROM OLD.hr_comment THEN
      RAISE EXCEPTION 'You can only cancel your own leave request';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_leave_request_self_update ON public.leave_requests;
CREATE TRIGGER guard_leave_request_self_update
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_leave_request_self_update();

-- 3. Profiles: self-service updates limited to personal contact fields
CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.user_id AND NOT public.is_hr(auth.uid()) THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.department_id IS DISTINCT FROM OLD.department_id
       OR NEW.manager_id IS DISTINCT FROM OLD.manager_id
       OR NEW.functional_manager_id IS DISTINCT FROM OLD.functional_manager_id
       OR NEW.joining_date IS DISTINCT FROM OLD.joining_date
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.retirement_date IS DISTINCT FROM OLD.retirement_date
       OR NEW.employment_type IS DISTINCT FROM OLD.employment_type
       OR NEW.employment_status IS DISTINCT FROM OLD.employment_status
       OR NEW.confirmation_date IS DISTINCT FROM OLD.confirmation_date
       OR NEW.company IS DISTINCT FROM OLD.company
       OR NEW.business_unit IS DISTINCT FROM OLD.business_unit
       OR NEW.sub_department IS DISTINCT FROM OLD.sub_department
       OR NEW.designation IS DISTINCT FROM OLD.designation
       OR NEW.region IS DISTINCT FROM OLD.region
       OR NEW.branch IS DISTINCT FROM OLD.branch
       OR NEW.sub_branch IS DISTINCT FROM OLD.sub_branch
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.removed_at IS DISTINCT FROM OLD.removed_at
       OR NEW.removed_by IS DISTINCT FROM OLD.removed_by
       OR NEW.removal_reason IS DISTINCT FROM OLD.removal_reason
       OR NEW.last_working_day IS DISTINCT FROM OLD.last_working_day THEN
      RAISE EXCEPTION 'Only HR can modify employment and position fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_self_update ON public.profiles;
CREATE TRIGGER guard_profile_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_update();

-- 4. employee-documents storage: scope admin access to own company's files
DROP POLICY IF EXISTS "Admins can view all document files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload document files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update document files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete document files" ON storage.objects;

CREATE POLICY "Admins can view document files in their company"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = (storage.foldername(name))[1]
      AND p.company_id = public.current_company_id()
  )
);

CREATE POLICY "Admins can upload document files in their company"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-documents'
  AND public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = (storage.foldername(name))[1]
      AND p.company_id = public.current_company_id()
  )
);

CREATE POLICY "Admins can update document files in their company"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = (storage.foldername(name))[1]
      AND p.company_id = public.current_company_id()
  )
);

CREATE POLICY "Admins can delete document files in their company"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id::text = (storage.foldername(name))[1]
      AND p.company_id = public.current_company_id()
  )
);