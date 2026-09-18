CREATE OR REPLACE FUNCTION public.set_company_weekly_offs(_weekly_offs integer[])
RETURNS integer[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cc uuid;
  normalized integer[];
BEGIN
  cc := public.current_company_id();
  IF cc IS NULL THEN
    RAISE EXCEPTION 'No active company selected';
  END IF;
  IF NOT public.is_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Only HR or admin can change the work week';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT d ORDER BY d), ARRAY[]::integer[])
  INTO normalized
  FROM unnest(COALESCE(_weekly_offs, ARRAY[]::integer[])) AS d;

  IF EXISTS (SELECT 1 FROM unnest(normalized) AS d WHERE d < 0 OR d > 6) THEN
    RAISE EXCEPTION 'Work-week days must be between Sunday and Saturday';
  END IF;
  IF cardinality(normalized) >= 7 THEN
    RAISE EXCEPTION 'At least one working day is required';
  END IF;

  UPDATE public.companies
  SET weekly_offs = normalized, updated_at = now()
  WHERE id = cc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active company not found';
  END IF;
  RETURN normalized;
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_weekly_offs(integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_company_weekly_offs(integer[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_leave_policy_balances_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_enabled THEN
    INSERT INTO public.leave_balances
      (user_id, company_id, policy_id, leave_type, total_days, used_days, remaining_days)
    SELECT p.user_id, NEW.company_id, NEW.id, NEW.leave_type,
           public.effective_leave_days(p.user_id, NEW.id), 0,
           public.effective_leave_days(p.user_id, NEW.id)
    FROM public.profiles p
    LEFT JOIN public.employee_leave_settings els
      ON els.user_id = p.user_id
     AND els.policy_id = NEW.id
     AND els.company_id = NEW.company_id
    WHERE p.company_id = NEW.company_id
      AND p.status = 'active'
      AND p.is_active = true
      AND COALESCE(els.is_enabled, NEW.applies_to = 'all')
    ON CONFLICT (company_id, user_id, policy_id) DO NOTHING;
  END IF;

  UPDATE public.leave_balances lb
  SET total_days = COALESCE(els.entitlement_override, NEW.default_days),
      remaining_days = GREATEST(COALESCE(els.entitlement_override, NEW.default_days) - lb.used_days, 0),
      leave_type = NEW.leave_type,
      updated_at = now()
  FROM public.profiles p
  LEFT JOIN public.employee_leave_settings els
    ON els.user_id = p.user_id
   AND els.policy_id = NEW.id
   AND els.company_id = NEW.company_id
  WHERE lb.company_id = NEW.company_id
    AND lb.policy_id = NEW.id
    AND lb.user_id = p.user_id
    AND p.company_id = NEW.company_id
    AND NEW.code <> 'compensatory';

  DELETE FROM public.leave_balances lb
  WHERE lb.company_id = NEW.company_id
    AND lb.policy_id = NEW.id
    AND lb.used_days = 0
    AND (
      NOT NEW.is_enabled
      OR NOT COALESCE(
        (SELECT els.is_enabled
         FROM public.employee_leave_settings els
         WHERE els.company_id = NEW.company_id
           AND els.user_id = lb.user_id
           AND els.policy_id = NEW.id),
        NEW.applies_to = 'all'
      )
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_leave_policy_balances_after_write ON public.leave_policies;
CREATE TRIGGER sync_leave_policy_balances_after_write
AFTER INSERT OR UPDATE OF default_days, is_enabled, applies_to, leave_type
ON public.leave_policies
FOR EACH ROW
EXECUTE FUNCTION public.sync_leave_policy_balances_trigger();

INSERT INTO public.leave_balances
  (user_id, company_id, policy_id, leave_type, total_days, used_days, remaining_days)
SELECT p.user_id, lp.company_id, lp.id, lp.leave_type,
       public.effective_leave_days(p.user_id, lp.id), 0,
       public.effective_leave_days(p.user_id, lp.id)
FROM public.leave_policies lp
JOIN public.profiles p
  ON p.company_id = lp.company_id
 AND p.status = 'active'
 AND p.is_active = true
LEFT JOIN public.employee_leave_settings els
  ON els.company_id = lp.company_id
 AND els.user_id = p.user_id
 AND els.policy_id = lp.id
WHERE lp.is_enabled = true
  AND COALESCE(els.is_enabled, lp.applies_to = 'all')
ON CONFLICT (company_id, user_id, policy_id) DO NOTHING;

UPDATE public.leave_balances lb
SET total_days = COALESCE(els.entitlement_override, lp.default_days),
    remaining_days = GREATEST(COALESCE(els.entitlement_override, lp.default_days) - lb.used_days, 0),
    leave_type = lp.leave_type,
    updated_at = now()
FROM public.leave_policies lp
JOIN public.profiles p
  ON p.company_id = lp.company_id
LEFT JOIN public.employee_leave_settings els
  ON els.company_id = lp.company_id
 AND els.user_id = p.user_id
 AND els.policy_id = lp.id
WHERE lb.company_id = lp.company_id
  AND lb.policy_id = lp.id
  AND lb.user_id = p.user_id
  AND lp.code <> 'compensatory';