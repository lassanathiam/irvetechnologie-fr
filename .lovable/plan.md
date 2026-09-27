# Rapports aux couleurs des donneurs d'ordre (Ensio, TotalEnergies…)

## Principe
1. **Une seule fois par donneur d'ordre** : dans une nouvelle page « Modèles de rapport », vous photographiez la feuille papier (et son logo). L'IA lit la feuille une seule fois et crée le modèle : titre, logo, rubriques, champs à remplir, cases à cocher. Vous pouvez relire et corriger, puis vous enregistrez.
2. **Ensuite, plus d'IA** : le modèle reste en mémoire et sert à chaque chantier.
3. **Lien automatique avec le planning** : chaque modèle est rattaché à un donneur d'ordre (Ensio, TotalEnergies…). Quand un chantier de ce donneur d'ordre est planifié, son rapport apparaît avec les autres documents et photos du chantier.
4. **Sur le téléphone, avant de terminer le chantier** : la plateforme propose le rapport. Le technicien coche au fur et à mesure, remplit les champs (client, adresse, date déjà préremplis), le client relit, les deux signent.
5. **Envoi automatique** : le rapport signé part par email au donneur d'ordre avec un lien pour télécharger les photos (ZIP). Une copie reste dans l'espace pro.
6. **Présentation** : document blanc avec uniquement le logo du donneur d'ordre en en-tête, sans logo IRVE.

## Ce qui ne change pas
- Les rapports IRVE actuels (contrôle, conformité, assurance) restent identiques.
- Pas d'IA sur le chantier : tout fonctionne directement dans la plateforme.
- Le BPU d'Ensio sera ajouté au bordereau de prix dès réception.

## Détails techniques
- Tables : `rapport_modeles` (donneur_ordre_id, nom, logo_path, champs jsonb : sections/champs de type texte, nombre, case, oui/non, date, photo) et `rapport_remplis` (modele_id, rendezvous_id, valeurs jsonb, signatures, signed_at, sent_at). RLS staff, GRANT authenticated/service_role.
- Lien planning : `rendezvous.donneur_ordre_id` (nouvelle colonne) ou correspondance avec le partenaire existant.
- Création : une server function appelle Lovable AI (`openai/gpt-6-astra`, entrée image, sortie structurée) uniquement à la création du modèle ; logo recadré depuis la photo ou envoyé à part, stocké dans un bucket privé.
- Mobile : écran de remplissage réutilisant SignaturePad et la compression photo ; proposé dans la clôture de chantier du mode intervention.
- Impression : composant d'impression dédié (blanc, A4 centré), envoi email via le circuit existant + ZIP photos 30 jours.
