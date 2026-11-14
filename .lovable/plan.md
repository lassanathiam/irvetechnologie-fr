# Un seul circuit clair : du chantier au paiement

## Le principe
Un chantier suit **un seul chemin**, toujours dans le même ordre, comme dans les autres entreprises :

```text
1. Fait  ->  2. Attachement envoyé  ->  3. Commande reçue  ->  4. Réceptionné  ->  5. Facturé  ->  6. Déposé / Payé
```

- **Réception** : on n'y voit **que** les chantiers dont la commande est reçue. Sans commande, le chantier reste à l'étape 2 (« en attente de commande »).
- Chaque chantier n'apparaît **qu'à une seule étape** à la fois : plus de doublons entre pages.

## Une seule page de suivi : « Suivi chantiers »
Elle remplace la page Bilan, le panneau Réception du tableau de bord et les panneaux « Montant total par client » / « Totaux » de la page Attachements.

- En haut : **6 onglets numérotés** (les 6 étapes), chacun avec son nombre de chantiers et son **montant total en gros, vert et gras**.
- Chaque ligne affiche en premier :
  - **NOM Prénom du client** en gros et gras
  - **le montant HT en gros, vert et gras**
  - en petit : ville, date, n° attachement, n° commande, n° facture
- **Un seul bouton** par ligne, pour passer à l'étape suivante (« Réceptionner », « Créer la facture », « Marquer déposée »…).
- Cases à cocher pour traiter plusieurs chantiers d'un coup, avec le total de la sélection.
- Un filtre client (ENSIO, INFRATEL…), une période et une recherche par nom.
- Téléchargement et envoi au client du bilan, depuis cette page.

## Le reste, simplifié
- **Tableau de bord** : un simple encadré avec les 6 étapes et leurs montants. Un clic ouvre la bonne étape dans « Suivi chantiers ». Les listes détaillées en double sont retirées.
- **Attachements**, **Factures** et **Devis** : les listes restent, mais chaque ligne met en avant le **nom du client** et le **montant** (gros, vert, gras), avec l'étape du chantier en badge. Les panneaux de totaux en double sont retirés.
- **Bons de commande** : reste la page où l'on importe les commandes. Une commande importée fait passer le chantier à l'étape 3.
- Menu : une seule entrée « Suivi chantiers » sous Opérations.

## Ce qui ne change pas
- Aucun montant, aucune facture, aucun paiement ni aucune commande déjà enregistrés ne sont modifiés. On change seulement la façon de les afficher et de les ranger.
- Les montants viennent des attachements déjà enregistrés.
- Les chantiers déjà réceptionnés sans commande restent marqués réceptionnés. Ils apparaissent dans un petit encadré « Réceptionné mais commande à recevoir », pour ne rien perdre.

## Détails techniques
- Nouvelle règle unique d'étape par chantier dans un module partagé navigateur/serveur (`src/lib/etape-chantier.ts`), testée. Elle se base sur l'attachement non annulé lié, la commande importée la plus récente ou le bon de commande de l'attachement, `receptionne_at`, la facture liée, `depose_at` et `paid_at`.
- Une fonction serveur authentifiée renvoie une ligne par chantier : client, montant de sa part d'attachement, références et étape.
- Nouvelle route `/suivi` ; `/attachements/bilan` redirige vers `/suivi`.
- `ReceptionTracking` est remplacé par un résumé sur `/espace` ; les sections en double de `attachements.index.tsx` sont retirées.
- Aucun changement dans la base de données.
