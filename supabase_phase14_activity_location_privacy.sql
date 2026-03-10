-- Phase 14 — Activity location privacy (public vs exact)

-- Public location fields are safe for non-confirmed users.
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS public_location TEXT,
ADD COLUMN IF NOT EXISTS public_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS public_lng DOUBLE PRECISION;

-- Private location table: exact data only for creator + confirmed participants.
CREATE TABLE IF NOT EXISTS public.activity_private_locations (
  activity_id UUID PRIMARY KEY REFERENCES public.activities(id) ON DELETE CASCADE,
  exact_address TEXT,
  exact_lat DOUBLE PRECISION,
  exact_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill with safe defaults from existing fields.
UPDATE public.activities
SET public_location = COALESCE(NULLIF(public_location, ''), location)
WHERE public_location IS NULL OR public_location = '';

-- Round exact coordinates to ~1km precision for public map pins.
UPDATE public.activities
SET public_lat = ROUND(lat::numeric, 2)::double precision
WHERE lat IS NOT NULL AND public_lat IS NULL;

UPDATE public.activities
SET public_lng = ROUND(lng::numeric, 2)::double precision
WHERE lng IS NOT NULL AND public_lng IS NULL;

-- Move exact data to private table.
INSERT INTO public.activity_private_locations (activity_id, exact_address, exact_lat, exact_lng)
SELECT id, address, lat, lng
FROM public.activities
ON CONFLICT (activity_id) DO UPDATE
SET
  exact_address = EXCLUDED.exact_address,
  exact_lat = EXCLUDED.exact_lat,
  exact_lng = EXCLUDED.exact_lng,
  updated_at = now();

-- Keep only approximate/public values in public.activities.
UPDATE public.activities
SET
  address = NULL,
  lat = COALESCE(public_lat, lat),
  lng = COALESCE(public_lng, lng);

ALTER TABLE public.activity_private_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators can read private locations" ON public.activity_private_locations;
CREATE POLICY "Creators can read private locations"
ON public.activity_private_locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.activities a
    WHERE a.id = activity_id
      AND a.creator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Confirmed participants can read private locations" ON public.activity_private_locations;
CREATE POLICY "Confirmed participants can read private locations"
ON public.activity_private_locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.participations p
    JOIN public.activities a ON a.id = p.activity_id
    WHERE p.activity_id = activity_id
      AND p.user_id = auth.uid()
      AND p.status = 'confirmé'
      AND (
        (
          translate(lower(a.sport), 'éèêëàâäîïôöùûüç', 'eeeeaaaiioouuuc')
          IN ('running', 'footing', 'velo', 'cycling')
          AND now() >= (a.start_time - interval '24 hours')
        )
        OR
        (
          translate(lower(a.sport), 'éèêëàâäîïôöùûüç', 'eeeeaaaiioouuuc')
          IN ('football', 'foot', 'beach volley', 'beach-volley', 'beachvolley')
          AND (a.status = 'confirmé' OR a.status = 'complet')
        )
        OR
        (
          translate(lower(a.sport), 'éèêëàâäîïôöùûüç', 'eeeeaaaiioouuuc')
          NOT IN ('running', 'footing', 'velo', 'cycling', 'football', 'foot', 'beach volley', 'beach-volley', 'beachvolley')
          AND (a.status = 'confirmé' OR a.status = 'complet')
        )
      )
  )
);

DROP POLICY IF EXISTS "Creators can write private locations" ON public.activity_private_locations;
CREATE POLICY "Creators can write private locations"
ON public.activity_private_locations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.activities a
    WHERE a.id = activity_id
      AND a.creator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Creators can update private locations" ON public.activity_private_locations;
CREATE POLICY "Creators can update private locations"
ON public.activity_private_locations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.activities a
    WHERE a.id = activity_id
      AND a.creator_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.activities a
    WHERE a.id = activity_id
      AND a.creator_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Creators can delete private locations" ON public.activity_private_locations;
CREATE POLICY "Creators can delete private locations"
ON public.activity_private_locations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.activities a
    WHERE a.id = activity_id
      AND a.creator_id = auth.uid()
  )
);
