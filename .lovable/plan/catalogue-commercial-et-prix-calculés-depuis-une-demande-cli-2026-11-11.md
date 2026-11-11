# Catalogue commercial et prix calculés depuis une demande client

Objectif : avant l'arrivée des campagnes, pouvoir répondre à une demande de particulier en quelques clics, avec une vraie borne, un forfait de câble (5, 10, 15 ou 20 m), le prix TTC calculé automatiquement et la marge visible. Les prix d'achat restent cachés au client.

## Étape 1 — ce qui sert tout de suite aux campagnes

**1. Catalogue des bornes réelles (espace pro)**
- Je reprends le catalogue actuel, en ajoutant les marques demandées : Autel, Schneider, Hager, La Borne Tricolore, 50five, TotalEnergies, Wallbox, Legrand, ABB, Ohme, Alfen et V2C.
- Chaque fiche contient le fabricant, la référence constructeur exacte, la puissance, monophasé ou triphasé, prise ou câble, la connexion, le délestage, Linky (TIC), le RFID, le compteur MID, la garantie et le lien vers la fiche officielle.
- Je remplis seulement les références que j'ai vérifiées sur le site du fabricant. Sinon, la fiche indique « À vérifier ».
- Photos : je n'invente aucune image. Sans photo officielle, la fiche indique « Photo constructeur à renseigner », et vous pouvez en ajouter plusieurs.

**2. Prix d'achat (visibles par l'administration seulement)**
- Pour chaque borne : fournisseur, référence fournisseur, prix d'achat HT, remise, frais de livraison, disponibilité, date de mise à jour et justificatif (facture ou devis du fournisseur).
- Aucun prix d'achat n'est inventé. Sans prix, la fiche affiche « Prix d'achat à confirmer » et la borne ne peut pas être proposée au client.
- Les prix d'achat ne sortent jamais vers le site, les devis ou les emails.

**3. Vos coûts de référence (modifiables)**
- Protections, prix du câble au mètre (3G10 et 5G6), petites fournitures, temps de pose, coût horaire, carburant et déplacement, et pub (30 € par client signé).

**4. Forfaits de câble**
- Pour chaque borne : un prix TTC jusqu'à 5 m, 10 m, 15 m et 20 m. Au-delà de 20 m : « Étude personnalisée », sans prix automatique.
- À côté de chaque forfait, vous voyez le prix de revient réel, la marge et le prix TTC minimum : (prix de revient HT + 500 €) × 1,20.

**5. Options**
- Délestage, compteur MID, pied de fixation, protection complémentaire, passage en triphasé, tranchée, percement complexe, câble supplémentaire, paramétrage et supervision, mise en service, maintenance.
- Chaque option a un prix de revient HT et un prix de vente TTC.

**6. Règle des 500 € de marge**
- Marge = prix de vente HT − total des coûts HT.
- Sous 500 € : alerte rouge, jamais masquée. Seul un administrateur peut valider quand même, et sa raison est notée sur le devis.

**7. Réponse depuis la demande client**
- Le bouton « Réponse express » de chaque demande ouvre le calculateur. Il reprend les coordonnées et la distance indiquée par le client.
- Vous choisissez la marque, le modèle, la puissance, la distance et les options. Le prix TTC et la marge prévue s'affichent.
- Ensuite, « Envoyer la proposition » ou « Enregistrer sans envoyer », avec confirmation avant tout envoi, comme aujourd'hui. Le devis créé garde vos prix, même si vous les changez plus tard.

## Étape 2 — à faire ensuite, si vous le validez
- Tableau de rentabilité : demandes, devis envoyés et acceptés, poses réalisées, chiffre d'affaires HT et TTC, coûts par poste, marge moyenne, poses sous 500 €, rentabilité par marque et par modèle, avec des filtres.
- Séparation nette entre la vente directe et la sous-traitance (ENSIO, BPU de 300 à 365 €), qui ne seront jamais mélangées dans les chiffres.
- Recherche des photos officielles, marque par marque.

## Ce qui ne change pas
- Les tarifs ENSIO, les attachements, les factures, le planning et les devis déjà envoyés.
- Les prix « à partir de » du site public, que vous gérez déjà vous-même.

## Ce qu'il me faudra de votre part
- Vos vrais prix d'achat, en photo ou en PDF de facture fournisseur. En attendant, les bornes restent sur « Prix d'achat à confirmer ».
- Votre coût horaire et le temps de pose moyen.

## Détails techniques
- Nouvelles tables : produits du catalogue commercial (avec galerie), prix d'achat (lecture et écriture réservées aux admins), forfaits par borne et par palier de câble, options. Les coûts de référence sont stockés dans app_settings.
- Les prix d'achat ne sont lus que dans les fonctions serveur réservées aux admins. Rien de public, et la table « bornes » du site ne contient aucun coût.
- Les calculs de prix de revient, de marge et de prix minimum vivent dans un module partagé utilisable dans le navigateur, avec des tests (500 € de marge, TVA à 20 %, paliers 5/10/15/20 m, plus de 20 m = étude).
- La réponse express existante est étendue : les lignes du devis enregistrent le produit, le palier et les options. Le devis garde une copie des prix au moment de l'envoi.
- La validation sous 500 € passe par has_role admin côté serveur.
