-- Trigger pour créer automatiquement un profil à l'inscription avec prise en charge OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_pseudo TEXT;
  final_pseudo TEXT;
  counter INTEGER := 0;
  is_unique BOOLEAN := FALSE;
BEGIN
  -- 1. Récupérer le pseudo (classique) ou générer via le nom/email (OAuth)
  base_pseudo := COALESCE(
    new.raw_user_meta_data->>'pseudo',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
    
    -- Nettoyage du pseudo de base (minuscule, retirer espaces et caractères spéciaux)
    base_pseudo := regexp_replace(lower(base_pseudo), '[^a-z0-9_]', '', 'g');
    
    -- Si vraiment vide après nettoyage, utiliser un préfixe par défaut
    IF base_pseudo IS NULL OR base_pseudo = '' THEN
      base_pseudo := 'joueur';
    END IF;

  -- 3. Garantir l'unicité du pseudo
  final_pseudo := base_pseudo;
  WHILE NOT is_unique LOOP
    IF EXISTS (SELECT 1 FROM public.profiles WHERE pseudo = final_pseudo) THEN
      counter := counter + 1;
      final_pseudo := base_pseudo || counter::TEXT;
    ELSE
      is_unique := TRUE;
    END IF;
  END LOOP;

  -- 4. Insérer le nouveau profil
  -- Note : le genre (gender) peut être NULL pour les inscriptions OAuth
  -- Cela sera géré côté front par la page /complete-profile
  INSERT INTO public.profiles (id, pseudo, gender)
  VALUES (
    new.id, 
    final_pseudo, 
    new.raw_user_meta_data->>'gender'
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
