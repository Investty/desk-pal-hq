-- 1. Lifecycle statuses
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE public.companies ADD CONSTRAINT companies_status_check
  CHECK (status IN ('trial','active','past_due','suspended'));

-- 2. Limits
CREATE TABLE public.company_limits (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  storage_mb_limit integer NOT NULL DEFAULT 1024,
  monthly_notification_limit integer NOT NULL DEFAULT 5000,
  soft_warn_pct integer NOT NULL DEFAULT 90,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_limits TO authenticated;
GRANT ALL ON public.company_limits TO service_role;
ALTER TABLE public.company_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own company limits" ON public.company_limits FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_platform_admin());
CREATE TRIGGER update_company_limits_updated_at BEFORE UPDATE ON public.company_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.company_limits (company_id) SELECT id FROM public.companies;

-- 3. Monthly usage counters
CREATE TABLE public.company_usage_counters (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  notifications_sent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, period_month)
);
GRANT SELECT ON public.company_usage_counters TO authenticated;
GRANT ALL ON public.company_usage_counters TO service_role;
ALTER TABLE public.company_usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own company usage" ON public.company_usage_counters FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_platform_admin());

-- 4. Support (impersonation) sessions
CREATE TABLE public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz
);
GRANT SELECT ON public.impersonation_sessions TO authenticated;
GRANT ALL ON public.impersonation_sessions TO service_role;
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads support sessions" ON public.impersonation_sessions FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- 5. Platform audit log
CREATE TABLE public.platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  company_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_audit_logs TO authenticated;
GRANT ALL ON public.platform_audit_logs TO service_role;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads platform audit" ON public.platform_audit_logs FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- 6. Support-mode helpers
CREATE OR REPLACE FUNCTION public.current_impersonation()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.company_id FROM public.impersonation_sessions s
  WHERE s.admin_user_id = auth.uid() AND s.ended_at IS NULL AND s.expires_at > now()
  ORDER BY s.started_at DESC LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.current_impersonation() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_impersonation() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_support_session()
RETURNS TABLE(company_id uuid, company_name text, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.company_id, c.name, s.expires_at
  FROM public.impersonation_sessions s
  JOIN public.companies c ON c.id = s.company_id
  WHERE s.admin_user_id = auth.uid() AND s.ended_at IS NULL AND s.expires_at > now()
  ORDER BY s.started_at DESC LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.current_support_session() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_support_session() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    public.current_impersonation(),
    (SELECT uac.company_id FROM public.user_active_company uac
      JOIN public.profiles p ON p.user_id = uac.user_id AND p.company_id = uac.company_id
      WHERE uac.user_id = auth.uid() AND p.status = 'active'),
    (SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.status = 'active'
      ORDER BY p.created_at LIMIT 1)
  )
$$;

-- 7. Read-only enforcement during support mode
CREATE OR REPLACE FUNCTION public.block_support_mode_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF public.current_impersonation() IS NOT NULL THEN
    RAISE EXCEPTION 'Support mode is read-only. Exit support mode to make changes.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['announcements','attendance','attendance_flags','attendance_requests',
    'audit_logs','companies','company_features','company_limits','departments','employee_documents',
    'holidays','leave_balances','leave_policies','leave_requests','onboarding_checklists','payslips',
    'performance_cycles','performance_reviews','profiles','salary_structures','user_roles','user_active_company']
  LOOP
    EXECUTE format('CREATE TRIGGER zz_block_support_writes BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.block_support_mode_writes()', t);
  END LOOP;
END $$;

-- 8. Seat limit enforcement
CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE seats int; used int;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN RETURN NEW; END IF;
  SELECT seat_limit INTO seats FROM public.companies WHERE id = NEW.company_id;
  SELECT count(*) INTO used FROM public.profiles WHERE company_id = NEW.company_id AND status = 'active';
  IF seats IS NOT NULL AND used >= seats THEN
    RAISE EXCEPTION 'Seat limit reached for this company (% of % seats used)', used, seats;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_seat_limit_trigger BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit();

