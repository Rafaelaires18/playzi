-- Phase 36 — Admin users dashboard views
-- Goal: centralize product/admin metrics with one row per user.

CREATE SCHEMA IF NOT EXISTS admin;

DROP VIEW IF EXISTS admin.users_overview;
DROP VIEW IF EXISTS admin.users_engagement;
DROP VIEW IF EXISTS admin.users_moderation;
DROP VIEW IF EXISTS admin.users_growth;
DROP VIEW IF EXISTS admin.admin_users_kpis;
DROP VIEW IF EXISTS admin.kpis_global;
DROP VIEW IF EXISTS admin.admin_users_dashboard;

CREATE VIEW admin.admin_users_dashboard AS
WITH RECURSIVE params AS (
    SELECT
        timezone('utc'::text, now()) AS now_utc,
        date_trunc('week', timezone('utc'::text, now()))::date AS current_week_start
),
activity_involvement AS (
    SELECT a.creator_id AS user_id, a.id AS activity_id
    FROM public.activities a
    WHERE a.creator_id IS NOT NULL
    UNION
    SELECT p.user_id, p.activity_id
    FROM public.participations p
    WHERE p.status = 'confirmé'
),
activity_agg AS (
    SELECT
        ai.user_id,
        COUNT(DISTINCT ai.activity_id) AS involved_activities_total,
        COUNT(DISTINCT ai.activity_id) FILTER (
            WHERE a.start_time <= (SELECT now_utc FROM params)
        ) AS involved_activities_past,
        COUNT(DISTINCT ai.activity_id) FILTER (
            WHERE a.start_time > (SELECT now_utc FROM params)
              AND COALESCE(a.status, '') <> 'annulé'
        ) AS involved_activities_upcoming,
        COUNT(DISTINCT ai.activity_id) FILTER (
            WHERE COALESCE(a.status, '') = 'annulé'
        ) AS involved_activities_cancelled,
        COUNT(DISTINCT ai.activity_id) FILTER (
            WHERE a.start_time <= (SELECT now_utc FROM params)
              AND COALESCE(a.status, '') <> 'annulé'
        ) AS activities_completed_valid
    FROM activity_involvement ai
    JOIN public.activities a ON a.id = ai.activity_id
    GROUP BY ai.user_id
),
created_agg AS (
    SELECT
        a.creator_id AS user_id,
        COUNT(*) AS activities_created_total,
        COUNT(*) FILTER (WHERE COALESCE(a.status, '') = 'annulé') AS activities_created_cancelled
    FROM public.activities a
    WHERE a.creator_id IS NOT NULL
    GROUP BY a.creator_id
),
joined_agg AS (
    SELECT
        p.user_id,
        COUNT(*) FILTER (WHERE p.status = 'confirmé') AS activities_joined_total
    FROM public.participations p
    GROUP BY p.user_id
),
connection_agg AS (
    SELECT
        c.user_id,
        COUNT(*) AS connections_total
    FROM (
        SELECT user_a AS user_id FROM public.user_connections
        UNION ALL
        SELECT user_b AS user_id FROM public.user_connections
    ) c
    GROUP BY c.user_id
),
invitation_agg AS (
    SELECT
        inviter_id AS user_id,
        COUNT(*) AS invitations_sent_total,
        COUNT(*) FILTER (WHERE status = 'accepted') AS invitations_sent_accepted,
        COUNT(*) FILTER (WHERE status = 'declined') AS invitations_sent_declined,
        COUNT(*) FILTER (WHERE status = 'expired') AS invitations_sent_expired,
        COUNT(*) FILTER (WHERE status = 'pending') AS invitations_sent_pending
    FROM public.activity_invitations
    GROUP BY inviter_id
),
invitation_received_agg AS (
    SELECT
        invitee_id AS user_id,
        COUNT(*) AS invitations_received_total,
        COUNT(*) FILTER (WHERE status = 'accepted') AS invitations_received_accepted,
        COUNT(*) FILTER (WHERE status = 'declined') AS invitations_received_declined,
        COUNT(*) FILTER (WHERE status = 'expired') AS invitations_received_expired,
        COUNT(*) FILTER (WHERE status = 'pending') AS invitations_received_pending
    FROM public.activity_invitations
    GROUP BY invitee_id
),
pulse_agg AS (
    SELECT
        put.user_id,
        COALESCE(put.total_pulse, 0)::integer AS pulse_total
    FROM public.pulse_user_totals put
),
reward_agg AS (
    SELECT
        ps.user_id,
        COUNT(*) FILTER (
            WHERE EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(ps.breakdown, '[]'::jsonb)) line
                WHERE (line->>'claim_state') = 'pending'
                  AND COALESCE((line->>'signed_points')::numeric, 0) > 0
            )
        ) AS rewards_pending_count,
        COUNT(*) FILTER (
            WHERE EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(ps.breakdown, '[]'::jsonb)) line
                WHERE (line->>'claim_state') = 'applied'
                  AND COALESCE((line->>'signed_points')::numeric, 0) > 0
            )
        ) AS rewards_claimed_count
    FROM public.pulse_summaries ps
    GROUP BY ps.user_id
),
feedback_agg AS (
    SELECT
        af.reviewer_id AS user_id,
        COUNT(*) AS feedbacks_given_total,
        COUNT(*) FILTER (WHERE af.reviewed_user_id IS NULL) AS feedbacks_given_global
    FROM public.activity_feedback af
    GROUP BY af.reviewer_id
),
feedback_expected AS (
    SELECT
        ai.user_id,
        COUNT(DISTINCT ai.activity_id) FILTER (
            WHERE a.start_time <= (SELECT now_utc FROM params)
              AND COALESCE(a.status, '') <> 'annulé'
        ) AS feedbacks_expected_global
    FROM activity_involvement ai
    JOIN public.activities a ON a.id = ai.activity_id
    GROUP BY ai.user_id
),
latest_moderation_status AS (
    SELECT DISTINCT ON (mus.user_id)
        mus.user_id,
        mus.season_id,
        mus.moderation_level,
        mus.incident_count,
        mus.chat_restricted_until,
        mus.suspended_until,
        mus.updated_at
    FROM public.moderation_user_status mus
    ORDER BY mus.user_id, mus.updated_at DESC
),
support_agg AS (
    SELECT
        sr.user_id,
        COUNT(*) AS support_reports_total,
        COUNT(*) FILTER (WHERE sr.status = 'new') AS support_reports_new
    FROM public.support_reports sr
    GROUP BY sr.user_id
),
blocks_agg AS (
    SELECT
        b.user_id,
        COUNT(*) FILTER (WHERE b.kind = 'blocked_by_me') AS users_blocked_count,
        COUNT(*) FILTER (WHERE b.kind = 'blocked_me') AS blocked_by_users_count
    FROM (
        SELECT blocker_user_id AS user_id, 'blocked_by_me'::text AS kind
        FROM public.user_blocks
        UNION ALL
        SELECT blocked_user_id AS user_id, 'blocked_me'::text AS kind
        FROM public.user_blocks
    ) b
    GROUP BY b.user_id
),
last_activity_agg AS (
    SELECT
        p.id AS user_id,
        GREATEST(
            COALESCE((SELECT MAX(a.created_at) FROM public.activities a WHERE a.creator_id = p.id), 'epoch'::timestamptz),
            COALESCE((SELECT MAX(pp.created_at) FROM public.participations pp WHERE pp.user_id = p.id), 'epoch'::timestamptz),
            COALESCE((SELECT MAX(pt.created_at) FROM public.pulse_transactions pt WHERE pt.user_id = p.id), 'epoch'::timestamptz)
        ) AS last_activity_at
    FROM public.profiles p
),
valid_user_weeks AS (
    SELECT DISTINCT
        ai.user_id,
        date_trunc('week', a.start_time)::date AS week_start
    FROM activity_involvement ai
    JOIN public.activities a ON a.id = ai.activity_id
    WHERE a.start_time <= (SELECT now_utc FROM params)
      AND COALESCE(a.status, '') <> 'annulé'
),
streak_seed AS (
    SELECT
        p.id AS user_id,
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM valid_user_weeks vuw
                WHERE vuw.user_id = p.id
                  AND vuw.week_start = (SELECT current_week_start FROM params)
            )
            THEN (SELECT current_week_start FROM params)
            ELSE ((SELECT current_week_start FROM params) - INTERVAL '7 day')::date
        END AS cursor_week
    FROM public.profiles p
),
streak_walk AS (
    SELECT
        ss.user_id,
        ss.cursor_week::date AS cursor_week,
        0::integer AS streak_count
    FROM streak_seed ss
    UNION ALL
    SELECT
        sw.user_id,
        (sw.cursor_week - INTERVAL '7 day')::date AS cursor_week,
        sw.streak_count + 1
    FROM streak_walk sw
    JOIN valid_user_weeks vuw
      ON vuw.user_id = sw.user_id
     AND vuw.week_start = sw.cursor_week
),
streak_agg AS (
    SELECT
        sw.user_id,
        MAX(sw.streak_count) AS streak_weeks_current
    FROM streak_walk sw
    GROUP BY sw.user_id
)
SELECT
    p.id AS user_id,
    p.pseudo AS pseudo,
    au.email AS email,
    p.first_name AS first_name,
    p.last_name AS last_name,
    p.gender AS profile_gender,
    p.birth_date AS birth_date,
    CASE
        WHEN p.age_verification_status = 'verified_adult' THEN 'verified_adult'
        WHEN p.age_verification_status = 'blocked_minor' THEN 'blocked_minor'
        ELSE 'non_verified'
    END AS age_status,
    p.age_verified_at AS age_verified_at,
    au.created_at AS account_created_at,
    au.last_sign_in_at AS last_sign_in_at,
    NULLIF(la.last_activity_at, 'epoch'::timestamptz) AS last_activity_at,
    COALESCE(ca.activities_created_total, 0) AS activities_created_total,
    COALESCE(ja.activities_joined_total, 0) AS activities_joined_total,
    COALESCE(aa.activities_completed_valid, 0) AS activities_completed_valid,
    COALESCE(aa.involved_activities_cancelled, 0) AS activities_cancelled_total,
    COALESCE(aa.involved_activities_past, 0) AS activities_past_total,
    COALESCE(aa.involved_activities_upcoming, 0) AS activities_upcoming_total,
    COALESCE(pa.pulse_total, 0) AS pulse_total,
    CASE
        WHEN COALESCE(pa.pulse_total, 0) >= 900 THEN 'Platine'
        WHEN COALESCE(pa.pulse_total, 0) >= 800 THEN 'Or I'
        WHEN COALESCE(pa.pulse_total, 0) >= 700 THEN 'Or II'
        WHEN COALESCE(pa.pulse_total, 0) >= 600 THEN 'Or III'
        WHEN COALESCE(pa.pulse_total, 0) >= 500 THEN 'Argent I'
        WHEN COALESCE(pa.pulse_total, 0) >= 400 THEN 'Argent II'
        WHEN COALESCE(pa.pulse_total, 0) >= 300 THEN 'Argent III'
        WHEN COALESCE(pa.pulse_total, 0) >= 200 THEN 'Bronze I'
        WHEN COALESCE(pa.pulse_total, 0) >= 100 THEN 'Bronze II'
        ELSE 'Bronze III'
    END AS rank_current,
    COALESCE(sa.streak_weeks_current, 0) AS streak_weeks_current,
    COALESCE(ra.rewards_claimed_count, 0) AS rewards_claimed_count,
    COALESCE(ra.rewards_pending_count, 0) AS rewards_pending_count,
    COALESCE(fa.feedbacks_given_total, 0) AS feedbacks_given_total,
    GREATEST(COALESCE(fe.feedbacks_expected_global, 0) - COALESCE(fa.feedbacks_given_global, 0), 0) AS feedbacks_missing_global,
    COALESCE(coa.connections_total, 0) AS connections_total,
    COALESCE(ia.invitations_sent_total, 0) AS invitations_sent_total,
    COALESCE(ia.invitations_sent_accepted, 0) AS invitations_sent_accepted,
    COALESCE(ia.invitations_sent_declined, 0) AS invitations_sent_declined,
    COALESCE(ia.invitations_sent_expired, 0) AS invitations_sent_expired,
    COALESCE(ir.invitations_received_total, 0) AS invitations_received_total,
    COALESCE(ir.invitations_received_accepted, 0) AS invitations_received_accepted,
    COALESCE(ir.invitations_received_declined, 0) AS invitations_received_declined,
    COALESCE(ir.invitations_received_expired, 0) AS invitations_received_expired,
    COALESCE(ms.moderation_level, 'none') AS moderation_level,
    ms.season_id AS moderation_season_id,
    COALESCE(ms.incident_count, 0) AS moderation_incident_count,
    ms.chat_restricted_until AS chat_restricted_until,
    ms.suspended_until AS suspended_until,
    COALESCE(ba.users_blocked_count, 0) AS users_blocked_count,
    COALESCE(ba.blocked_by_users_count, 0) AS blocked_by_users_count,
    COALESCE(sa2.support_reports_total, 0) AS support_reports_total,
    COALESCE(sa2.support_reports_new, 0) AS support_reports_new,
    CASE
        WHEN p.age_verification_status = 'blocked_minor' THEN 'blocked_minor'
        WHEN ms.suspended_until IS NOT NULL AND ms.suspended_until > (SELECT now_utc FROM params) THEN 'suspended'
        WHEN ms.chat_restricted_until IS NOT NULL AND ms.chat_restricted_until > (SELECT now_utc FROM params) THEN 'chat_restricted'
        ELSE 'active'
    END AS account_status
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.id
LEFT JOIN created_agg ca ON ca.user_id = p.id
LEFT JOIN joined_agg ja ON ja.user_id = p.id
LEFT JOIN activity_agg aa ON aa.user_id = p.id
LEFT JOIN pulse_agg pa ON pa.user_id = p.id
LEFT JOIN reward_agg ra ON ra.user_id = p.id
LEFT JOIN feedback_agg fa ON fa.user_id = p.id
LEFT JOIN feedback_expected fe ON fe.user_id = p.id
LEFT JOIN connection_agg coa ON coa.user_id = p.id
LEFT JOIN invitation_agg ia ON ia.user_id = p.id
LEFT JOIN invitation_received_agg ir ON ir.user_id = p.id
LEFT JOIN latest_moderation_status ms ON ms.user_id = p.id
LEFT JOIN blocks_agg ba ON ba.user_id = p.id
LEFT JOIN support_agg sa2 ON sa2.user_id = p.id
LEFT JOIN last_activity_agg la ON la.user_id = p.id
LEFT JOIN streak_agg sa ON sa.user_id = p.id;

