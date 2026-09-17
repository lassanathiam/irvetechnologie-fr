# Contre-proposition du client sur le lien d'attachement

## L'idée

Aujourd'hui, sur le lien qu'il reçoit, le chargé d'affaires peut seulement accepter ou refuser l'attachement. On ajoute une troisième possibilité : **« Proposer une valorisation »**.

Il peut alors, directement sur le lien :
- ajuster les quantités et les prix de chaque ligne,
- ajouter une ligne oubliée ou en retirer une,
- laisser un commentaire expliquant ses ajustements,
- envoyer sa proposition.

## Point important : sa proposition ne remplace rien automatiquement

Sa saisie n'écrase jamais votre attachement. Elle arrive comme une **proposition en attente** que vous validez ou refusez depuis votre espace. C'est essentiel : sinon n'importe qui ayant le lien pourrait baisser vos montants.

Côté client, le statut affiché devient « Valorisation proposée — en attente de validation par IRVE Technologie ».

## Ce que vous voyez de votre côté

Sur la page de l'attachement, un encadré apparaît quand une proposition arrive :
- comparaison ligne par ligne : votre prix / son prix, ancien total HT / nouveau total HT, écart en euros,
- son commentaire et son nom,
- deux boutons : **Accepter sa valorisation** (les lignes de l'attachement sont remplacées par les siennes, l'attachement passe en accepté, prêt à facturer) ou **Refuser** (votre version reste, il en est informé sur le lien).

Vous recevez aussi une notification dans la plateforme (comme pour les acceptations), avec le montant proposé et l'écart.

## Détails techniques

**Base de données** — nouvelle table `attachement_propositions` :
- `attachement_id`, `signataire_nom`, `commentaire`, `total_ht`, `statut` (`en_attente` / `acceptee` / `refusee`), `lignes` en JSONB (libellé, description, quantité, prix unitaire), `created_at`, `traite_at`.
- RLS : lecture/écriture réservées à `public.is_staff()` ; l'accès client passe uniquement par les fonctions serveur avec le jeton public (`supabaseAdmin`), comme l'existant.
- GRANT `authenticated` + `service_role`.
- Nouvelle colonne `attachements_travaux.proposition_autorisee boolean not null default true` pour pouvoir désactiver la contre-proposition au cas par cas, et `statut` accepte la valeur `propose`.

**Serveur** :
- `src/lib/attachements-public.functions.ts` : `proposerValorisationPublic` (jeton + lignes + nom + commentaire, refus si déjà facturé/accepté, refus si une proposition est déjà en attente, notification via `creerNotification`), et `getAttachementPublic` renvoie en plus la proposition en cours.
- `src/lib/attachements.functions.ts` : `traiterPropositionAttachement` (`accepter` → remplace `attachement_items`, recalcule les totaux via `computeTotals`, statut `accepte` ; `refuser` → marque la proposition refusée), bloqué si `facture_id`.

**Interfaces** :
- `src/routes/attachement.$token.tsx` : bouton « Proposer une valorisation » ouvrant un tableau éditable (quantité, prix, ajout/suppression de ligne), total recalculé en direct, nom + commentaire obligatoires, plus l'état après envoi.
- `src/routes/_authenticated/attachements.$id.tsx` : encadré de comparaison + boutons Accepter / Refuser.
- Case « Autoriser le client à proposer une valorisation » dans la création et la modification de l'attachement.