-- 9. Document storage limit
ALTER TABLE public.employee_documents ADD COLUMN IF NOT EXISTS file_size_bytes bigint NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.enforce_storage_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE lim_mb int; used_bytes bigint;
BEGIN
  SELECT storage_mb_limit INTO lim_mb FROM public.company_limits WHERE company_id = NEW.company_id;
  IF lim_mb IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(sum(file_size_bytes), 0) INTO used_bytes FROM public.employee_documents WHERE company_id = NEW.company_id;
  IF (used_bytes + COALESCE(NEW.file_size_bytes, 0)) > (lim_mb::bigint * 1048576) THEN
    RAISE EXCEPTION 'Document storage limit of % MB reached for this company', lim_mb;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_storage_limit_trigger BEFORE INSERT ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_limit();

-- 10. Monthly notification cap
CREATE OR REPLACE FUNCTION public.enforce_notification_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE lim int; sent int; p date := date_trunc('month', now())::date;
BEGIN
  SELECT monthly_notification_limit INTO lim FROM public.company_limits WHERE company_id = NEW.company_id;
  IF lim IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.company_usage_counters (company_id, period_month, notifications_sent)
  VALUES (NEW.company_id, p, 0)
  ON CONFLICT (company_id, period_month) DO NOTHING;
  SELECT notifications_sent INTO sent FROM public.company_usage_counters
    WHERE company_id = NEW.company_id AND period_month = p FOR UPDATE;
  IF sent >= lim THEN RETURN NULL; END IF;
  UPDATE public.company_usage_counters SET notifications_sent = notifications_sent + 1, updated_at = now()
    WHERE company_id = NEW.company_id AND period_month = p;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_notification_cap_trigger BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_notification_cap();

