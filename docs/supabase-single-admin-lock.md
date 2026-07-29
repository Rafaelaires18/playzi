# Verrou compte admin unique

La migration `supabase_phase51_lock_single_admin_account.sql` verrouille l'acces admin/moderation sur un seul compte.

## Activation

1. Verifier que le compte admin voulu a bien `profiles.grade = 'admin'`.
2. Executer tout le contenu de `supabase_phase51_lock_single_admin_account.sql` dans le SQL Editor Supabase du projet cible.
3. Redéployer l'app pour que les routes admin utilisent uniquement `public.is_moderator()`.

## Verification

```sql
SELECT p.id, p.pseudo, p.grade, aal.locked_at
FROM public.admin_account_lock aal
JOIN public.profiles p ON p.id = aal.user_id;
```

La requete doit retourner exactement le compte admin voulu.

## Effet

- un seul compte peut garder un grade `admin`, `moderator`, `moderation` ou `mod`
- toute tentative de donner un grade admin a un autre profil est bloquee
- les variables Vercel `MODERATION_ADMIN_EMAILS`, `ADMIN_EMAILS` et `MODERATION_ADMIN_USER_IDS` ne donnent plus l'acces admin dans l'app
