
CREATE OR REPLACE FUNCTION public.check_leave_balance()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d numeric; rem numeric;
BEGIN
  IF NEW.day_portion <> 'full_day' AND NEW.start_date <> NEW.end_date THEN
    RAISE EXCEPTION 'A half-day leave must start and end on the same date';
  END IF;
  d := public.request_days(NEW.start_date, NEW.end_date, NEW.day_portion);
  IF d <= 0 THEN RAISE EXCEPTION 'End date must be on or after start date'; END IF;
  IF coalesce(current_setting('app.leave_import', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;
  SELECT remaining_days INTO rem FROM public.leave_balances
  WHERE user_id = NEW.user_id AND company_id = NEW.company_id AND policy_id = NEW.policy_id;
  IF rem IS NULL THEN RAISE EXCEPTION 'No leave balance configured for this leave type'; END IF;
  IF rem < d THEN
    RAISE EXCEPTION 'Insufficient leave balance: % day(s) remaining, % day(s) requested', rem, d;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_leave_request_policy()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lp public.leave_policies%ROWTYPE;
BEGIN
  IF NEW.policy_id IS NULL THEN
    SELECT * INTO lp FROM public.leave_policies
      WHERE company_id = NEW.company_id AND leave_type = NEW.leave_type LIMIT 1;
    IF lp.id IS NULL THEN RAISE EXCEPTION 'This leave type is not configured for your company'; END IF;
    NEW.policy_id := lp.id;
  ELSE
    SELECT * INTO lp FROM public.leave_policies WHERE id = NEW.policy_id;
    IF lp.id IS NULL OR lp.company_id <> NEW.company_id THEN
      RAISE EXCEPTION 'This leave type is not available in your company';
    END IF;
  END IF;
  NEW.leave_type := lp.leave_type;

  IF TG_OP = 'INSERT' AND coalesce(current_setting('app.leave_import', true), 'off') <> 'on' THEN
    IF NOT EXISTS (SELECT 1 FROM public.applicable_leave_types(NEW.user_id) a WHERE a.policy_id = NEW.policy_id) THEN
      RAISE EXCEPTION 'This leave type is not available to you';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_leave_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $wrap$
BEGIN
  IF coalesce(current_setting('app.leave_import', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;
  RETURN public.notify_leave_events_inner(TG_OP, NEW, OLD);
END;
$wrap$;

CREATE OR REPLACE FUNCTION public.import_leave(_rows jsonb, _filename text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_batch uuid;
  r jsonb;
  i int := 0;
  v_ok int := 0; v_skip int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_email text; v_user uuid;
  v_start date; v_end date;
  v_type text; v_policy uuid;
  v_portion day_portion; v_portion_txt text;
  v_status leave_status; v_status_txt text;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'No active company'; END IF;
  IF NOT (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only HR or admin can import leave history';
  END IF;

  PERFORM set_config('app.leave_import', 'on', true);

  INSERT INTO public.import_batches (company_id, kind, filename, total_rows, created_by)
  VALUES (v_company, 'leave', _filename, jsonb_array_length(_rows), auth.uid())
  RETURNING id INTO v_batch;

  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    i := i + 1;
    v_user := NULL; v_policy := NULL; v_start := NULL; v_end := NULL;
    v_email := lower(nullif(trim(r->>'email'), ''));

    IF v_email IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', r->>'email', 'reason', 'Email is required');
      CONTINUE;
    END IF;

    SELECT user_id INTO v_user FROM public.profiles
    WHERE company_id = v_company AND lower(email) = v_email LIMIT 1;
    IF v_user IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'No employee with this email in the company');
      CONTINUE;
    END IF;

    v_type := lower(nullif(trim(r->>'leave_type'), ''));
    IF v_type IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Leave type is required');
      CONTINUE;
    END IF;

    SELECT id INTO v_policy FROM public.leave_policies
    WHERE company_id = v_company
      AND (lower(code) = v_type OR lower(label) = v_type OR lower(leave_type::text) = v_type)
    ORDER BY (lower(code) = v_type) DESC
    LIMIT 1;
    IF v_policy IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Leave type "' || v_type || '" is not configured for this company');
      CONTINUE;
    END IF;

    BEGIN
      v_start := (nullif(trim(r->>'start_date'), ''))::date;
      v_end := COALESCE((nullif(trim(r->>'end_date'), ''))::date, v_start);
    EXCEPTION WHEN others THEN v_start := NULL; v_end := NULL;
    END;
    IF v_start IS NULL OR v_end IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Start or end date is missing or not a valid date');
      CONTINUE;
    END IF;
    IF v_end < v_start THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'End date is before the start date');
      CONTINUE;
    END IF;

    v_portion_txt := lower(replace(coalesce(nullif(trim(r->>'day_portion'), ''), 'full_day'), ' ', '_'));
    v_portion := CASE
      WHEN v_portion_txt IN ('first_half','first','1st_half','morning') THEN 'first_half'
      WHEN v_portion_txt IN ('second_half','second','2nd_half','afternoon') THEN 'second_half'
      WHEN v_portion_txt IN ('full_day','full','fullday','') THEN 'full_day'
      ELSE NULL END::day_portion;
    IF v_portion IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Day portion must be full day, first half or second half');
      CONTINUE;
    END IF;
    IF v_portion <> 'full_day' AND v_start <> v_end THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'A half-day leave must start and end on the same date');
      CONTINUE;
    END IF;

    v_status_txt := lower(coalesce(nullif(trim(r->>'status'), ''), 'approved'));
    v_status := CASE
      WHEN v_status_txt IN ('approved','approve','sanctioned','taken','availed') THEN 'approved'
      WHEN v_status_txt IN ('rejected','reject','declined') THEN 'rejected'
      WHEN v_status_txt IN ('cancelled','canceled') THEN 'cancelled'
      WHEN v_status_txt IN ('pending','applied') THEN 'pending'
      ELSE NULL END::leave_status;
    IF v_status IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Status must be approved, rejected, cancelled or pending');
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.leave_requests (
        company_id, user_id, policy_id, start_date, end_date, day_portion,
        reason, status, manager_status, hr_status, reviewed_at
      ) VALUES (
        v_company, v_user, v_policy, v_start, v_end, v_portion,
        nullif(trim(r->>'reason'), ''), v_status,
        CASE WHEN v_status = 'approved' THEN 'approved' WHEN v_status = 'rejected' THEN 'rejected' ELSE 'pending' END::approval_stage_status,
        CASE WHEN v_status = 'approved' THEN 'approved' WHEN v_status = 'rejected' THEN 'rejected' ELSE 'pending' END::approval_stage_status,
        CASE WHEN v_status IN ('approved','rejected') THEN now() ELSE NULL END
      );
      v_ok := v_ok + 1;
    EXCEPTION WHEN others THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', SQLERRM);
    END;
  END LOOP;

  PERFORM set_config('app.leave_import', 'off', true);

  UPDATE public.import_batches SET imported_rows = v_ok, skipped_rows = v_skip WHERE id = v_batch;

  INSERT INTO public.audit_logs (company_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_company, auth.uid(), 'import_leave', 'import_batch', v_batch,
    jsonb_build_object('imported', v_ok, 'skipped', v_skip, 'filename', _filename));

  RETURN jsonb_build_object('batch_id', v_batch, 'imported', v_ok, 'skipped', v_skip, 'errors', v_errors);
END;
$$;

REVOKE ALL ON FUNCTION public.import_leave(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_leave(jsonb, text) TO authenticated;
