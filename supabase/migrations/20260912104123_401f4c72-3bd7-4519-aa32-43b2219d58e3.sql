-- PLANS
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  monthly_price numeric NOT NULL DEFAULT 0,
  annual_price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  included_seats integer NOT NULL DEFAULT 25,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read plans" ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage plans" ON public.plans FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plans (key, name, description, monthly_price, annual_price, included_seats, sort_order) VALUES
  ('free', 'Free', 'Evaluation and very small teams', 0, 0, 10, 1),
  ('starter', 'Starter', 'Growing teams getting started', 2999, 29990, 25, 2),
  ('pro', 'Growth', 'Established companies with full HR needs', 7999, 79990, 100, 3),
  ('enterprise', 'Enterprise', 'Large organisations, bespoke contracts', 19999, 199990, 500, 4);

-- COMPANY BILLING
ALTER TABLE public.companies
  ADD COLUMN billing_interval text NOT NULL DEFAULT 'monthly',
  ADD COLUMN custom_price numeric,
  ADD COLUMN plan_started_at date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN churned_at date;

-- BROADCASTS
CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  audience text NOT NULL DEFAULT 'admins',
  is_published boolean NOT NULL DEFAULT false,
  publish_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users read live broadcasts" ON public.broadcasts FOR SELECT TO authenticated
  USING (
    is_published
    AND publish_at <= now()
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      audience = 'everyone'
      OR (audience = 'admins' AND (public.has_role(auth.uid(), 'admin') OR public.is_hr(auth.uid())))
    )
  );
