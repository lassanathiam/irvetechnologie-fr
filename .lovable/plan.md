# Demande, abonnement kVA et rapports simplifiés

## 1. Demande de raccordement : abonnement en kVA

Ajout dans le formulaire public d'un bloc « Votre compteur » :

- **Abonnement souscrit (kVA)** : 3, 6, 9, 12, 15, 18, 24, 30, 36 kVA, « Triphasé », « Je ne sais pas ».
- **Type de compteur** : Linky / ancien compteur / je ne sais pas.
- **Monophasé / Triphasé**.
- La puissance de borne souhaitée devient une liste courte : 3,7 kW – 7,4 kW – 11 kW – 22 kW – à définir.

Alerte automatique affichée au client : si l'abonnement est petit par rapport à la borne demandée
(ex. 6 kVA + 7,4 kW), un message indique qu'un pilotage dynamique ou une augmentation d'abonnement
sera probablement nécessaire. Information utile aussi pour nous au moment du chiffrage.

## 2. Rapport allégé : l'essentiel d'abord

Aujourd'hui la checklist compte plus de 60 points. Nouveau fonctionnement :

- **Mode « Essentiel » par défaut** : environ 15 points indispensables (circuit dédié, différentiel
  30 mA / 6 mA DC, section, terre, isolement, test déclenchement, fixation borne, essai de charge,
  remise en main). Tous préréglés sur « Conforme » — on ne touche que les exceptions.
- **Mode « Complet »** : un bouton déplie la checklist détaillée actuelle pour les cas qui le
  demandent. Rien n'est perdu.
- **Typologies présélectionnables** (une ligne de boutons à cliquer, pas de saisie) :
  - Type de borne : 3,7 / 7,4 / 11 / 22 kW
  - Raccordement : monophasé / triphasé
  - Pose : murale intérieure / murale extérieure / sur pied
  - Cheminement : apparent goulotte / encastré / tranchée
  - Un clic remplit d'un coup la puissance, le calibre disjoncteur conseillé, la section de câble
    et les points de checklist correspondants.

## 3. Synchronisation demande → devis → rapport

Chaînage des informations pour ne plus les ressaisir :

- Le devis reprend déjà les infos de la demande acceptée ; on y ajoute abonnement kVA, puissance
  borne, distance tableau → borne, type de pose.
- Le rapport peut être **créé depuis un devis ou un rendez-vous** : un sélecteur « Reprendre un
  devis / un chantier » remplit automatiquement client, adresse, borne, puissance, métrage,
  technicien et date d'intervention.
- Les lignes du devis (marque/modèle de borne, longueur de câble) alimentent les champs matériel
  et mesures du rapport.
- Tout reste modifiable à la main après reprise.

## Détails techniques

- Base : ajout de colonnes `abonnement_kva`, `type_compteur`, `phase` sur `demande_requests` ;
  `devis_id`, `rendezvous_id`, `typologie` (jsonb) sur `rapports` ; migration avec GRANT et RLS
  inchangés.
- `src/lib/rapport-checklist.ts` : nouvelle liste `CHECKLIST_ESSENTIEL` + table de correspondance
  typologie → valeurs conseillées (calibre, section).
- Nouvelle fonction serveur `getRapportPrefill({ devisId | rendezvousId })` dans
  `rapports.functions.ts`.
- Formulaires concernés : `src/routes/demande.tsx`, `_authenticated/rapports.index.tsx`,
  `_authenticated/devis.$id.tsx`.
