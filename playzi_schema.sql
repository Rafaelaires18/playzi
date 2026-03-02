-- Schema PostgreSQL pour Playzi

-- Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table Utilisateurs (Profiles) liées à Auth
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  pseudo TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')),
  grade TEXT DEFAULT 'Bronze',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active RLS sur profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs peuvent voir tous les profils"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Utilisateurs peuvent modifier leur propre profil"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger pour créer automatiquement un profil à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, pseudo, gender)
  VALUES (new.id, new.raw_user_meta_data->>'pseudo', new.raw_user_meta_data->>'gender');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Table Activities (Evènements sportifs)
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  sport TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT,
  level TEXT NOT NULL,
  max_attendees INTEGER NOT NULL,
  gender_filter TEXT DEFAULT 'mixte',
  is_unlimited BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'ouvert', -- ouvert, complet, passé, annulé
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut voir les activités"
  ON activities FOR SELECT
  USING (true);

CREATE POLICY "Les utilisateurs connectés peuvent créer des activités"
  ON activities FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Les créateurs peuvent modifier leurs activités"
  ON activities FOR UPDATE
  USING (auth.uid() = creator_id);

-- 3. Table Participations
CREATE TABLE participations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'en_attente', -- en_attente, confirmé, refusé, annulé
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

ALTER TABLE participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut voir les participations"
  ON participations FOR SELECT
  USING (true);

CREATE POLICY "Les utilisateurs peuvent demander à participer"
  ON participations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent se désinscrire ou créateur peut valider/refuser"
  ON participations FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT creator_id FROM activities WHERE id = activity_id));

-- 4. Table Activity Feedback
CREATE TABLE activity_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewed_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  tags TEXT[],
  no_show BOOLEAN DEFAULT false,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, reviewer_id, reviewed_user_id)
);

ALTER TABLE activity_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut voir les feedbacks"
  ON activity_feedback FOR SELECT
  USING (true);

CREATE POLICY "Utilisateurs peuvent laisser un feedback s'ils ont participé"
  ON activity_feedback FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id 
    AND EXISTS (SELECT 1 FROM participations WHERE activity_id = activity_feedback.activity_id AND user_id = auth.uid() AND status = 'confirmé')
    AND EXISTS (SELECT 1 FROM participations WHERE activity_id = activity_feedback.activity_id AND user_id = activity_feedback.reviewed_user_id AND status = 'confirmé')
  );
