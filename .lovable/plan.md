# Attachements de travaux fibre et facturation

## Objectif
Centraliser les attachements de travaux fibre dans l’espace professionnel, les envoyer sous l’identité **IRVE Technologie**, puis les transformer en facture sans ressaisie.

## Parcours prévu
- Ajouter une rubrique **Attachements travaux** dans le menu professionnel.
- Créer un attachement avec : destinataire, chantier, numéro de ticket obligatoire, numéro d’affaire facultatif, bon de commande facultatif, dates, objet, lignes de travaux, quantités et prix HT.
- Identifier clairement l’activité **Fibre optique** sur les listes et documents concernés.
- Proposer l’option **Autoliquidation de TVA** uniquement pour les attachements fibre.
- Permettre deux parcours :
  - envoyer l’attachement pour validation en ligne, avec preuve datée ;
  - le convertir directement en facture sans validation externe.
- Lors de la conversion, reprendre automatiquement le destinataire, toutes les lignes, le ticket, le numéro d’affaire, le bon de commande et le régime d’autoliquidation.
- Empêcher une deuxième conversion du même attachement.

## Document et e-mail
- Générer un document imprimable intitulé **Attachement de travaux** avec l’identité IRVE Technologie, les qualifications P1/P2/P3 et toutes les références chantier.
- Afficher le numéro de ticket de manière très visible ; empêcher l’envoi s’il manque.
- Utiliser un objet d’e-mail sobre de type : **IRVE Technologie — Attachement de travaux — Ticket [numéro]**.
- Présenter un bouton unique pour consulter et, selon le choix effectué, accepter l’attachement en ligne.
- Afficher sur la facture transformée le numéro de ticket, le numéro d’affaire et le bon de commande.
- En autoliquidation : TVA à 0 €, total TTC égal au total HT et mention légale dédiée visible sur le document.

## Suivi
- Statuts : brouillon, envoyé, accepté, refusé et facturé.
- Historique d’envoi, date de consultation et date de validation.
- Filtres par statut et recherche par client, ticket, affaire ou commande.
- Lien direct entre l’attachement et sa facture.

## Détails techniques
- Créer les tables sécurisées des attachements et de leurs lignes, avec droits limités à l’équipe.
- Ajouter aux factures les références chantier, la source de conversion et l’indicateur d’autoliquidation.
- Étendre le rendu partagé des documents sans modifier l’apparence des devis et factures existants.
- Créer la page publique privée par jeton pour consultation et validation, sans compte client.
- Ajouter les fonctions protégées de création, modification, envoi, validation et conversion.
- Verrouiller les modifications importantes après envoi ou facturation pour préserver la cohérence documentaire.
- Vérifier la compilation, puis tester sur ordinateur et téléphone : création, envoi bloqué sans ticket, validation facultative, conversion, autoliquidation et impression.

## Limite juridique
La mention d’autoliquidation sera intégrée selon le régime français de sous-traitance applicable ; son utilisation restera un choix manuel et devra être confirmée avec votre comptable pour chaque opération.
