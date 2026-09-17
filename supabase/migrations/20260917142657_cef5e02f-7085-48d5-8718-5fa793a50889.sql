CREATE OR REPLACE FUNCTION public.import_attendance(_rows jsonb, _filename text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid := public.current_company_id();
  v_batch uuid;
  r jsonb;
  i int := 0;
  v_ok int := 0; v_skip int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_email text; v_user uuid; v_date date;
  v_in timestamptz; v_out timestamptz;
  v_in_t text; v_out_t text;
  v_status attendance_status; v_status_txt text;
  v_hours numeric;
  v_shift record;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'No active company'; END IF;
  IF NOT (public.is_hr(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only HR or admin can import attendance';
  END IF;

  PERFORM set_config('app.attendance_write', 'on', true);

  INSERT INTO public.import_batches (company_id, kind, filename, total_rows, created_by)
  VALUES (v_company, 'attendance', _filename, jsonb_array_length(_rows), auth.uid())
  RETURNING id INTO v_batch;

  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    i := i + 1;
    v_email := lower(nullif(trim(r->>'email'), ''));
    v_user := NULL; v_date := NULL; v_in := NULL; v_out := NULL; v_hours := NULL;

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

    BEGIN
      v_date := (nullif(trim(r->>'date'), ''))::date;
    EXCEPTION WHEN others THEN v_date := NULL;
    END;
    IF v_date IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Date is missing or not a valid date');
      CONTINUE;
    END IF;
    IF v_date > CURRENT_DATE THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Date is in the future');
      CONTINUE;
    END IF;

    v_in_t := nullif(trim(r->>'check_in'), '');
    v_out_t := nullif(trim(r->>'check_out'), '');

    BEGIN
      IF v_in_t IS NOT NULL THEN v_in := (v_date::text || ' ' || v_in_t)::timestamptz; END IF;
      IF v_out_t IS NOT NULL THEN v_out := (v_date::text || ' ' || v_out_t)::timestamptz; END IF;
    EXCEPTION WHEN others THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Check-in or check-out time is not valid');
      CONTINUE;
    END;

    IF v_in IS NOT NULL AND v_out IS NOT NULL AND v_out <= v_in THEN
      v_out := v_out + interval '1 day';
    END IF;
    IF v_out IS NOT NULL AND v_in IS NULL THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Check-out given without a check-in');
      CONTINUE;
    END IF;

    v_status_txt := lower(nullif(trim(r->>'status'), ''));
    IF v_status_txt IS NOT NULL AND v_status_txt NOT IN ('present','absent','late') THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Status must be present, absent or late');
      CONTINUE;
    END IF;

    IF v_status_txt IS NULL THEN
      IF v_in IS NULL THEN
        v_status_txt := 'absent';
      ELSE
        SELECT * INTO v_shift FROM public.shift_for(v_user, v_date);
        IF v_shift IS NOT NULL AND v_shift.start_time IS NOT NULL
           AND v_in::time > (v_shift.start_time + make_interval(mins => COALESCE(v_shift.grace_minutes, 0))) THEN
          v_status_txt := 'late';
        ELSE
          v_status_txt := 'present';
        END IF;
      END IF;
    END IF;
    v_status := v_status_txt::attendance_status;

    IF nullif(trim(r->>'working_hours'), '') IS NOT NULL THEN
      BEGIN
        v_hours := (trim(r->>'working_hours'))::numeric;
      EXCEPTION WHEN others THEN v_hours := NULL;
      END;
    END IF;
    IF v_hours IS NULL THEN
      v_hours := CASE WHEN v_in IS NOT NULL AND v_out IS NOT NULL
        THEN round(EXTRACT(EPOCH FROM (v_out - v_in)) / 3600.0, 2) ELSE 0 END;
    END IF;
    IF v_hours < 0 OR v_hours > 24 THEN
      v_skip := v_skip + 1;
      v_errors := v_errors || jsonb_build_object('row', i, 'email', v_email, 'reason', 'Working hours must be between 0 and 24');
      CONTINUE;
    END IF;

    INSERT INTO public.attendance (company_id, user_id, date, check_in, check_out, working_hours, status)
    VALUES (v_company, v_user, v_date, v_in, v_out, v_hours, v_status)
    ON CONFLICT (company_id, user_id, date) DO UPDATE SET
      check_in = EXCLUDED.check_in,
      check_out = EXCLUDED.check_out,
      working_hours = EXCLUDED.working_hours,
      status = EXCLUDED.status,
      updated_at = now();

    v_ok := v_ok + 1;
  END LOOP;

  UPDATE public.import_batches SET imported_rows = v_ok, skipped_rows = v_skip WHERE id = v_batch;
  PERFORM public.log_audit('import', 'attendance', v_batch,
    jsonb_build_object('imported', v_ok, 'skipped', v_skip, 'file', _filename));
  PERFORM set_config('app.attendance_write', 'off', true);

  RETURN jsonb_build_object('batch_id', v_batch, 'imported', v_ok, 'skipped', v_skip, 'errors', v_errors);
END;
$function$;

REVOKE ALL ON FUNCTION public.import_attendance(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_attendance(jsonb, text) TO authenticated;