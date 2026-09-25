export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          cle: string
          created_at: string
          id: string
          updated_at: string
          valeur: string | null
        }
        Insert: {
          cle: string
          created_at?: string
          id?: string
          updated_at?: string
          valeur?: string | null
        }
        Update: {
          cle?: string
          created_at?: string
          id?: string
          updated_at?: string
          valeur?: string | null
        }
        Relationships: []
      }
      attachement_items: {
        Row: {
          attachement_id: string
          created_at: string
          description: string | null
          id: string
          libelle: string
          ordre: number
          prix_unitaire: number
          quantite: number
        }
        Insert: {
          attachement_id: string
          created_at?: string
          description?: string | null
          id?: string
          libelle: string
          ordre?: number
          prix_unitaire?: number
          quantite?: number
        }
        Update: {
          attachement_id?: string
          created_at?: string
          description?: string | null
          id?: string
          libelle?: string
          ordre?: number
          prix_unitaire?: number
          quantite?: number
        }
        Relationships: [
          {
            foreignKeyName: "attachement_items_attachement_id_fkey"
            columns: ["attachement_id"]
            isOneToOne: false
            referencedRelation: "attachements_travaux"
            referencedColumns: ["id"]
          },
        ]
      }
      attachement_propositions: {
        Row: {
          attachement_id: string
          commentaire: string | null
          created_at: string
          id: string
          lignes: Json
          signataire_nom: string
          statut: string
          total_ht: number
          traite_at: string | null
          updated_at: string
        }
        Insert: {
          attachement_id: string
          commentaire?: string | null
          created_at?: string
          id?: string
          lignes?: Json
          signataire_nom: string
          statut?: string
          total_ht?: number
          traite_at?: string | null
          updated_at?: string
        }
        Update: {
          attachement_id?: string
          commentaire?: string | null
          created_at?: string
          id?: string
          lignes?: Json
          signataire_nom?: string
          statut?: string
          total_ht?: number
          traite_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachement_propositions_attachement_id_fkey"
            columns: ["attachement_id"]
            isOneToOne: false
            referencedRelation: "attachements_travaux"
            referencedColumns: ["id"]
          },
        ]
      }
      attachements_travaux: {
        Row: {
          accepted_at: string | null
          activite: string
          autoliquidation: boolean
          bon_commande: string | null
          client_adresse: string | null
          client_cp_ville: string | null
          client_email: string | null
          client_nom: string
          client_telephone: string | null
          created_at: string
          created_by: string | null
          date_echeance: string
          date_emission: string
          facture_id: string | null
          id: string
          last_viewed_at: string | null
          notes: string | null
          numero: string
          numero_affaire: string | null
          numero_ticket: string
          objet: string | null
          proposition_autorisee: boolean
          public_token: string
          refused_at: string | null
          rendezvous_id: string | null
          sent_at: string | null
          signataire_nom: string | null
          statut: string
          total_ht: number
          total_ttc: number
          total_tva: number
          updated_at: string
          validation_requise: boolean
          view_count: number
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          activite?: string
          autoliquidation?: boolean
          bon_commande?: string | null
          client_adresse?: string | null
          client_cp_ville?: string | null
          client_email?: string | null
          client_nom: string
          client_telephone?: string | null
          created_at?: string
          created_by?: string | null
          date_echeance?: string
          date_emission?: string
          facture_id?: string | null
          id?: string
          last_viewed_at?: string | null
          notes?: string | null
          numero: string
          numero_affaire?: string | null
          numero_ticket: string
          objet?: string | null
          proposition_autorisee?: boolean
          public_token?: string
          refused_at?: string | null
          rendezvous_id?: string | null
          sent_at?: string | null
          signataire_nom?: string | null
          statut?: string
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
          validation_requise?: boolean
          view_count?: number
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          activite?: string
          autoliquidation?: boolean
          bon_commande?: string | null
          client_adresse?: string | null
          client_cp_ville?: string | null
          client_email?: string | null
          client_nom?: string
          client_telephone?: string | null
          created_at?: string
          created_by?: string | null
          date_echeance?: string
          date_emission?: string
          facture_id?: string | null
          id?: string
          last_viewed_at?: string | null
          notes?: string | null
          numero?: string
          numero_affaire?: string | null
          numero_ticket?: string
          objet?: string | null
          proposition_autorisee?: boolean
          public_token?: string
          refused_at?: string | null
          rendezvous_id?: string | null
          sent_at?: string | null
          signataire_nom?: string | null
          statut?: string
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
          validation_requise?: boolean
          view_count?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachements_travaux_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachements_travaux_rendezvous_id_fkey"
            columns: ["rendezvous_id"]
            isOneToOne: false
            referencedRelation: "rendezvous"
            referencedColumns: ["id"]
          },
        ]
      }
      bordereau_prestations: {
        Row: {
          actif: boolean
          categorie: string
          created_at: string
          donneur_ordre: string
          id: string
          libelle: string
          ordre: number
          prix_unitaire: number
          reference: string | null
          section: string | null
          unite: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          categorie: string
          created_at?: string
          donneur_ordre?: string
          id?: string
          libelle: string
          ordre?: number
          prix_unitaire?: number
          reference?: string | null
          section?: string | null
          unite?: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          categorie?: string
          created_at?: string
          donneur_ordre?: string
          id?: string
          libelle?: string
          ordre?: number
          prix_unitaire?: number
          reference?: string | null
          section?: string | null
          unite?: string
          updated_at?: string
        }
        Relationships: []
      }
      demande_photos: {
        Row: {
          created_at: string
          demande_id: string
          id: string
          kind: string
          path: string
        }
        Insert: {
          created_at?: string
          demande_id: string
          id?: string
          kind: string
          path: string
        }
        Update: {
          created_at?: string
          demande_id?: string
          id?: string
          kind?: string
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "demande_photos_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demande_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      demande_rate_limits: {
        Row: {
          created_at: string
          id: string
          ip: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip: string
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string
        }
        Relationships: []
      }
      demande_requests: {
        Row: {
          abonnement_kva: string | null
          code_postal: string
          created_at: string
          distance_m: number | null
          email: string
          formule: string | null
          id: string
          nb_bornes: number | null
          nom: string
          notes: string | null
          phase: string | null
          puissance: string | null
          status: string
          telephone: string
          type_bien: string | null
          type_compteur: string | null
          type_demande: string
          type_installation: string | null
          updated_at: string
        }
        Insert: {
          abonnement_kva?: string | null
          code_postal: string
          created_at?: string
          distance_m?: number | null
          email: string
          formule?: string | null
          id?: string
          nb_bornes?: number | null
          nom: string
          notes?: string | null
          phase?: string | null
          puissance?: string | null
          status?: string
          telephone: string
          type_bien?: string | null
          type_compteur?: string | null
          type_demande?: string
          type_installation?: string | null
          updated_at?: string
        }
        Update: {
          abonnement_kva?: string | null
          code_postal?: string
          created_at?: string
          distance_m?: number | null
          email?: string
          formule?: string | null
          id?: string
          nb_bornes?: number | null
          nom?: string
          notes?: string | null
          phase?: string | null
          puissance?: string | null
          status?: string
          telephone?: string
          type_bien?: string | null
          type_compteur?: string | null
          type_demande?: string
          type_installation?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      devis: {
        Row: {
          acompte_pct: number
          client_adresse: string | null
          client_cp_ville: string | null
          client_email: string | null
          client_nom: string
          client_telephone: string | null
          conditions_paiement: string | null
          created_at: string
          created_by: string | null
          date_emission: string
          date_expiration: string
          facture_id: string | null
          id: string
          last_viewed_at: string | null
          notes: string | null
          numero: string
          objet: string | null
          public_token: string
          remise_pct: number
          rendezvous_id: string | null
          sent_at: string | null
          signataire_nom: string | null
          signature_client: string | null
          signed_at: string | null
          statut: string
          total_ht: number
          total_ht_brut: number
          total_remise: number
          total_ttc: number
          total_tva: number
          updated_at: string
          view_count: number
          viewed_at: string | null
        }
        Insert: {
          acompte_pct?: number
          client_adresse?: string | null
          client_cp_ville?: string | null
          client_email?: string | null
          client_nom: string
          client_telephone?: string | null
          conditions_paiement?: string | null
          created_at?: string
          created_by?: string | null
          date_emission?: string
          date_expiration?: string
          facture_id?: string | null
          id?: string
          last_viewed_at?: string | null
          notes?: string | null
          numero: string
          objet?: string | null
          public_token?: string
          remise_pct?: number
          rendezvous_id?: string | null
          sent_at?: string | null
          signataire_nom?: string | null
          signature_client?: string | null
          signed_at?: string | null
          statut?: string
          total_ht?: number
          total_ht_brut?: number
          total_remise?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
          view_count?: number
          viewed_at?: string | null
        }
        Update: {
          acompte_pct?: number
          client_adresse?: string | null
          client_cp_ville?: string | null
          client_email?: string | null
          client_nom?: string
          client_telephone?: string | null
          conditions_paiement?: string | null
          created_at?: string
          created_by?: string | null
          date_emission?: string
          date_expiration?: string
          facture_id?: string | null
          id?: string
          last_viewed_at?: string | null
          notes?: string | null
          numero?: string
          objet?: string | null
          public_token?: string
          remise_pct?: number
          rendezvous_id?: string | null
          sent_at?: string | null
          signataire_nom?: string | null
          signature_client?: string | null
          signed_at?: string | null
          statut?: string
          total_ht?: number
          total_ht_brut?: number
          total_remise?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
          view_count?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_rendezvous_id_fkey"
            columns: ["rendezvous_id"]
            isOneToOne: false
            referencedRelation: "rendezvous"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_envois: {
        Row: {
          created_at: string
          created_by: string | null
          destinataire: string
          devis_id: string
          id: string
          message: string | null
          resultat: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destinataire: string
          devis_id: string
          id?: string
          message?: string | null
          resultat?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destinataire?: string
          devis_id?: string
          id?: string
          message?: string | null
          resultat?: string
        }
        Relationships: [
          {
            foreignKeyName: "devis_envois_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_items: {
        Row: {
          created_at: string
          description: string | null
          devis_id: string
          id: string
          libelle: string
          ordre: number
          prix_unitaire: number
          quantite: number
          tva: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          devis_id: string
          id?: string
          libelle: string
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          devis_id?: string
          id?: string
          libelle?: string
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
        }
        Relationships: [
          {
            foreignKeyName: "devis_items_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      donneurs_ordre: {
        Row: {
          actif: boolean
          adresse: string | null
          adresse_livraison: string | null
          autoliquidation: boolean
          charge_affaires_email: string | null
          charge_affaires_nom: string | null
          charge_affaires_telephone: string | null
          cp_ville: string | null
          created_at: string
          delai_paiement_jours: number
          id: string
          nom: string
          notes: string | null
          numero_fournisseur: string | null
          pays: string
          raison_sociale: string | null
          siret: string | null
          tva_intracom: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          adresse_livraison?: string | null
          autoliquidation?: boolean
          charge_affaires_email?: string | null
          charge_affaires_nom?: string | null
          charge_affaires_telephone?: string | null
          cp_ville?: string | null
          created_at?: string
          delai_paiement_jours?: number
          id?: string
          nom: string
          notes?: string | null
          numero_fournisseur?: string | null
          pays?: string
          raison_sociale?: string | null
          siret?: string | null
          tva_intracom?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          adresse_livraison?: string | null
          autoliquidation?: boolean
          charge_affaires_email?: string | null
          charge_affaires_nom?: string | null
          charge_affaires_telephone?: string | null
          cp_ville?: string | null
          created_at?: string
          delai_paiement_jours?: number
          id?: string
          nom?: string
          notes?: string | null
          numero_fournisseur?: string | null
          pays?: string
          raison_sociale?: string | null
          siret?: string | null
          tva_intracom?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      facture_items: {
        Row: {
          created_at: string
          description: string | null
          facture_id: string
          id: string
          libelle: string
          ordre: number
          prix_unitaire: number
          quantite: number
          tva: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          facture_id: string
          id?: string
          libelle: string
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          facture_id?: string
          id?: string
          libelle?: string
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          tva?: number
        }
        Relationships: [
          {
            foreignKeyName: "facture_items_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          acompte_pct: number
          activite: string
          attachement_id: string | null
          autoliquidation: boolean
          bon_commande: string | null
          client_adresse: string | null
          client_cp_ville: string | null
          client_email: string | null
          client_nom: string
          client_telephone: string | null
          conditions_paiement: string | null
          created_at: string
          created_by: string | null
          date_echeance: string
          date_emission: string
          devis_id: string | null
          id: string
          last_viewed_at: string | null
          notes: string | null
          numero: string
          numero_affaire: string | null
          numero_ticket: string | null
          objet: string | null
          paid_at: string | null
          public_token: string
          remise_pct: number
          sent_at: string | null
          statut: string
          total_ht: number
          total_ht_brut: number
          total_remise: number
          total_ttc: number
          total_tva: number
          updated_at: string
          view_count: number
          viewed_at: string | null
        }
        Insert: {
          acompte_pct?: number
          activite?: string
          attachement_id?: string | null
          autoliquidation?: boolean
          bon_commande?: string | null
          client_adresse?: string | null
          client_cp_ville?: string | null
          client_email?: string | null
          client_nom: string
          client_telephone?: string | null
          conditions_paiement?: string | null
          created_at?: string
          created_by?: string | null
          date_echeance?: string
          date_emission?: string
          devis_id?: string | null
          id?: string
          last_viewed_at?: string | null
          notes?: string | null
          numero: string
          numero_affaire?: string | null
          numero_ticket?: string | null
          objet?: string | null
          paid_at?: string | null
          public_token?: string
          remise_pct?: number
          sent_at?: string | null
          statut?: string
          total_ht?: number
          total_ht_brut?: number
          total_remise?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
          view_count?: number
          viewed_at?: string | null
        }
        Update: {
          acompte_pct?: number
          activite?: string
          attachement_id?: string | null
          autoliquidation?: boolean
          bon_commande?: string | null
          client_adresse?: string | null
          client_cp_ville?: string | null
          client_email?: string | null
          client_nom?: string
          client_telephone?: string | null
          conditions_paiement?: string | null
          created_at?: string
          created_by?: string | null
          date_echeance?: string
          date_emission?: string
          devis_id?: string | null
          id?: string
          last_viewed_at?: string | null
          notes?: string | null
          numero?: string
          numero_affaire?: string | null
          numero_ticket?: string | null
          objet?: string | null
          paid_at?: string | null
          public_token?: string
          remise_pct?: number
          sent_at?: string | null
          statut?: string
          total_ht?: number
          total_ht_brut?: number
          total_remise?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
          view_count?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factures_attachement_id_fkey"
            columns: ["attachement_id"]
            isOneToOne: false
            referencedRelation: "attachements_travaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lien: string | null
          lu_at: string | null
          message: string | null
          meta: Json
          montant: number | null
          titre: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lien?: string | null
          lu_at?: string | null
          message?: string | null
          meta?: Json
          montant?: number | null
          titre: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lien?: string | null
          lu_at?: string | null
          message?: string | null
          meta?: Json
          montant?: number | null
          titre?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      partenaire_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          partenaire_id: string
          token: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          partenaire_id: string
          token?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          partenaire_id?: string
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partenaire_sessions_partenaire_id_fkey"
            columns: ["partenaire_id"]
            isOneToOne: false
            referencedRelation: "partenaires"
            referencedColumns: ["id"]
          },
        ]
      }
      partenaires: {
        Row: {
          actif: boolean
          adresse: string | null
          contact_nom: string | null
          couleur: string
          cp_ville: string | null
          created_at: string
          delai_paiement_jours: number
          dernier_acces_at: string | null
          email: string | null
          id: string
          nom: string
          notes: string | null
          owner_user_id: string | null
          pays: string
          pin_defini_at: string | null
          pin_hash: string | null
          raison_sociale: string | null
          siret: string | null
          telephone: string | null
          token: string
          tva_intracom: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          contact_nom?: string | null
          couleur?: string
          cp_ville?: string | null
          created_at?: string
          delai_paiement_jours?: number
          dernier_acces_at?: string | null
          email?: string | null
          id?: string
          nom: string
          notes?: string | null
          owner_user_id?: string | null
          pays?: string
          pin_defini_at?: string | null
          pin_hash?: string | null
          raison_sociale?: string | null
          siret?: string | null
          telephone?: string | null
          token?: string
          tva_intracom?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          contact_nom?: string | null
          couleur?: string
          cp_ville?: string | null
          created_at?: string
          delai_paiement_jours?: number
          dernier_acces_at?: string | null
          email?: string | null
          id?: string
          nom?: string
          notes?: string | null
          owner_user_id?: string | null
          pays?: string
          pin_defini_at?: string | null
          pin_hash?: string | null
          raison_sociale?: string | null
          siret?: string | null
          telephone?: string | null
          token?: string
          tva_intracom?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prestations: {
        Row: {
          actif: boolean
          created_at: string
          description: string | null
          id: string
          libelle: string
          ordre: number
          prix_unitaire: number
          tva: number
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          libelle: string
          ordre?: number
          prix_unitaire?: number
          tva?: number
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          description?: string | null
          id?: string
          libelle?: string
          ordre?: number
          prix_unitaire?: number
          tva?: number
          updated_at?: string
        }
        Relationships: []
      }
      rapports: {
        Row: {
          borne_marque: string | null
          borne_modele: string | null
          borne_puissance: string | null
          borne_serie: string | null
          chantier_adresse: string | null
          chantier_cp_ville: string | null
          checklist: Json
          client_email: string | null
          client_nom: string
          client_telephone: string | null
          created_at: string
          date_intervention: string
          declaration_acceptee: boolean
          devis_id: string | null
          id: string
          mesures: Json
          numero: string
          observations: string | null
          photos: Json
          rendezvous_id: string | null
          reserves: string | null
          signataire_client: string | null
          signature_client: string | null
          signature_technicien: string | null
          technicien: string | null
          type: string
          typologie: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          borne_marque?: string | null
          borne_modele?: string | null
          borne_puissance?: string | null
          borne_serie?: string | null
          chantier_adresse?: string | null
          chantier_cp_ville?: string | null
          checklist?: Json
          client_email?: string | null
          client_nom: string
          client_telephone?: string | null
          created_at?: string
          date_intervention?: string
          declaration_acceptee?: boolean
          devis_id?: string | null
          id?: string
          mesures?: Json
          numero: string
          observations?: string | null
          photos?: Json
          rendezvous_id?: string | null
          reserves?: string | null
          signataire_client?: string | null
          signature_client?: string | null
          signature_technicien?: string | null
          technicien?: string | null
          type?: string
          typologie?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          borne_marque?: string | null
          borne_modele?: string | null
          borne_puissance?: string | null
          borne_serie?: string | null
          chantier_adresse?: string | null
          chantier_cp_ville?: string | null
          checklist?: Json
          client_email?: string | null
          client_nom?: string
          client_telephone?: string | null
          created_at?: string
          date_intervention?: string
          declaration_acceptee?: boolean
          devis_id?: string | null
          id?: string
          mesures?: Json
          numero?: string
          observations?: string | null
          photos?: Json
          rendezvous_id?: string | null
          reserves?: string | null
          signataire_client?: string | null
          signature_client?: string | null
          signature_technicien?: string | null
          technicien?: string | null
          type?: string
          typologie?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rapports_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rapports_rendezvous_id_fkey"
            columns: ["rendezvous_id"]
            isOneToOne: false
            referencedRelation: "rendezvous"
            referencedColumns: ["id"]
          },
        ]
      }
      realisations: {
        Row: {
          created_at: string
          description: string
          id: string
          lieu: string
          photo_path: string | null
          position: number
          publie: boolean
          titre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          lieu?: string
          photo_path?: string | null
          position?: number
          publie?: boolean
          titre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          lieu?: string
          photo_path?: string | null
          position?: number
          publie?: boolean
          titre?: string
          updated_at?: string
        }
        Relationships: []
      }
      rendezvous: {
        Row: {
          adresse: string
          archive: boolean
          archive_at: string | null
          chantier_commentaire: string | null
          chantier_valide: boolean
          chantier_valide_at: string | null
          chantier_valide_par: string | null
          client_email: string | null
          client_nom: string
          client_telephone: string | null
          cp_ville: string | null
          created_at: string
          date_a_confirmer: boolean
          date_debut: string
          delai_paiement_jours: number | null
          demande_id: string | null
          demarre_at: string | null
          designation: string | null
          distance_km: number | null
          duree_min: number
          duree_trajet_min: number | null
          echeance_paiement: string | null
          etiquettes: string[]
          facture_envoyee_at: string | null
          id: string
          lat: number | null
          lng: number | null
          materiel_fourni: Json
          materiel_maj_at: string | null
          materiel_statut: string
          metrage_inclus_m: number
          metrage_m: number | null
          metrage_reel_m: number | null
          montant_ht: number
          montant_propose_at: string | null
          montant_propose_ht: number | null
          montant_propose_note: string | null
          montant_propose_par: string | null
          montant_valide_at: string | null
          nature_dossier: string | null
          notes: string | null
          notif_archive_at: string | null
          notif_fin_at: string | null
          origine: string
          partenaire: string | null
          partenaire_id: string | null
          paye_at: string | null
          phase_installation: string | null
          photos_zip_downloaded_at: string | null
          public_token: string
          puissance_borne: string | null
          rdv_client_message: string | null
          rdv_confirme_at: string | null
          rdv_propose_at: string | null
          rdv_refuse_at: string | null
          retour_complete_at: string | null
          retour_delestage: boolean
          retour_observations: string | null
          statut: string
          statut_facturation: string
          technicien: string | null
          termine_at: string | null
          titre: string
          tva_pct: number
          type: string
          type_pose: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adresse: string
          archive?: boolean
          archive_at?: string | null
          chantier_commentaire?: string | null
          chantier_valide?: boolean
          chantier_valide_at?: string | null
          chantier_valide_par?: string | null
          client_email?: string | null
          client_nom: string
          client_telephone?: string | null
          cp_ville?: string | null
          created_at?: string
          date_a_confirmer?: boolean
          date_debut: string
          delai_paiement_jours?: number | null
          demande_id?: string | null
          demarre_at?: string | null
          designation?: string | null
          distance_km?: number | null
          duree_min?: number
          duree_trajet_min?: number | null
          echeance_paiement?: string | null
          etiquettes?: string[]
          facture_envoyee_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          materiel_fourni?: Json
          materiel_maj_at?: string | null
          materiel_statut?: string
          metrage_inclus_m?: number
          metrage_m?: number | null
          metrage_reel_m?: number | null
          montant_ht?: number
          montant_propose_at?: string | null
          montant_propose_ht?: number | null
          montant_propose_note?: string | null
          montant_propose_par?: string | null
          montant_valide_at?: string | null
          nature_dossier?: string | null
          notes?: string | null
          notif_archive_at?: string | null
          notif_fin_at?: string | null
          origine?: string
          partenaire?: string | null
          partenaire_id?: string | null
          paye_at?: string | null
          phase_installation?: string | null
          photos_zip_downloaded_at?: string | null
          public_token?: string
          puissance_borne?: string | null
          rdv_client_message?: string | null
          rdv_confirme_at?: string | null
          rdv_propose_at?: string | null
          rdv_refuse_at?: string | null
          retour_complete_at?: string | null
          retour_delestage?: boolean
          retour_observations?: string | null
          statut?: string
          statut_facturation?: string
          technicien?: string | null
          termine_at?: string | null
          titre: string
          tva_pct?: number
          type?: string
          type_pose?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adresse?: string
          archive?: boolean
          archive_at?: string | null
          chantier_commentaire?: string | null
          chantier_valide?: boolean
          chantier_valide_at?: string | null
          chantier_valide_par?: string | null
          client_email?: string | null
          client_nom?: string
          client_telephone?: string | null
          cp_ville?: string | null
          created_at?: string
          date_a_confirmer?: boolean
          date_debut?: string
          delai_paiement_jours?: number | null
          demande_id?: string | null
          demarre_at?: string | null
          designation?: string | null
          distance_km?: number | null
          duree_min?: number
          duree_trajet_min?: number | null
          echeance_paiement?: string | null
          etiquettes?: string[]
          facture_envoyee_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          materiel_fourni?: Json
          materiel_maj_at?: string | null
          materiel_statut?: string
          metrage_inclus_m?: number
          metrage_m?: number | null
          metrage_reel_m?: number | null
          montant_ht?: number
          montant_propose_at?: string | null
          montant_propose_ht?: number | null
          montant_propose_note?: string | null
          montant_propose_par?: string | null
          montant_valide_at?: string | null
          nature_dossier?: string | null
          notes?: string | null
          notif_archive_at?: string | null
          notif_fin_at?: string | null
          origine?: string
          partenaire?: string | null
          partenaire_id?: string | null
          paye_at?: string | null
          phase_installation?: string | null
          photos_zip_downloaded_at?: string | null
          public_token?: string
          puissance_borne?: string | null
          rdv_client_message?: string | null
          rdv_confirme_at?: string | null
          rdv_propose_at?: string | null
          rdv_refuse_at?: string | null
          retour_complete_at?: string | null
          retour_delestage?: boolean
          retour_observations?: string | null
          statut?: string
          statut_facturation?: string
          technicien?: string | null
          termine_at?: string | null
          titre?: string
          tva_pct?: number
          type?: string
          type_pose?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rendezvous_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demande_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendezvous_partenaire_id_fkey"
            columns: ["partenaire_id"]
            isOneToOne: false
            referencedRelation: "partenaires"
            referencedColumns: ["id"]
          },
        ]
      }
      rendezvous_photos: {
        Row: {
          categorie: string
          created_at: string
          id: string
          legende: string | null
          path: string
          rendezvous_id: string
          source: string
        }
        Insert: {
          categorie?: string
          created_at?: string
          id?: string
          legende?: string | null
          path: string
          rendezvous_id: string
          source?: string
        }
        Update: {
          categorie?: string
          created_at?: string
          id?: string
          legende?: string | null
          path?: string
          rendezvous_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "rendezvous_photos_rendezvous_id_fkey"
            columns: ["rendezvous_id"]
            isOneToOne: false
            referencedRelation: "rendezvous"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voirie_autorisations: {
        Row: {
          autorite: string | null
          created_at: string
          created_by: string | null
          date_demande: string | null
          date_fin: string | null
          date_obtention: string | null
          document_path: string | null
          id: string
          notes: string | null
          reference: string | null
          rendezvous_id: string
          statut: string
          updated_at: string
        }
        Insert: {
          autorite?: string | null
          created_at?: string
          created_by?: string | null
          date_demande?: string | null
          date_fin?: string | null
          date_obtention?: string | null
          document_path?: string | null
          id?: string
          notes?: string | null
          reference?: string | null
          rendezvous_id: string
          statut?: string
          updated_at?: string
        }
        Update: {
          autorite?: string | null
          created_at?: string
          created_by?: string | null
          date_demande?: string | null
          date_fin?: string | null
          date_obtention?: string | null
          document_path?: string | null
          id?: string
          notes?: string | null
          reference?: string | null
          rendezvous_id?: string
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voirie_autorisations_rendezvous_id_fkey"
            columns: ["rendezvous_id"]
            isOneToOne: false
            referencedRelation: "rendezvous"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "user"],
    },
  },
} as const
