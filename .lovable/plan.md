# Réponse express aux leads

Un bouton « Réponse express » pour répondre en premier à un lead : on choisit une des trois bornes déjà utilisées, on saisit nom, prénom, adresse, e-mail (et téléphone), on indique le métrage de câble, et un clic crée le devis et l'envoie au prospect.

## Le bouton et l'écran

- Bouton **Réponse express** bien visible en haut du tableau de bord et sur la page Devis.
- Un panneau court, utilisable au téléphone :
  1. Nom, prénom, e-mail, téléphone.
  2. Adresse (avec suggestions automatiques comme ailleurs sur la plateforme) et code postal / ville.
  3. Trois bornes sous forme de cartes cliquables, avec leur prix affiché.
  4. Métrage de câble : 5 m inclus par défaut, curseur/champ pour le métrage réel ; le prix se met à jour en direct.
  5. Option cochable « Anti-déclenchement Schneider » (déjà proposé à Émilie).
  6. Total TTC affiché en gros, puis un seul bouton **Envoyer la proposition**.

## Les trois bornes (reprises de la plateforme)

Reprise du devis d'Émilie (D-2026-0281) et du catalogue existant, avec 5 m de câble inclus :

| Choix | Descriptif | Prix de départ |
| --- | --- | --- |
| Borne 7,4 kW monophasé (Hager Witty) | Fourniture, pose, ligne dédiée, protections, mise en service, rapport | à confirmer |
| Borne Schneider Charge 7,4 kW évolutive | Exactement l'offre envoyée à Émilie (gestion dynamique, TIC Linky) | 1 250 € HT |
| Borne 22 kW triphasé | Fourniture, pose, ligne dédiée triphasée, protections, mise en service | à confirmer |

Les trois libellés, descriptifs, prix et le prix du mètre de câble supplémentaire sont **modifiables dans la plateforme** (petit écran de réglages), sans passer par moi. Je pré-remplis avec les valeurs ci-dessus ; les prix manquants restent à compléter par vous en une minute, et le bouton refuse d'envoyer un prix à 0 €.

## Calcul du prix

- Prix de la borne choisie (forfait, 5 m de câble inclus).
- Au-delà de 5 m : mètres supplémentaires × prix au mètre (réglable), ajoutés en ligne séparée « Câble et cheminement supplémentaires — X m ».
- Option anti-déclenchement en ligne séparée.
- TVA 20 %, remise 0 %, validité 30 jours, mêmes conditions de paiement que vos devis actuels.

## L'envoi

- Réutilise exactement le circuit d'envoi existant de vos devis (domaine d'envoi vérifié et signé, réponses vers contacts@irvetechnologie.fr) : c'est ce qui limite le risque de spam, aucun envoi maison n'est ajouté.
- Le prospect reçoit le prix détaillé et un lien pour consulter et accepter en ligne ; l'acceptation remonte dans votre boîte de réception interne et crée le rendez-vous, comme aujourd'hui.
- Le devis apparaît normalement dans « Mes devis » au statut Envoyé, modifiable ensuite si besoin.
- Sans e-mail du prospect : le devis est créé et un message prêt à coller (SMS/WhatsApp) est proposé avec le lien.

## Détails techniques

- `src/lib/leads.functions.ts` : `getReponseExpressConfig` / `updateReponseExpressConfig` (stockage dans `app_settings`, clé `reponse_express`) et `envoyerReponseExpress` (crée le devis via la logique existante puis appelle l'envoi e-mail du devis) — server fns avec `requireSupabaseAuth`, validation Zod.
- Composant `src/components/ReponseExpress.tsx` (panneau + calcul en direct via `computeTotals` de `src/lib/billing.ts`), monté depuis `espace.index.tsx` et `devis.index.tsx`.
- Réglage des trois offres dans un onglet de `devis.index.tsx`.
- Aucune migration : `app_settings` existe déjà. Aucun changement au modèle d'e-mail existant.
