# Mails moins en spam, rendez-vous confirmé par le client, photos en un seul lien

## 1. Pourquoi certains mails tombent en spam

Le domaine d'envoi est bien vérifié et signé, donc rien n'est cassé. Ce qui pousse les messages vers l'indésirable :

- Les notifications internes envoyées à `contacts@irvetechnologie.fr` sont **refusées par votre hébergeur mail** à chaque fois (plusieurs rejets ces derniers jours). Un domaine dont les envois sont rejetés perd de la réputation, ce qui pénalise aussi les mails clients. Cause probable : votre messagerie refuse un message qui porte votre propre nom de domaine mais arrive d'un autre serveur.
- Des emojis dans les objets (« Devis ✅ », « Chantier terminé ✅ »), pas d'adresse de réponse, et des liens de téléchargement multiples : trois signaux classiques de filtrage.

Ce qui sera fait :
- Objets d'e-mail réécrits sobres et explicites, sans emoji, avec le numéro de devis / le nom du chantier.
- **Répondre à** systématiquement réglé sur `contacts@irvetechnologie.fr` : le client répond à vous, pas à une adresse « noreply ».
- Signature complète en bas de chaque message (société IRVE Technologie, marque Borne de l'Ouest, adresse, deux numéros, site) et version texte propre.
- Notifications internes : envoi vers une **adresse de réception paramétrable**, avec journal visible dans l'espace pro quand un envoi est refusé, pour ne plus perdre d'alerte silencieusement.

Point à valider avec votre hébergeur mail : autoriser la réception des messages venant de `notify.irvetechnologie.fr`. Je vous indiquerai le message d'erreur exact à leur transmettre.

## 2. Rendez-vous proposé au client, confirmé par lui, visible chez vous

Une fois le devis signé, le chantier existe déjà dans le planning. On ajoute dessus :

- Dans la fiche chantier : bouton **« Envoyer la proposition de rendez-vous »** (vous choisissez d'abord la date et l'heure — envoi sur votre validation, jamais automatique).
- Le client reçoit un mail avec la date proposée, l'adresse, la durée estimée, et deux boutons : **« Je confirme ce rendez-vous »** et **« Ce créneau ne me convient pas »**.
- Ces boutons ouvrent une page à son nom (lien privé), sans compte ni mot de passe. S'il refuse, il peut indiquer ses disponibilités en une ligne.
- Côté espace pro : pastille claire sur le chantier — « Proposé le … », « Confirmé par le client le … », « Nouveau créneau demandé » — plus une notification par mail pour vous à chaque réponse.
- Relance possible en un clic si le client n'a pas répondu.

## 3. Retour de travaux : toutes les photos en un seul téléchargement

- Le mail de fin de chantier ne contient plus une liste de liens, mais **un seul bouton « Télécharger le dossier photos (ZIP) »**.
- Le fichier reçu contient toutes les photos du chantier, nommées lisiblement (`1-borne-posee.jpg`, `4-tableau-electrique.jpg`, …) avec le nom du client et la date dans le nom du fichier.
- Le lien reste valable 30 jours, fonctionne sur téléphone comme sur ordinateur, et sert aussi bien au client qu'au partenaire.
- Vous voyez dans la fiche chantier si le dossier a été téléchargé.

## Détails techniques

- Migration : `rendezvous.public_token` (uuid, unique), `rdv_propose_at`, `rdv_confirme_at`, `rdv_refuse_at`, `rdv_client_message`, `photos_zip_downloaded_at`, `notif_email` sur la table de configuration existante ; GRANT + RLS staff, aucun accès anon direct (tout passe par des server functions/routes).
- Nouveau modèle `rdv-proposition.tsx` + `rdv-reponse-interne.tsx` dans `src/lib/email-templates/`, enregistrés dans `registry.ts` ; objets sans emoji sur tous les modèles existants ; `send-email.ts` passe `replyTo` par défaut sur `contacts@irvetechnologie.fr`.
- `planning.functions.ts` : `envoyerPropositionRdv`, `relancerPropositionRdv`. Nouvelles fonctions publiques par jeton dans `src/lib/rdv-public.functions.ts` (`getRdvPublic`, `confirmerRdvPublic`, `refuserRdvPublic`) + page `src/routes/rdv.$token.tsx`.
- Route ZIP : `src/routes/api/public/retour/$.ts` — vérifie le jeton et la date de validité, télécharge les photos du bucket privé `chantier-photos` via le client admin, assemble un ZIP en mémoire (écriture ZIP « store », sans dépendance native, incompatible avec le runtime serverless sinon) et renvoie `application/zip` en `Content-Disposition: attachment`.
- `chantier-termine.tsx` et `chantier-archive.tsx` : liste de liens remplacée par le bouton ZIP unique (miniatures conservées en aperçu).
- Vérifications : Playwright sur la page de confirmation client (mobile 390 et desktop), téléchargement ZIP réel avec un chantier existant, contrôle du journal d'envoi après test.
