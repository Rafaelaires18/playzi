# Full reset Supabase pour lancement beta

Le script `scripts/supabase-full-reset.mjs` effectue un reset complet en utilisant l'API Supabase avec la `service role`.

Il :

- supprime tous les fichiers du bucket `avatars`
- supprime tous les utilisateurs `auth.users`
- laisse PostgreSQL supprimer en cascade les `profiles` et les donnees liees
- repart de zero pour le titre `Bêta testeur` : apres application de `supabase_phase50_auto_beta_tester_titles.sql`, les 30 premiers nouveaux profils crees recevront automatiquement ce titre

## Prerequis

- avoir valide la sauvegarde locale
- avoir applique `supabase_phase50_auto_beta_tester_titles.sql` pour activer l'attribution automatique du titre beta
- disposer de :
  - `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Execution

```bash
cd /Users/rafael/Documents/Playzi

SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
npm run reset:supabase:full
```

## Effet

- tous les comptes sont supprimes
- toutes les donnees utilisateurs et metier liees sont supprimees
- le bucket `avatars` est vide
- le schema, les tables, policies, fonctions et migrations restent en place
- les anciens comptes de test ne gardent pas le titre, car ils sont supprimes avec les comptes Auth
- les 30 premiers vrais utilisateurs inscrits apres le reset obtiennent `Bêta testeur`
- l'historique technique `beta_tester_title_grants` est vide, donc les 30 slots beta repartent de zero

## Verification

Apres avoir applique `supabase_phase50_auto_beta_tester_titles.sql`, verifier l'etat avec :

```bash
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
npm run status:supabase:beta-titles
```

Si la sortie affiche `Profils total: 0`, les 30 prochains inscrits recevront le titre.

## Attention

Operation destructive. A ne lancer qu'une seule fois apres verification de la sauvegarde.
