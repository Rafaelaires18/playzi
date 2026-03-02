-- Migration 1: Ajouter les colonnes spécifiques pour les différents sports (Running, Vélo, etc)

ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS distance DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS pace INTEGER,
ADD COLUMN IF NOT EXISTS lat DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS lng DECIMAL(11,8),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[];
