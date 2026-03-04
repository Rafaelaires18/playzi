-- Phase 7 Migration : Ajout des colonnes pour la création d'activités avec paramètres complets
ALTER TABLE activities
ADD COLUMN variant TEXT,
ADD COLUMN distance FLOAT,
ADD COLUMN pace INTEGER,
ADD COLUMN lat FLOAT,
ADD COLUMN lng FLOAT,
ADD COLUMN description VARCHAR(100),
ADD COLUMN tags JSONB,
ADD COLUMN session_type TEXT;
