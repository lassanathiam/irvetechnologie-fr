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
          nom: string
          notes: string | null
          phase: string | null
          puissance: string | null
          status: string
          telephone: string
          type_bien: string | null
          type_compteur: string | null
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
          nom: string
          notes?: string | null
          phase?: string | null
          puissance?: string | null
          status?: string
          telephone: string
          type_bien?: string | null
          type_compteur?: string | null
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
          nom?: string
          notes?: string | null
          phase?: string | null
          puissance?: string | null
          status?: string
          telephone?: string
          type_bien?: string | null
          type_compteur?: string | null
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
            foreignKeyName: "factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      partenaires: {
        Row: {
          actif: boolean
          created_at: string
          id: string
          nom: string
          notes: string | null
          owner_user_id: string | null
          token: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          id?: string
          nom: string
          notes?: string | null
          owner_user_id?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          id?: string
          nom?: string
          notes?: string | null
          owner_user_id?: string | null
          token?: string
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
          demande_id: string | null
          designation: string | null
          distance_km: number | null
          duree_min: number
          duree_trajet_min: number | null
          etiquettes: string[]
          id: string
          lat: number | null
          lng: number | null
          montant_ht: number
          notes: string | null
          origine: string
          partenaire: string | null
          partenaire_id: string | null
          statut: string
          statut_facturation: string
          technicien: string | null
          titre: string
          tva_pct: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adresse: string
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
          demande_id?: string | null
          designation?: string | null
          distance_km?: number | null
          duree_min?: number
          duree_trajet_min?: number | null
          etiquettes?: string[]
          id?: string
          lat?: number | null
          lng?: number | null
          montant_ht?: number
          notes?: string | null
          origine?: string
          partenaire?: string | null
          partenaire_id?: string | null
          statut?: string
          statut_facturation?: string
          technicien?: string | null
          titre: string
          tva_pct?: number
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adresse?: string
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
          demande_id?: string | null
          designation?: string | null
          distance_km?: number | null
          duree_min?: number
          duree_trajet_min?: number | null
          etiquettes?: string[]
          id?: string
          lat?: number | null
          lng?: number | null
          montant_ht?: number
          notes?: string | null
          origine?: string
          partenaire?: string | null
          partenaire_id?: string | null
          statut?: string
          statut_facturation?: string
          technicien?: string | null
          titre?: string
          tva_pct?: number
          type?: string
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
