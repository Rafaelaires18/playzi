# Playzi — Reset Password Setup (Supabase)

Ce guide configure un flow de reinitialisation stable sur mobile et personnalise l'email.

## 1) URLs Supabase Auth (obligatoire)

Dans `Supabase Dashboard -> Authentication -> URL Configuration`:

- `Site URL`:
  - `https://playzi-rosy.vercel.app`
- `Redirect URLs` (ajouter au minimum):
  - `https://playzi-rosy.vercel.app/reset-password`
  - `https://playzi-rosy.vercel.app/auth/confirm` (optionnel legacy)
  - `http://localhost:3000/auth/confirm` (dev local uniquement)
  - `http://localhost:3000/reset-password` (dev local uniquement)

Important:
- En production, ne pas laisser `Site URL` sur `localhost`.
- Les liens email doivent pointer vers le domaine public Playzi.

## 2) Sujet de l'email

Dans `Supabase Dashboard -> Authentication -> Email Templates -> Reset Password`:

- Subject:
  - `Reinitialise ton mot de passe Playzi`

## 3) Template HTML (Reset Password)

Template final pret a coller dans Supabase:

- [supabase_reset_password_email.html](/Users/rafael/Documents/Playzi/supabase_reset_password_email.html)

## 4) Rappel technique cote app

Le backend Playzi utilise:

- `POST /api/auth/password/forgot`
- `redirectTo = {base_url}/reset-password?recovery=1`

La page `/reset-password` charge la session de recuperation depuis le hash de l'URL.
