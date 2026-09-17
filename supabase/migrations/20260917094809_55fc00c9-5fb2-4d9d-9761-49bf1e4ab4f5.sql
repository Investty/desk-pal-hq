CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.uid() = OLD.user_id OR auth.uid() = NEW.user_id) AND NOT public.is_hr(auth.uid()) THEN
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

DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
CREATE POLICY "Update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND company_id = public.current_company_id()
  AND is_active = true
  AND status = 'active'
)
WITH CHECK (
  user_id = auth.uid()
  AND company_id = public.current_company_id()
  AND is_active = true
  AND status = 'active'
);