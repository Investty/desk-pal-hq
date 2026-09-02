INSERT INTO public.leave_policies (leave_type, label, default_days)
VALUES ('compensatory', 'Compensatory Off', 5), ('bereavement', 'Bereavement Leave', 5)
ON CONFLICT (leave_type) DO NOTHING;

INSERT INTO public.leave_balances (user_id, leave_type, total_days, used_days, remaining_days)
SELECT p.user_id, lp.leave_type, lp.default_days, 0, lp.default_days
FROM public.profiles p
CROSS JOIN public.leave_policies lp
WHERE NOT EXISTS (
  SELECT 1 FROM public.leave_balances lb
  WHERE lb.user_id = p.user_id AND lb.leave_type = lp.leave_type
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');

  INSERT INTO public.leave_balances (user_id, leave_type, total_days, used_days, remaining_days)
  SELECT NEW.id, lp.leave_type, lp.default_days, 0, lp.default_days
  FROM public.leave_policies lp
  WHERE lp.is_enabled = true;

  RETURN NEW;
END;
$function$;