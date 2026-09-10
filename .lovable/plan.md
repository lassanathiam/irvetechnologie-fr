# Retour de travaux avant la fin de chantier

## Principe

Aujourd'hui : « Démarrer les travaux » puis directement « Terminer le chantier ».
Demain : entre les deux, un écran **Retour de travaux** à remplir sur le téléphone. Sans les 5 photos essentielles, le bouton « Terminer le chantier » reste bloqué.

## L'écran de retour de travaux

Un bouton **« Retour de travaux »** apparaît sur la fiche dès que les travaux sont démarrés, avec un compteur (ex. « 3/5 »).

Photos **obligatoires** (une suffit par ligne, plusieurs possibles) :
1. Borne posée / emplacement final
2. Raccordement de la borne (intérieur borne)
3. Mise en service et essai (testeur branché)
4. Tableau électrique / raccordement protections
5. Compteur Linky (délestage)

Photos **facultatives** : cheminement du câble, boîte de dérivation, armoire, vue d'ensemble, plaque / numéro de série, autre.

Chaque ligne : bouton appareil photo (prise directe ou galerie), miniatures, suppression possible, compression automatique avant envoi pour tenir en 4G.

## Métrage et plus-value

Dans le même écran :
- **Métrage inclus** : 5 m par défaut (modifiable chantier par chantier).
- **Métrage réel posé** : saisi sur place.
- Affichage immédiat : « 13 m posés, soit **8 m en plus** ». Aucun prix calculé — vous chiffrez la plus-value vous-même dans le devis.
- Champs complémentaires : type de pose, protections posées, délestage oui/non, observations libres.

Le nombre de mètres en plus est repris dans la fiche du chantier, dans le bilan mensuel et dans le rapport de fin de chantier.

## Fin de chantier

Le bouton « Terminer le chantier » se débloque quand les 5 photos sont là (message clair sinon, indiquant ce qui manque).
L'email de fin de chantier envoyé au client ou au partenaire inclut désormais : durée réelle, métrage posé et mètres en plus, observations, et les photos du retour de travaux (liens valables 7 jours).

## Détails techniques

- Migration : `rendezvous.metrage_inclus_m` (défaut 5), `metrage_reel_m`, `retour_observations`, `retour_delestage`, `retour_complete_at`.
- `rendezvous_photos.categorie` : nouvelles valeurs `borne_posee`, `raccordement_borne`, `mise_en_service`, `tableau_electrique`, `compteur_linky`, `boite_derivation`, `armoire`, `vue_ensemble`, `plaque_serie` (colonne texte, pas de contrainte à modifier).
- `src/lib/planning.functions.ts` : `uploadPhotoChantier` (équipe, compressée, max 30/dossier), `supprimerPhotoChantier`, `enregistrerRetourTravaux`; `terminerChantier` refuse si les 5 catégories obligatoires manquent et joint photos + métrage à l'email.
- Nouveau composant `RetourTravauxSheet.tsx` utilisé par `planning.index.tsx` (mode intervention mobile compris).
- `chantier-termine.tsx` : bloc métrage/plus-value + galerie de photos signées.
- Bucket existant `chantier-photos` réutilisé.

## Vérification

Contrôles sur téléphone : démarrage, prise des 5 photos, saisie du métrage, blocage puis déblocage du bouton de fin, email reçu avec photos et métrage.
