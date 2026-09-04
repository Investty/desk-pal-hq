
ALTER TABLE public.salary_structures
  ADD COLUMN IF NOT EXISTS da numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hra numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS special_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pf_rate numeric NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS professional_tax numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tds numeric NOT NULL DEFAULT 0;

UPDATE public.salary_structures
SET special_allowance = COALESCE(allowances, 0),
    tds = COALESCE(deductions, 0)
WHERE special_allowance = 0 AND tds = 0;

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS basic numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS da numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hra numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS special_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pf numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS professional_tax numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tds numeric NOT NULL DEFAULT 0;
