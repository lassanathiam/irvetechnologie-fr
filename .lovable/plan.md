# Onglet « Documents » avec signature électronique (style DocuSign)

## Ce que vous aurez
1. **Nouvel onglet « Documents »** dans le menu de l'espace pro (sous « Calculateur IRVE »).
   - Rangement par dossiers : Contrats, Assurances, Qualifications (P1/P2/P3), Administratif, Clients, Autres.
   - Recherche, aperçu, téléchargement, suppression.
   - Formats acceptés : PDF, photo (JPG/PNG), Word converti en PDF à l'import si possible (sinon PDF uniquement).
2. **Préparation de la signature (outil intelligent)**
   - Bouton « Préparer pour signature » sur un PDF.
   - L'IA lit le document et **propose automatiquement les emplacements** : signature, paraphe (bas de chaque page), nom, date, « Lu et approuvé ».
   - Vous pouvez déplacer, ajouter ou supprimer chaque zone à la main sur l'aperçu page par page.
   - Chaque zone est attribuée à un signataire : **vous (IRVE Technologie)** ou **le client** (nom, email, téléphone).
   - Option « Paraphe sur chaque page » cochable.
3. **Trois choix après préparation**
   - **Je signe maintenant** : vous signez au doigt/souris, puis vous choisissez la suite.
   - **Envoyer au client pour signature en ligne** : email (et lien copiable SMS/WhatsApp) vers une page publique sécurisée ; le client voit le document, remplit ses zones, signe, puis télécharge le PDF signé.
   - **Télécharger** le PDF (signé ou non) pour l'envoyer vous-même.
4. **Suivi**
   - Statuts : Brouillon, Envoyé, Consulté (« Lu le… »), Signé, Refusé.
   - **Notification dans l'espace pro + email** dès que le client a signé.
   - PDF final signé archivé automatiquement dans le dossier, avec une page de preuve (noms, dates/heures, adresse IP, empreinte du document).

## Limites à connaître
- Signature électronique « simple » (valeur légale courante pour devis, contrats commerciaux), pas une signature qualifiée certifiée comme DocuSign avancé.
- L'envoi d'emails dépend du domaine d'envoi actuellement bloqué côté Lovable : en attendant, le lien copiable (SMS/WhatsApp) fonctionne.

## Détails techniques
- Tables : `documents` (dossier, nom, fichier, taille, statut), `document_signatures` (zones jsonb {page,x,y,l,h,type,signataire}, signataires jsonb, public_token, viewed_at, signed_at, ip, hash), RLS staff ; bucket privé `documents`.
- Détection des zones : texte extrait du PDF (pdfjs) + Lovable AI Gateway (openai/gpt-6-astra, streaming, JSON structuré) → coordonnées proposées.
- Rendu/édition : pdfjs pour l'aperçu, `pdf-lib` pour incruster signatures, paraphes, nom, date et page de preuve.
- Routes : `/_authenticated/documents` (liste), `/_authenticated/documents/$id` (préparation/signature), page publique `/signer/$token` (noindex) + fonctions serveur publiques par jeton.
- Email « document-a-signer » et « document-signe » ; notification type `document_signe`.
- Lien ajouté dans ProShell.
