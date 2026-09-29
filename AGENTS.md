
- Sous-traitants = lignes `partenaires` avec type=sous_traitant ; ils partagent le lien privé + code et voient uniquement les `rendezvous` où sous_traitant_id = leur id (pourquoi : réutiliser la sécurité par jeton existante).
- Les prix « À partir de » du site sont stockés dans `app_settings` sous `tarifs_site_public` et modifiés via l’espace pro (pourquoi : garder l’affichage public synchronisé sans redéploiement).
- Le Planning conserve la vue complète mais place « Mission terrain » en premier avec un parcours guidé par étapes (pourquoi : faciliter l’usage sur chantier et éviter les actions dispersées).