COMMENT ON VIEW admin.admin_users_dashboard IS
'Playzi admin dashboard: one row per user with identity, usage, engagement, social and moderation KPIs.';

CREATE VIEW admin.users_overview AS
SELECT
    user_id,
    pseudo,
    email,
    age_status,
    account_status,
    rank_current,
    pulse_total,
    streak_weeks_current,
    activities_created_total,
    activities_joined_total,
    connections_total,
    last_activity_at
FROM admin.admin_users_dashboard;

COMMENT ON VIEW admin.users_overview IS
'Playzi admin overview: compact one-row-per-user operational view.';

CREATE VIEW admin.users_engagement AS
SELECT
    user_id,
    pseudo,
    email,
    activities_completed_valid,
    activities_past_total,
    activities_upcoming_total,
    invitations_sent_total,
    invitations_sent_accepted,
    invitations_received_total,
    rewards_claimed_count,
    rewards_pending_count,
    feedbacks_given_total,
    feedbacks_missing_global
FROM admin.admin_users_dashboard;

COMMENT ON VIEW admin.users_engagement IS
'Playzi admin engagement view: activity, invitation, rewards and feedback behavior.';

CREATE VIEW admin.users_moderation AS
SELECT
    user_id,
    pseudo,
    email,
    moderation_level,
    moderation_incident_count,
    suspended_until,
    chat_restricted_until,
    users_blocked_count,
    blocked_by_users_count,
    support_reports_total,
    support_reports_new
