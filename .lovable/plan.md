# Planning de chantier : lisibilité, suivi en direct et programmation au mois

## Mon point de vue

Ce qui manque aujourd'hui n'est pas des fonctions en plus, c'est de la **lisibilité sur le terrain** et un **fil de vie du chantier**. Je propose donc trois chantiers, dans cet ordre :

1. Rendre chaque fiche lisible d'un coup d'œil au soleil, sur téléphone.
2. Suivre le chantier en direct (démarrage / fin) et prévenir le partenaire automatiquement.
3. Programmer jusqu'à un mois, avec 1 à 3 chantiers par journée.

---

## 1. Lisibilité (mode jour et mode nuit)

- Fond de fiche coloré selon l'état, plus seulement un liseré : orange pâle = planifié, bleu pâle = confirmé, vert pâle = réalisé, rouge pâle = annulé. Les mêmes teintes existent en version sombre, donc le mode nuit reste tel qu'il est aujourd'hui.
- Textes agrandis et contrastés sur les informations utiles au chantier : nom, adresse, heure, puissance, métrage.
- Boutons tactiles plus grands (minimum 44 px) pour Appeler / WhatsApp / Itinéraire.

## 2. Un seul bouton par dossier

Au lieu de plusieurs petits liens (chantier validé, voirie, montant, adresse), chaque fiche a **un bouton « Gérer le dossier »** qui ouvre un panneau unique avec des onglets :

- Chantier : état, démarrage/fin des travaux, validation
- Voirie : autorisation à demander / obtenue / dates
- Montant : montant HT, TVA, direct ou sous-traitance, partenaire, statut de facturation
- Adresse & technique : adresse, métrage, puissance, mono/triphasé, type de pose

Un réglage « Afficher les montants » permet de masquer l'argent quand on montre l'écran à un client.

## 3. Couleur par partenaire

Chaque partenaire reçoit **sa couleur** (choisie ou attribuée automatiquement). Cette couleur apparaît en étiquette sur la fiche, dans la liste et sur la carte, pour distinguer d'un regard un chantier Pure Énergies d'un chantier direct ou d'un nouveau sous-traitant.

## 4. Suivi en direct du chantier

- Deux nouveaux états : **Travaux en cours** et **Terminé**.
- Bouton « Démarrer les travaux » à l'arrivée : la fiche passe en vert vif animé, avec l'heure de démarrage, et reste ainsi jusqu'à « Terminer le chantier ».
- À la fin : durée réelle enregistrée, et **un email automatique au partenaire** (ou au client) indiquant que le chantier est terminé.
- Le partenaire voit l'état en direct sur son lien privé (à prendre / planifié / en cours / terminé).

## 5. Carte et programmation jusqu'à un mois

- Géolocalisation : bouton « Ma position » sur la carte, itinéraire calculé depuis là où vous êtes plutôt que depuis la base.
- Programmation : la période passe de 7/14 jours à **7, 14 ou 30 jours**, avec 1, 2 ou 3 chantiers par journée au choix, et le regroupement par proximité comme aujourd'hui.
- Le programme proposé peut être appliqué : les dates sont réellement enregistrées sur les chantiers concernés.

---

## Détails techniques

- Migration : `rendezvous.demarre_at`, `rendezvous.termine_at`, statuts `en_cours` et `termine` ; `partenaires.couleur` (hex).
- Nouveau composant `DossierChantierSheet.tsx` (panneau à onglets) remplaçant les actions dispersées de `planning.index.tsx`.
- `planning.functions.ts` : `demarrerChantier`, `terminerChantier` (envoi email via le modèle existant), `appliquerProgramme`.
- Nouveau modèle email `chantier-termine.tsx` dans `src/lib/email-templates/`.
- `InterventionsMap.tsx` : couleur du marqueur = couleur partenaire, halo = état ; géolocalisation navigateur.
- `tournee.ts` : horizon paramétrable jusqu'à 30 jours, arrêts/jour paramétrable.
- Teintes de fond ajoutées comme jetons dans `src/styles.css` pour rester cohérentes en clair/sombre.

## Ordre de livraison proposé

1. Lisibilité + bouton unique « Gérer le dossier » (utile dès demain sur le chantier)
2. Démarrage / fin de travaux + notification partenaire
3. Couleur par partenaire
4. Carte géolocalisée + programmation 30 jours
