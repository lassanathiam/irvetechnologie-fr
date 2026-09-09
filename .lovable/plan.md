# Planning plus clair, chantiers réalisés et photos partenaires

## Mon avis d'ensemble

Le risque ici est de surcharger l'outil. Je propose donc de ne rien ajouter de nouveau à l'écran par défaut : on **range** ce qui est terminé, on **remonte** ce qui est en cours, et on ouvre deux vues secondaires (chantiers réalisés, sélection sur la carte) accessibles par un bouton. Cinq chantiers, dans cet ordre.

---

## 1. Archiver après validation, et revoir tous les chantiers réalisés

- Quand un chantier est terminé et validé, un bouton **« Archiver »** apparaît directement sur la fiche (plus besoin d'ouvrir « Gérer le dossier »). Le chantier quitte la liste et la carte du planning ; rien n'est supprimé.
- Nouveau bouton **« Nos chantiers réalisés »** en haut du planning : il bascule sur une vue « bilan » qui affiche uniquement les chantiers terminés / réalisés, archivés compris, avec :
  - choix du mois (ou des 12 derniers mois),
  - compteur : nombre de chantiers, total des montants (masquable comme aujourd'hui), kilomètres parcourus,
  - les mêmes repères sur la carte, en vert, pour voir la couverture géographique du mois.
- Depuis cette vue, on peut restaurer un chantier archivé si besoin.

## 2. Chantier en cours toujen haut

Ordre d'affichage fixe : **travaux en cours** d'abord, puis aujourd'hui, puis les prochaines dates, puis les dates à confirmer, puis le passé non archivé. Un chantier démarré remonte donc tout seul en tête de liste.

## 3. Programmer deux chantiers ensemble depuis la carte

- Bouton **« Sélectionner »** : on coche 2 chantiers ou plus (sur la carte ou dans la liste).
- Un panneau affiche alors le calcul : distance entre les deux chantiers, kilomètres et temps si on rentre entre les deux, versus si on enchaîne le lendemain matin depuis un hôtel.
- Conseil clair : **« Faisable dans la journée »** ou **« Nuitée conseillée : environ X € de carburant et Y h de route économisés »**.
- Bouton **« Programmer ensemble »** : on choisit la date et l'heure du premier, le second est positionné automatiquement à la suite (ou au lendemain matin en cas de nuitée).

## 4. Tableau de bord lisible et cliquable

- Textes et chiffres nettement agrandis, moins de blocs, plus d'air ; même thème vert-gris et bascule jour/nuit.
- Chaque ligne devient cliquable : **prochains rendez-vous** ouvre directement la fiche du chantier dans le planning ; les compteurs (demandes, devis, factures) ouvrent l'écran filtré correspondant.
- Un bandeau apparaît quand des travaux sont en cours, avec accès direct au chantier.

## 5. Supprimer les dossiers refusés

- Les demandes refusées et les chantiers annulés obtiennent un bouton **« Supprimer définitivement »** avec confirmation nommée (on relit le nom du client avant de valider).
- Les demandes refusées de plus de 6 mois sont proposées en suppression groupée depuis l'écran Demandes.

## 6. Photos déposées par les partenaires

Sur le lien privé du partenaire (aucun compte à créer) :
- chaque dossier affiche son état en direct (à prendre / planifié / en cours / terminé) ;
- bouton **« Ajouter des photos »** sur chacun de ses dossiers, plusieurs photos à la fois, compressées avant envoi ;
- de notre côté, les photos apparaissent dans le dossier du chantier et sont reprises dans le rapport de fin de chantier.

Fini les photos par WhatsApp.

---

## Détails techniques

- Migration : table `rendezvous_photos` (rendezvous_id, path, source `partenaire` | `equipe`, created_at) + bucket privé `chantier-photos` ; index sur `rendezvous(statut, date_debut)` pour l'ordre d'affichage.
- `planning.functions.ts` : `listChantiersRealises({ mois })`, `supprimerRendezVous`, `programmerEnsemble({ ids, date_debut, nuitee })`, tri serveur en_cours → à venir → à confirmer → passé.
- `demandes-admin.functions.ts` : `supprimerDemande`, `purgerRefus({ avant })`.
- `partenaires.functions.ts` : `uploadPhotoPartenaire` (jeton vérifié, taille limitée) + URL signée pour la relecture côté équipe.
- `tournee.ts` : fonction `comparerDeuxChantiers` (aller-retour vs nuitée, coût carburant paramétré) réutilisée par le panneau de sélection.
- `planning.index.tsx` : mode `vue = planning | realises`, mode sélection multiple partagé liste/carte, bouton Archiver sur la fiche terminée.
- `espace.index.tsx` : refonte typographique et lignes cliquables vers `/planning?rdv=<id>` et écrans filtrés.
- `InterventionsMap.tsx` : cases de sélection sur les repères, filtre « réalisés » en vert.

## Ordre de livraison

1. Archivage sur la fiche + ordre d'affichage (chantier en cours en haut)
2. Vue « Nos chantiers réalisés » avec bilan du mois
3. Tableau de bord lisible et cliquable
4. Suppression des dossiers refusés / annulés
5. Sélection de deux chantiers et conseil nuitée
6. Dépôt de photos par les partenaires
