-- Phase 45 — Remove SECURITY DEFINER behavior from Pulse totals view

CREATE OR REPLACE VIEW public.pulse_user_totals
WITH (security_invoker = true) AS
SELECT
    user_id,
    COALESCE(SUM(signed_points), 0)::INTEGER AS total_pulse
FROM public.pulse_transactions
GROUP BY user_id;