FROM admin.admin_users_dashboard;

COMMENT ON VIEW admin.users_moderation IS
'Playzi admin moderation view: safety, sanctions, blocks and support signal summary.';

CREATE VIEW admin.users_growth AS
SELECT
    user_id,
    pseudo,
    email,
    account_created_at,
    last_sign_in_at,
    last_activity_at,
    age_status
FROM admin.admin_users_dashboard;

COMMENT ON VIEW admin.users_growth IS
'Playzi admin growth view: acquisition and retention oriented timestamps and age verification status.';

CREATE VIEW admin.admin_users_kpis AS
WITH users AS (
    SELECT * FROM admin.admin_users_dashboard
)
SELECT
    COUNT(*)::bigint AS users_total,
    COUNT(*) FILTER (WHERE age_status = 'verified_adult')::bigint AS users_verified_18_plus,
    COUNT(*) FILTER (WHERE age_status = 'blocked_minor')::bigint AS users_blocked_minor,
    COUNT(*) FILTER (WHERE age_status = 'non_verified')::bigint AS users_age_not_verified,
    COUNT(*) FILTER (
        WHERE (
            last_sign_in_at >= timezone('utc'::text, now()) - INTERVAL '30 days'
            OR last_activity_at >= timezone('utc'::text, now()) - INTERVAL '30 days'
        )
    )::bigint AS users_active_30d,
    ROUND(AVG(activities_created_total)::numeric, 2) AS avg_activities_created,
    ROUND(AVG(activities_joined_total)::numeric, 2) AS avg_activities_joined,
    ROUND(AVG(pulse_total)::numeric, 2) AS avg_pulse_total,
    ROUND(AVG(streak_weeks_current)::numeric, 2) AS avg_streak_weeks_current,
    SUM(invitations_sent_total)::bigint AS invitations_sent_total,
    SUM(invitations_sent_accepted)::bigint AS invitations_sent_accepted,
    SUM(invitations_sent_declined)::bigint AS invitations_sent_declined,
    SUM(invitations_sent_expired)::bigint AS invitations_sent_expired,
    SUM(rewards_pending_count)::bigint AS rewards_pending_total,
    SUM(rewards_claimed_count)::bigint AS rewards_claimed_total,
    COUNT(*) FILTER (WHERE account_status = 'active')::bigint AS users_account_active,
    COUNT(*) FILTER (WHERE account_status = 'chat_restricted')::bigint AS users_account_chat_restricted,
    COUNT(*) FILTER (WHERE account_status = 'suspended')::bigint AS users_account_suspended
FROM users;

COMMENT ON VIEW admin.admin_users_kpis IS
'Playzi global KPIs view derived from admin.admin_users_dashboard.';
