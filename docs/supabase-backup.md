# Sauvegarde locale Supabase avant purge beta

Le script `scripts/supabase-backup.mjs` cree une sauvegarde locale de :

- toutes les tables metier principales de `public`
- les utilisateurs `auth.users` via l'API admin Supabase
- les fichiers du bucket `avatars`

## Prerequis

Variables d'environnement requises :

- `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Exemple :

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
npm run backup:supabase
```

## Resultat

Le script cree un dossier :

```bash
backups/supabase-YYYY-MM-DDTHH-mm-ss-sssZ/
```

avec :

- `manifest.json`
- `tables/*.json`
- `auth/users.json`
- `storage/avatars/...`

## Limites importantes

- les mots de passe utilisateurs ne sont pas exportables via l'API admin Supabase
- la sauvegarde permet de conserver les donnees applicatives, les metadonnees Auth et les avatars
- pour restaurer integralement les comptes avec leurs mots de passe, il faut un vrai dump/backup cote Supabase
