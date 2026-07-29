-- Supprime uniquement 2 comptes Auth cassés.
-- Remplace les 2 emails ci-dessous, puis exécute tout le bloc dans Supabase SQL Editor.
-- Important: ne mets pas l'email du compte admin.

DO $$
DECLARE
    target_emails TEXT[] := ARRAY[
        'email_casse_1@gmail.com',
        'email_casse_2@gmail.com'
    ];
    normalized_emails TEXT[];
    matched_count INTEGER;
    deleted_count INTEGER;
BEGIN
    SELECT ARRAY(
        SELECT DISTINCT LOWER(TRIM(email))
        FROM UNNEST(target_emails) AS email
        WHERE TRIM(email) <> ''
          AND email NOT ILIKE 'email_casse_%'
    )
    INTO normalized_emails;

    IF ARRAY_LENGTH(normalized_emails, 1) IS DISTINCT FROM 2 THEN
        RAISE EXCEPTION 'Remplace les 2 emails placeholders par les 2 vrais emails cassés.';
    END IF;

    IF 'playzi_admin' = ANY(normalized_emails)
       OR 'admin@playzi.ch' = ANY(normalized_emails)
       OR 'hello@playzi.ch' = ANY(normalized_emails) THEN
        RAISE EXCEPTION 'Suppression bloquée: un email admin est dans la liste.';
    END IF;

    SELECT COUNT(*)
    INTO matched_count
    FROM auth.users
    WHERE LOWER(email) = ANY(normalized_emails);

    IF matched_count <> 2 THEN
        RAISE EXCEPTION 'Suppression bloquée: % compte(s) trouvé(s), attendu: 2.', matched_count;
    END IF;

    DELETE FROM auth.users
    WHERE LOWER(email) = ANY(normalized_emails);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count <> 2 THEN
        RAISE EXCEPTION 'Suppression inattendue: % compte(s) supprimé(s), attendu: 2.', deleted_count;
    END IF;

    RAISE NOTICE 'OK: 2 comptes Auth cassés supprimés.';
END $$;
