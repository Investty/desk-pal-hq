CREATE TABLE public.employee_bank_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT public.current_company_id(),
  user_id uuid NOT NULL,
  account_holder text NOT NULL,
  account_number text NOT NULL,
  ifsc text NOT NULL,
  bank_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id),
  CHECK (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  CHECK (account_number ~ '^[0-9]{9,18}$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_bank_details TO authenticated;
GRANT ALL ON public.employee_bank_details TO service_role;
ALTER TABLE public.employee_bank_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manage bank details" ON public.employee_bank_details FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_hr(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_hr(auth.uid()));
CREATE POLICY "Own bank details view" ON public.employee_bank_details FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND user_id = auth.uid());
CREATE TRIGGER trg_bank_updated BEFORE UPDATE ON public.employee_bank_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();