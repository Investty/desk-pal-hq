-- Profile employment + position fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS retirement_date date,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS employment_status text,
  ADD COLUMN IF NOT EXISTS confirmation_date date,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS business_unit text,
  ADD COLUMN IF NOT EXISTS sub_department text,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS branch text,
  ADD COLUMN IF NOT EXISTS sub_branch text,
  ADD COLUMN IF NOT EXISTS functional_manager_id uuid REFERENCES public.profiles(id);

-- Two-stage leave approval
DO $$ BEGIN
  CREATE TYPE public.approval_stage_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS manager_status public.approval_stage_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS manager_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS manager_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_comment text,
  ADD COLUMN IF NOT EXISTS hr_status public.approval_stage_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS hr_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hr_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS hr_comment text;