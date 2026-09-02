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
          code_postal: string
          created_at: string
          distance_m: number | null
          email: string
          formule: string | null
          id: string
          nom: string
          notes: string | null
          puissance: string | null
          status: string
          telephone: string
          type_bien: string | null
          type_installation: string | null
          updated_at: string
        }
        Insert: {
          code_postal: string
          created_at?: string
          distance_m?: number | null
          email: string
          formule?: string | null
          id?: string
          nom: string
          notes?: string | null
          puissance?: string | null
          status?: string
          telephone: string
          type_bien?: string | null
          type_installation?: string | null
          updated_at?: string
        }
        Update: {
          code_postal?: string
          created_at?: string
          distance_m?: number | null
          email?: string
          formule?: string | null
          id?: string
          nom?: string
          notes?: string | null
          puissance?: string | null
          status?: string
          telephone?: string
          type_bien?: string | null
          type_installation?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      devis: {
        Row: {
          client_adresse: string | null
          client_cp_ville: string | null
          client_email: string | null
          client_nom: string
          client_telephone: string | null
          created_at: string
          created_by: string | null
          date_emission: string
          date_expiration: string
          id: string
          notes: string | null
          numero: string
          objet: string | null
          remise_pct: number
          sent_at: string | null
          statut: string
          total_ht: number
          total_ttc: number
          total_tva: number
          updated_at: string
        }
        Insert: {
          client_adresse?: string | null
          client_cp_ville?: string | null
          client_email?: string | null
          client_nom: string
          client_telephone?: string | null
          created_at?: string
          created_by?: string | null
          date_emission?: string
          date_expiration?: string
          id?: string
          notes?: string | null
          numero: string
          objet?: string | null
          remise_pct?: number
          sent_at?: string | null
          statut?: string
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
        }
        Update: {
          client_adresse?: string | null
          client_cp_ville?: string | null
          client_email?: string | null
          client_nom?: string
          client_telephone?: string | null
          created_at?: string
          created_by?: string | null
          date_emission?: string
          date_expiration?: string
          id?: string
          notes?: string | null
          numero?: string
          objet?: string | null
          remise_pct?: number
          sent_at?: string | null
          statut?: string
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
        }
        Relationships: []
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