CREATE POLICY "Platform admins manage broadcasts" ON public.broadcasts FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER update_broadcasts_updated_at BEFORE UPDATE ON public.broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.broadcast_reads (
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (broadcast_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.broadcast_reads TO authenticated;
GRANT ALL ON public.broadcast_reads TO service_role;
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own broadcast reads" ON public.broadcast_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- OWNER RPCS
CREATE OR REPLACE FUNCTION public.owner_list_plans()
RETURNS TABLE(id uuid, key text, name text, description text, monthly_price numeric, annual_price numeric,
              currency text, included_seats integer, is_active boolean, sort_order integer, companies bigint, mrr numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.key, p.name, p.description, p.monthly_price, p.annual_price, p.currency,
         p.included_seats, p.is_active, p.sort_order,
         (SELECT count(*) FROM companies c WHERE c.plan = p.key AND c.status IN ('active','trial','past_due')),
         (SELECT COALESCE(sum(CASE WHEN c.custom_price IS NOT NULL
                                   THEN (CASE WHEN c.billing_interval = 'annual' THEN c.custom_price / 12 ELSE c.custom_price END)
                                   WHEN c.billing_interval = 'annual' THEN p.annual_price / 12
                                   ELSE p.monthly_price END), 0)
          FROM companies c WHERE c.plan = p.key AND c.status = 'active')
  FROM plans p
  WHERE is_platform_admin(auth.uid())
  ORDER BY p.sort_order, p.name;
$$;

CREATE OR REPLACE FUNCTION public.owner_upsert_plan(
  _id uuid, _key text, _name text, _description text, _monthly_price numeric,
  _annual_price numeric, _currency text, _included_seats integer, _is_active boolean, _sort_order integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _id IS NULL THEN
    INSERT INTO plans (key, name, description, monthly_price, annual_price, currency, included_seats, is_active, sort_order)
    VALUES (lower(trim(_key)), _name, _description, _monthly_price, _annual_price, COALESCE(_currency,'INR'),
            _included_seats, COALESCE(_is_active,true), COALESCE(_sort_order,0))
    RETURNING id INTO v_id;
    PERFORM owner_audit('plan_created', NULL, jsonb_build_object('key', _key, 'monthly_price', _monthly_price));
  ELSE
    UPDATE plans SET name = _name, description = _description, monthly_price = _monthly_price,
      annual_price = _annual_price, currency = COALESCE(_currency, currency),
      included_seats = _included_seats, is_active = COALESCE(_is_active, is_active),
      sort_order = COALESCE(_sort_order, sort_order)
    WHERE id = _id RETURNING id INTO v_id;
    PERFORM owner_audit('plan_updated', NULL, jsonb_build_object('key', _key, 'monthly_price', _monthly_price));
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.owner_set_billing(_company_id uuid, _billing_interval text, _custom_price numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE companies SET billing_interval = COALESCE(_billing_interval, billing_interval), custom_price = _custom_price
  WHERE id = _company_id;
  PERFORM owner_audit('billing_updated', _company_id,
    jsonb_build_object('billing_interval', _billing_interval, 'custom_price', _custom_price));
END; $$;

CREATE OR REPLACE FUNCTION public.owner_revenue()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mrr numeric := 0; v_paying int := 0; v_active int := 0; v_trial int := 0;
        v_past_due int := 0; v_churned int := 0; v_seats bigint := 0; v_start int := 0;
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;

  SELECT COALESCE(sum(price),0), count(*) FILTER (WHERE price > 0)
  INTO v_mrr, v_paying
  FROM (
    SELECT CASE WHEN c.custom_price IS NOT NULL
                THEN (CASE WHEN c.billing_interval = 'annual' THEN c.custom_price/12 ELSE c.custom_price END)
                WHEN c.billing_interval = 'annual' THEN COALESCE(p.annual_price,0)/12
                ELSE COALESCE(p.monthly_price,0) END AS price
    FROM companies c LEFT JOIN plans p ON p.key = c.plan
    WHERE c.status = 'active'
  ) s;

  SELECT count(*) FILTER (WHERE status = 'active'), count(*) FILTER (WHERE status = 'trial'),
         count(*) FILTER (WHERE status = 'past_due'),
         count(*) FILTER (WHERE status = 'suspended' AND updated_at > now() - interval '30 days')
  INTO v_active, v_trial, v_past_due, v_churned FROM companies;

  SELECT count(*) INTO v_seats FROM profiles WHERE status = 'active';
  v_start := v_active + v_churned;

  RETURN jsonb_build_object(
    'mrr', round(v_mrr, 2),
    'arr', round(v_mrr * 12, 2),
    'arpu', CASE WHEN v_active > 0 THEN round(v_mrr / v_active, 2) ELSE 0 END,
    'paying_companies', v_paying,
    'active_companies', v_active,
    'trial_companies', v_trial,
    'past_due_companies', v_past_due,
    'churned_30d', v_churned,
    'churn_rate', CASE WHEN v_start > 0 THEN round(v_churned::numeric * 100 / v_start, 1) ELSE 0 END,
    'active_seats', v_seats,
    'revenue_per_seat', CASE WHEN v_seats > 0 THEN round(v_mrr / v_seats, 2) ELSE 0 END
  );
END; $$;

CREATE OR REPLACE FUNCTION public.owner_revenue_by_company()
RETURNS TABLE(company_id uuid, company_name text, plan text, status text, billing_interval text,
              mrr numeric, active_seats bigint, seat_limit integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.plan, c.status, c.billing_interval,
    round(CASE WHEN c.status <> 'active' THEN 0
         WHEN c.custom_price IS NOT NULL
           THEN (CASE WHEN c.billing_interval = 'annual' THEN c.custom_price/12 ELSE c.custom_price END)
         WHEN c.billing_interval = 'annual' THEN COALESCE(p.annual_price,0)/12
         ELSE COALESCE(p.monthly_price,0) END, 2),
    (SELECT count(*) FROM profiles pr WHERE pr.company_id = c.id AND pr.status = 'active'),
    c.seat_limit
  FROM companies c LEFT JOIN plans p ON p.key = c.plan
  WHERE is_platform_admin(auth.uid())
  ORDER BY 6 DESC, c.name;
$$;

CREATE OR REPLACE FUNCTION public.owner_list_broadcasts()
RETURNS SETOF public.broadcasts LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM broadcasts WHERE is_platform_admin(auth.uid()) ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.owner_upsert_broadcast(
  _id uuid, _title text, _body text, _severity text, _audience text,
  _is_published boolean, _publish_at timestamptz, _expires_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _id IS NULL THEN
    INSERT INTO broadcasts (title, body, severity, audience, is_published, publish_at, expires_at, created_by)
    VALUES (_title, _body, COALESCE(_severity,'info'), COALESCE(_audience,'admins'),
            COALESCE(_is_published,false), COALESCE(_publish_at, now()), _expires_at, auth.uid())
    RETURNING id INTO v_id;
    PERFORM owner_audit('broadcast_created', NULL, jsonb_build_object('title', _title, 'published', _is_published));
  ELSE
    UPDATE broadcasts SET title = _title, body = _body, severity = COALESCE(_severity, severity),
      audience = COALESCE(_audience, audience), is_published = COALESCE(_is_published, is_published),
      publish_at = COALESCE(_publish_at, publish_at), expires_at = _expires_at
    WHERE id = _id RETURNING id INTO v_id;
    PERFORM owner_audit('broadcast_updated', NULL, jsonb_build_object('title', _title, 'published', _is_published));
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.owner_delete_broadcast(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  DELETE FROM broadcasts WHERE id = _id;
  PERFORM owner_audit('broadcast_deleted', NULL, jsonb_build_object('id', _id));
END; $$;

CREATE OR REPLACE FUNCTION public.my_broadcasts()
RETURNS TABLE(id uuid, title text, body text, severity text, publish_at timestamptz, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.title, b.body, b.severity, b.publish_at, b.expires_at
  FROM broadcasts b
  WHERE b.is_published AND b.publish_at <= now()
    AND (b.expires_at IS NULL OR b.expires_at > now())
    AND (b.audience = 'everyone'
         OR (b.audience = 'admins' AND (has_role(auth.uid(), 'admin') OR is_hr(auth.uid()))))
    AND NOT EXISTS (SELECT 1 FROM broadcast_reads r WHERE r.broadcast_id = b.id AND r.user_id = auth.uid())
  ORDER BY b.publish_at DESC;
$$;