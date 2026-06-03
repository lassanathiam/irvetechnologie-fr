## Goal
Persister chaque soumission du formulaire `/demande` dans la base Lovable Cloud, sans authentification (formulaire public).

## Étapes

### 1. Créer la table `demande_requests`
Migration Postgres avec :
- Champs coordonnées : `nom`, `email`, `telephone`, `code_postal`
- Champs projet : `type_bien`, `puissance`, `type_installation`, `distance_m`, `notes`
- Formule éventuelle (`essentiel` / `confort` / `pro` / null)
- `status` (`nouveau` par défaut)
- `created_at` / `updated_at`
- RLS activée :
  - INSERT autorisé pour `anon` et `authenticated` (formulaire public)
  - SELECT/UPDATE/DELETE réservés au `service_role` (admin via Cloud)
- GRANT : `INSERT` à `anon` + `authenticated`, `ALL` à `service_role`

Les photos ne sont **pas** stockées dans cette première version (elles restent locales côté navigateur). On peut ajouter Storage dans une étape suivante si vous le souhaitez.

### 2. Server function `submitDemande`
Fichier `src/lib/demande.functions.ts` :
- `createServerFn({ method: "POST" })`
- `inputValidator` avec Zod (longueurs max, email, formule optionnelle, etc.)
- Handler : insère la ligne avec `supabaseAdmin` (dynamic import inside handler) et renvoie `{ ok: true, id }`
- Erreurs renvoyées proprement (pas de stack brute)

### 3. Brancher le formulaire
Dans `src/routes/demande.tsx` :
- `useServerFn(submitDemande)`
- `onSubmit` : `e.preventDefault()`, lire les champs via `FormData`, appeler la server fn, afficher l'état de chargement, gérer les erreurs (toast)
- En cas de succès : conserver l'écran "Demande reçue" actuel
- En cas d'échec : afficher un message d'erreur sous le bouton et permettre une nouvelle tentative

### 4. Pas de changement UI majeur
La mise en page, les couleurs, la galerie photos, le bandeau formule restent identiques. Seul le comportement de soumission change.

## Hors scope (à confirmer si vous le voulez plus tard)
- Upload des photos vers Cloud Storage
- Notification email à l'équipe
- Page d'administration pour consulter les demandes