-- 11. Owner audit helper
CREATE OR REPLACE FUNCTION public.owner_audit(_action text, _company_id uuid, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.platform_audit_logs (actor_user_id, action, company_id, details)
  VALUES (auth.uid(), _action, _company_id, COALESCE(_details, '{}'::jsonb))
$$;
REVOKE EXECUTE ON FUNCTION public.owner_audit(text, uuid, jsonb) FROM anon, public, authenticated;

-- 12. Owner company list with limits and usage
DROP FUNCTION IF EXISTS public.owner_list_companies();
CREATE FUNCTION public.owner_list_companies()
RETURNS TABLE(id uuid, name text, plan text, status text, seat_limit integer, trial_ends_at date,
  notes text, created_at timestamptz, active_people bigint, removed_people bigint, admins bigint,
  features jsonb, storage_mb_limit integer, monthly_notification_limit integer, soft_warn_pct integer,
  storage_used_mb numeric, notifications_this_month integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.id, c.name, c.plan, c.status, c.seat_limit, c.trial_ends_at, c.notes, c.created_at,
    (SELECT count(*) FROM public.profiles p WHERE p.company_id = c.id AND p.status = 'active'),
    (SELECT count(*) FROM public.profiles p WHERE p.company_id = c.id AND p.status = 'removed'),
    (SELECT count(*) FROM public.user_roles ur WHERE ur.company_id = c.id AND ur.role = 'admin'),
    COALESCE((SELECT jsonb_object_agg(cf.feature_key, cf.is_enabled) FROM public.company_features cf WHERE cf.company_id = c.id), '{}'::jsonb),
    COALESCE(cl.storage_mb_limit, 1024), COALESCE(cl.monthly_notification_limit, 5000), COALESCE(cl.soft_warn_pct, 90),
    ROUND(COALESCE((SELECT sum(ed.file_size_bytes) FROM public.employee_documents ed WHERE ed.company_id = c.id), 0) / 1048576.0, 2),
    COALESCE((SELECT uc.notifications_sent FROM public.company_usage_counters uc
      WHERE uc.company_id = c.id AND uc.period_month = date_trunc('month', now())::date), 0)
  FROM public.companies c
  LEFT JOIN public.company_limits cl ON cl.company_id = c.id
  WHERE public.is_platform_admin()
  ORDER BY c.created_at DESC
$$;
REVOKE EXECUTE ON FUNCTION public.owner_list_companies() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.owner_list_companies() TO authenticated;

-- 13. Owner mutations
CREATE OR REPLACE FUNCTION public.owner_update_company(_company_id uuid, _name text DEFAULT NULL, _plan text DEFAULT NULL,
  _status text DEFAULT NULL, _seat_limit integer DEFAULT NULL, _trial_ends_at date DEFAULT NULL, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE before_row jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT to_jsonb(c) - 'notes' INTO before_row FROM public.companies c WHERE c.id = _company_id;
  UPDATE public.companies SET
    name = COALESCE(NULLIF(trim(_name), ''), name),
    plan = COALESCE(_plan, plan),
    status = COALESCE(_status, status),
    seat_limit = COALESCE(_seat_limit, seat_limit),
    trial_ends_at = COALESCE(_trial_ends_at, trial_ends_at),
    notes = COALESCE(_notes, notes),
    updated_at = now()
  WHERE id = _company_id;
  PERFORM public.owner_audit('company_updated', _company_id, jsonb_build_object(
    'before', before_row,
    'after', jsonb_build_object('name', _name, 'plan', _plan, 'status', _status, 'seat_limit', _seat_limit, 'trial_ends_at', _trial_ends_at)));
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_set_feature(_company_id uuid, _feature_key text, _is_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  INSERT INTO public.company_features (company_id, feature_key, is_enabled)
  VALUES (_company_id, _feature_key, _is_enabled)
  ON CONFLICT (company_id, feature_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = now();
  PERFORM public.owner_audit('feature_toggled', _company_id, jsonb_build_object('feature', _feature_key, 'enabled', _is_enabled));
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_set_limits(_company_id uuid, _seat_limit integer DEFAULT NULL,
  _storage_mb_limit integer DEFAULT NULL, _monthly_notification_limit integer DEFAULT NULL, _soft_warn_pct integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _seat_limit IS NOT NULL THEN
    UPDATE public.companies SET seat_limit = _seat_limit, updated_at = now() WHERE id = _company_id;
  END IF;
  INSERT INTO public.company_limits (company_id, storage_mb_limit, monthly_notification_limit, soft_warn_pct)
  VALUES (_company_id, COALESCE(_storage_mb_limit, 1024), COALESCE(_monthly_notification_limit, 5000), COALESCE(_soft_warn_pct, 90))
  ON CONFLICT (company_id) DO UPDATE SET
    storage_mb_limit = COALESCE(_storage_mb_limit, public.company_limits.storage_mb_limit),
    monthly_notification_limit = COALESCE(_monthly_notification_limit, public.company_limits.monthly_notification_limit),
    soft_warn_pct = COALESCE(_soft_warn_pct, public.company_limits.soft_warn_pct),
    updated_at = now();
  PERFORM public.owner_audit('limits_updated', _company_id, jsonb_build_object(
    'seat_limit', _seat_limit, 'storage_mb_limit', _storage_mb_limit,
    'monthly_notification_limit', _monthly_notification_limit, 'soft_warn_pct', _soft_warn_pct));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.owner_set_limits(uuid, integer, integer, integer, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.owner_set_limits(uuid, integer, integer, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_delete_company(_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cname text;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT name INTO cname FROM public.companies WHERE id = _company_id;
  IF cname IS NULL THEN RAISE EXCEPTION 'Company not found'; END IF;

  DELETE FROM public.attendance_requests WHERE company_id = _company_id;
  DELETE FROM public.attendance_flags WHERE company_id = _company_id;
  DELETE FROM public.attendance WHERE company_id = _company_id;
  DELETE FROM public.leave_requests WHERE company_id = _company_id;
  DELETE FROM public.leave_balances WHERE company_id = _company_id;
  DELETE FROM public.leave_policies WHERE company_id = _company_id;
  DELETE FROM public.payslips WHERE company_id = _company_id;
  DELETE FROM public.salary_structures WHERE company_id = _company_id;
  DELETE FROM public.performance_reviews WHERE company_id = _company_id;
  DELETE FROM public.performance_cycles WHERE company_id = _company_id;
  DELETE FROM public.onboarding_checklists WHERE company_id = _company_id;
  DELETE FROM public.employee_documents WHERE company_id = _company_id;
  DELETE FROM public.announcements WHERE company_id = _company_id;
  DELETE FROM public.holidays WHERE company_id = _company_id;
  DELETE FROM public.notifications WHERE company_id = _company_id;
  DELETE FROM public.audit_logs WHERE company_id = _company_id;
  DELETE FROM public.company_invites WHERE company_id = _company_id;
  DELETE FROM public.user_active_company WHERE company_id = _company_id;
  DELETE FROM public.user_roles WHERE company_id = _company_id;
  UPDATE public.profiles SET manager_id = NULL, functional_manager_id = NULL WHERE company_id = _company_id;
  DELETE FROM public.profiles WHERE company_id = _company_id;
  DELETE FROM public.departments WHERE company_id = _company_id;
  DELETE FROM public.company_features WHERE company_id = _company_id;
  DELETE FROM public.company_limits WHERE company_id = _company_id;
  DELETE FROM public.company_usage_counters WHERE company_id = _company_id;
  DELETE FROM public.impersonation_sessions WHERE company_id = _company_id;
  DELETE FROM public.companies WHERE id = _company_id;

  PERFORM public.owner_audit('company_deleted', NULL, jsonb_build_object('company_id', _company_id, 'name', cname));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.owner_delete_company(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.owner_delete_company(uuid) TO authenticated;

-- 14. Support session control
CREATE OR REPLACE FUNCTION public.owner_start_support(_company_id uuid, _minutes integer DEFAULT 30, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE sid uuid; mins int;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  mins := LEAST(GREATEST(COALESCE(_minutes, 30), 5), 120);
  UPDATE public.impersonation_sessions SET ended_at = now()
    WHERE admin_user_id = auth.uid() AND ended_at IS NULL;
  INSERT INTO public.impersonation_sessions (admin_user_id, company_id, reason, expires_at)
  VALUES (auth.uid(), _company_id, _reason, now() + make_interval(mins => mins))
  RETURNING id INTO sid;
  PERFORM public.owner_audit('support_mode_started', _company_id, jsonb_build_object('minutes', mins, 'reason', _reason));
  RETURN sid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.owner_start_support(uuid, integer, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.owner_start_support(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_end_support()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cid uuid;
BEGIN
  SELECT company_id INTO cid FROM public.impersonation_sessions
    WHERE admin_user_id = auth.uid() AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1;
  UPDATE public.impersonation_sessions SET ended_at = now()
    WHERE admin_user_id = auth.uid() AND ended_at IS NULL;
  IF cid IS NOT NULL THEN
    PERFORM public.owner_audit('support_mode_ended', cid, '{}'::jsonb);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.owner_end_support() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.owner_end_support() TO authenticated;

-- 15. Owner reporting
CREATE OR REPLACE FUNCTION public.owner_audit_log(_company_id uuid DEFAULT NULL, _limit integer DEFAULT 200)
RETURNS TABLE(id uuid, action text, company_id uuid, company_name text, actor_email text, details jsonb, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT l.id, l.action, l.company_id, c.name, u.email::text, l.details, l.created_at
  FROM public.platform_audit_logs l
  LEFT JOIN public.companies c ON c.id = l.company_id
  LEFT JOIN auth.users u ON u.id = l.actor_user_id
  WHERE public.is_platform_admin() AND (_company_id IS NULL OR l.company_id = _company_id)
  ORDER BY l.created_at DESC
  LIMIT LEAST(COALESCE(_limit, 200), 1000)
$$;
REVOKE EXECUTE ON FUNCTION public.owner_audit_log(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.owner_audit_log(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_usage()
RETURNS TABLE(company_id uuid, company_name text, people bigint, attendance_rows bigint, leave_rows bigint,
  payslip_rows bigint, document_rows bigint, storage_mb numeric, rows_last_30d bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.id, c.name,
    (SELECT count(*) FROM public.profiles p WHERE p.company_id = c.id),
    (SELECT count(*) FROM public.attendance a WHERE a.company_id = c.id),
    (SELECT count(*) FROM public.leave_requests lr WHERE lr.company_id = c.id),
    (SELECT count(*) FROM public.payslips ps WHERE ps.company_id = c.id),
    (SELECT count(*) FROM public.employee_documents ed WHERE ed.company_id = c.id),
    ROUND(COALESCE((SELECT sum(ed.file_size_bytes) FROM public.employee_documents ed WHERE ed.company_id = c.id), 0) / 1048576.0, 2),
    (SELECT count(*) FROM public.attendance a WHERE a.company_id = c.id AND a.created_at > now() - interval '30 days')
    + (SELECT count(*) FROM public.leave_requests lr WHERE lr.company_id = c.id AND lr.created_at > now() - interval '30 days')
  FROM public.companies c
  WHERE public.is_platform_admin()
  ORDER BY c.name
$$;
REVOKE EXECUTE ON FUNCTION public.owner_usage() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.owner_usage() TO authenticated;