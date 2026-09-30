
- Sous-traitants = lignes `partenaires` avec type=sous_traitant ; ils partagent le lien privé + code et voient uniquement les `rendezvous` où sous_traitant_id = leur id (pourquoi : réutiliser la sécurité par jeton existante).
- Les prix « À partir de » du site sont stockés dans `app_settings` sous `tarifs_site_public` et modifiés via l’espace pro (pourquoi : garder l’affichage public synchronisé sans redéploiement).
- Le Planning conserve la vue complète mais place « Mission terrain » en premier avec un parcours guidé par étapes (pourquoi : faciliter l’usage sur chantier et éviter les actions dispersées).
- Sur ordinateur, le Planning suit trois zones stables : mission à gauche, rendez-vous au centre, carte et logistique à droite (pourquoi : hiérarchiser le travail sans supprimer les outils existants).
- Le retour terrain utilise le type du rendez-vous : installation = preuves complètes, maintenance = deux preuves essentielles et câble/métrage seulement si des travaux de câble ont réellement lieu (pourquoi : éviter des photos et champs inutiles en maintenance).
- Les retours donneur d’ordre utilisent l’email principal et l’email de copie de la fiche partenaire, avec un envoi individuel et dédupliqué à chacun (pourquoi : le service d’email ne propose pas de champ CC natif).
