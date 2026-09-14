# Mails moins en spam, notifications dans la plateforme, rendez-vous confirmé par le client, photos en un seul lien

## 1. Tout recevoir directement dans la plateforme (plus de dépendance au mail)

Oui, c'est faisable et c'est même plus fiable. Aujourd'hui, chaque alerte interne partait vers `contacts@irvetechnologie.fr` et **votre messagerie la refuse systématiquement** (plusieurs rejets ces derniers jours) : vous ne receviez donc rien, sans le savoir.

Ce sera remplacé par une **boîte de réception dans l'espace pro** :
- Un menu « Notifications » avec pastille de nombre non lu, visible sur téléphone et ordinateur.
- Y arrivent : devis accepté ou signé, rendez-vous confirmé ou refusé par le client, nouvelle demande, nouveau dossier partenaire, prix révisé proposé par un partenaire, chantier terminé.
- Chaque ligne : date, client, montant si concerné, et un lien direct vers le devis, le chantier ou la demande.
- Marquer comme lu, filtrer par type, historique conservé.
- En option, un mail de rappel vers l'adresse de votre choix (à renseigner dans les réglages, modifiable à tout moment) — mais l'outil n'en dépend plus.

## 2. Pourquoi certains mails clients tombent en spam

Le domaine d'envoi est vérifié et signé : rien n'est cassé. Ce qui pénalise la délivrabilité :
- Les rejets répétés de vos propres notifications internes abîment la réputation du domaine ; supprimer ces envois vers une adresse qui les refuse règle la principale cause.
- Emojis dans les objets (« Devis ✅ », « Chantier terminé ✅ »), absence d'adresse de réponse, liens multiples de téléchargement : signaux classiques de filtrage.

Corrections apportées :
- Objets sobres et explicites, sans emoji, avec numéro de devis ou nom du chantier.
- **Répondre à** réglé sur votre adresse de contact : le client répond directement à vous, plus à une adresse « noreply ».
- Signature complète (IRVE Technologie, marque Borne de l'Ouest, adresse, deux numéros, site) et version texte propre dans chaque message.
- Un seul lien de téléchargement au lieu d'une liste (voir §4).

## 3. Rendez-vous proposé au client, confirmé par lui, visible chez vous

- Dans la fiche chantier : bouton **« Envoyer la proposition de rendez-vous »** après avoir choisi date et heure — envoi sur votre validation, jamais automatique.
- Le client reçoit la date, l'adresse, la durée estimée, et deux boutons : **« Je confirme ce rendez-vous »** / **« Ce créneau ne me convient pas »** (avec une ligne pour ses disponibilités).
- Lien privé à son nom, sans compte ni mot de passe, utilisable sur téléphone.
- Côté espace pro : pastille « Proposé le … », « Confirmé le … », « Nouveau créneau demandé », et la réponse arrive dans la boîte de réception du §1.
- Relance en un clic si pas de réponse.

## 4. Retour de travaux : toutes les photos en un seul téléchargement

- Le mail de fin de chantier contient **un seul bouton « Télécharger le dossier photos (ZIP) »**.
- Le fichier reçu contient toutes les photos, nommées lisiblement (`1-borne-posee.jpg`, `4-tableau-electrique.jpg`, …), avec le nom du client et la date dans le nom du fichier.
- Lien valable 30 jours, valable pour le client comme pour le partenaire.
- Vous voyez dans la fiche chantier si le dossier a été téléchargé.

## Détails techniques

- Migration : `rendezvous.public_token` (uuid unique), `rdv_propose_at`, `rdv_confirme_at`, `rdv_refuse_at`, `rdv_client_message`, `photos_zip_downloaded_at` ; nouvelle table `notifications` (`type`, `titre`, `message`, `lien`, `lu_at`, `meta jsonb`) et `app_settings` (adresse de rappel optionnelle). GRANT + RLS `is_staff()` ; aucun accès anon direct — tout passe par server functions/routes.
- Boîte de réception : `src/lib/notifications.functions.ts` (`listNotifications`, `marquerLu`, `marquerToutLu`, helper serveur `creerNotification`) appelé à chaque événement métier (devis accepté/signé, réponse rendez-vous, demande, partenaire, chantier terminé) ; page `src/routes/_authenticated/notifications.index.tsx` + pastille dans `ProShell.tsx` et le tableau de bord.
- E-mails : nouveaux modèles `rdv-proposition.tsx` (+ enregistrement dans `registry.ts`), objets sans emoji sur tous les modèles, `send-email.ts` applique `replyTo` par défaut sur l'adresse de contact.
- Rendez-vous : `planning.functions.ts` → `envoyerPropositionRdv`, `relancerPropositionRdv` ; `src/lib/rdv-public.functions.ts` → `getRdvPublic`, `confirmerRdvPublic`, `refuserRdvPublic` ; page publique `src/routes/rdv.$token.tsx`.
- ZIP : `src/routes/api/public/retour/$.ts` — vérifie le jeton et la validité, télécharge les photos du bucket privé `chantier-photos` via le client admin, assemble un ZIP en mémoire (méthode « store », sans dépendance native incompatible avec le runtime serverless), renvoie `application/zip` en pièce jointe ; `chantier-termine.tsx` et `chantier-archive.tsx` passent au bouton unique.
- Vérifications : Playwright sur la page de confirmation client (mobile 390 + desktop) et sur la boîte de réception, test réel de téléchargement ZIP, contrôle du journal d'envoi.
