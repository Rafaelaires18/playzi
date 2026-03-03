-- Migration 2: Ajout des paramètres Multi-Sports avancés
-- Exécuter ce fichier dans le SQL Editor de Supabase pour mettre à jour la base de données.

-- 1. Ajout de colonnes pour stocker des métriques spécifiques (Running, Vélo)
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS distance NUMERIC; -- en km (ex: 5.5)

ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS pace NUMERIC; -- en secondes par km (ex: 330 pour 5:30/km)

-- 2. Ajout de colonnes génériques et de format (Foot, Padel, Beach Volley)
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'; -- ex: ['5v5', 'Match', 'Détente']

-- 3. Ajout de données textuelles et de localisation
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS description TEXT; -- Description libre par le créateur

ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS lat NUMERIC; -- Coordonnée GPS latitude

ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS lng NUMERIC; -- Coordonnée GPS longitude
