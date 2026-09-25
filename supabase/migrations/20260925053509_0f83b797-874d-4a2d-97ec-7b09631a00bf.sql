ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS setup_skipped_at timestamptz, ADD COLUMN IF NOT EXISTS setup_step integer NOT NULL DEFAULT 1;
CREATE OR REPLACE FUNCTION public.save_setup_progress(_step integer, _skip boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cid uuid := public.current_company_id();
BEGIN
  IF _cid IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.companies SET setup_step = GREATEST(1, LEAST(COALESCE(_step, setup_step), 4)),
    setup_skipped_at = CASE WHEN _skip THEN now() ELSE setup_skipped_at END
  WHERE id = _cid;
END $$;
REVOKE EXECUTE ON FUNCTION public.save_setup_progress(integer, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_setup_progress(integer, boolean) TO authenticated;