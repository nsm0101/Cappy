// AUTO-GENERATED from the live cappy-dev schema (project hyfmcwswtjlnxtdspggr).
// Regenerate with: pnpm supabase:gen-types
// Do not edit by hand.

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
      audit_events: {
        Row: {
          action: string
          actor_kind: string
          actor_user_id: string | null
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
          occurred_at: string
        }
        Insert: {
          action: string
          actor_kind: string
          actor_user_id?: string | null
          entity_id?: string | null
          entity_type: string
          id?: number
          metadata?: Json
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_kind?: string
          actor_user_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: number
          metadata?: Json
          occurred_at?: string
        }
        Relationships: []
      }
      caregiver_child_access: {
        Row: {
          access_level: string
          child_id: string
          created_at: string
          family_caregiver_id: string
          id: string
        }
        Insert: {
          access_level: string
          child_id: string
          created_at?: string
          family_caregiver_id: string
          id?: string
        }
        Update: {
          access_level?: string
          child_id?: string
          created_at?: string
          family_caregiver_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_child_access_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caregiver_child_access_family_caregiver_id_fkey"
            columns: ["family_caregiver_id"]
            isOneToOne: false
            referencedRelation: "family_caregivers"
            referencedColumns: ["id"]
          },
        ]
      }
      child_allergies: {
        Row: {
          allergen: string
          child_id: string
          created_at: string
          created_by: string
          id: string
          label: string
        }
        Insert: {
          allergen: string
          child_id: string
          created_at?: string
          created_by: string
          id?: string
          label: string
        }
        Update: {
          allergen?: string
          child_id?: string
          created_at?: string
          created_by?: string
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_allergies_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_allergies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string
          deleted_at: string | null
          display_name: string
          family_id: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth: string
          deleted_at?: string | null
          display_name: string
          family_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string
          deleted_at?: string | null
          display_name?: string
          family_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      dose_corrections: {
        Row: {
          corrected_at: string
          corrected_by: string
          correction_dose_event_id: string
          id: string
          original_dose_event_id: string
          reason: string | null
        }
        Insert: {
          corrected_at?: string
          corrected_by: string
          correction_dose_event_id: string
          id?: string
          original_dose_event_id: string
          reason?: string | null
        }
        Update: {
          corrected_at?: string
          corrected_by?: string
          correction_dose_event_id?: string
          id?: string
          original_dose_event_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dose_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_corrections_correction_dose_event_id_fkey"
            columns: ["correction_dose_event_id"]
            isOneToOne: false
            referencedRelation: "dose_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_corrections_original_dose_event_id_fkey"
            columns: ["original_dose_event_id"]
            isOneToOne: false
            referencedRelation: "dose_events"
            referencedColumns: ["id"]
          },
        ]
      }
      dose_events: {
        Row: {
          amount_mg: number
          amount_volume_ml: number | null
          caregiver_user_id: string | null
          child_id: string | null
          family_id: string
          given_at: string
          id: string
          logged_at: string
          logged_by: string
          medication_id: string
          note: string | null
          status: Database["public"]["Enums"]["dose_status"]
          unit_count: number | null
        }
        Insert: {
          amount_mg: number
          amount_volume_ml?: number | null
          caregiver_user_id?: string | null
          child_id?: string | null
          family_id: string
          given_at: string
          id: string
          logged_at?: string
          logged_by: string
          medication_id: string
          note?: string | null
          status?: Database["public"]["Enums"]["dose_status"]
          unit_count?: number | null
        }
        Update: {
          amount_mg?: number
          amount_volume_ml?: number | null
          caregiver_user_id?: string | null
          child_id?: string | null
          family_id?: string
          given_at?: string
          id?: string
          logged_at?: string
          logged_by?: string
          medication_id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["dose_status"]
          unit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dose_events_caregiver_user_id_fkey"
            columns: ["caregiver_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_events_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_events_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_events_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_caregivers: {
        Row: {
          created_at: string
          expires_at: string | null
          family_id: string
          id: string
          joined_at: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["caregiver_role"]
          status: Database["public"]["Enums"]["caregiver_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          family_id: string
          id?: string
          joined_at?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["caregiver_role"]
          status?: Database["public"]["Enums"]["caregiver_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          family_id?: string
          id?: string
          joined_at?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["caregiver_role"]
          status?: Database["public"]["Enums"]["caregiver_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_caregivers_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_caregivers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_med_brands: {
        Row: {
          brand_key: string
          family_id: string
          generic: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          brand_key: string
          family_id: string
          generic: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          brand_key?: string
          family_id?: string
          generic?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_med_brands_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_med_brands_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          code: string
          created_at: string
          created_by: string
          expires_at: string
          family_id: string
          guest_expires_hours: number | null
          id: string
          proposed_role: Database["public"]["Enums"]["caregiver_role"]
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          family_id: string
          guest_expires_hours?: number | null
          id?: string
          proposed_role: Database["public"]["Enums"]["caregiver_role"]
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          family_id?: string
          guest_expires_hours?: number | null
          id?: string
          proposed_role?: Database["public"]["Enums"]["caregiver_role"]
        }
        Relationships: [
          {
            foreignKeyName: "invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          brand_name: string | null
          concentration_label: string
          concentration_mg_per_ml: number
          created_at: string
          formulation: Database["public"]["Enums"]["medication_formulation"]
          generic_name: string
          id: string
          max_doses_per_24h: number
          min_age_months: number
          min_interval_hours: number
          rx_status: Database["public"]["Enums"]["medication_rx_status"]
        }
        Insert: {
          brand_name?: string | null
          concentration_label: string
          concentration_mg_per_ml?: number
          created_at?: string
          formulation: Database["public"]["Enums"]["medication_formulation"]
          generic_name: string
          id?: string
          max_doses_per_24h?: number
          min_age_months?: number
          min_interval_hours?: number
          rx_status?: Database["public"]["Enums"]["medication_rx_status"]
        }
        Update: {
          brand_name?: string | null
          concentration_label?: string
          concentration_mg_per_ml?: number
          created_at?: string
          formulation?: Database["public"]["Enums"]["medication_formulation"]
          generic_name?: string
          id?: string
          max_doses_per_24h?: number
          min_age_months?: number
          min_interval_hours?: number
          rx_status?: Database["public"]["Enums"]["medication_rx_status"]
        }
        Relationships: []
      }
      nfc_tags: {
        Row: {
          family_id: string
          id: string
          label: string | null
          medication_id: string
          registered_at: string
          registered_by: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["tag_status"]
          tag_uid: string
        }
        Insert: {
          family_id: string
          id?: string
          label?: string | null
          medication_id: string
          registered_at?: string
          registered_by: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["tag_status"]
          tag_uid: string
        }
        Update: {
          family_id?: string
          id?: string
          label?: string | null
          medication_id?: string
          registered_at?: string
          registered_by?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["tag_status"]
          tag_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfc_tags_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfc_tags_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfc_tags_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          consent_accepted_at: string | null
          consent_version: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          consent_accepted_at?: string | null
          consent_version?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          consent_accepted_at?: string | null
          consent_version?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      weight_records: {
        Row: {
          child_id: string
          created_at: string
          id: string
          recorded_at: string
          recorded_by: string
          value_grams: number
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          recorded_at: string
          recorded_by: string
          value_grams: number
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          recorded_at?: string
          recorded_by?: string
          value_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_records_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_log_dose_for_caregiver: {
        Args: { family_uuid: string; target_user_id: string }
        Returns: boolean
      }
      can_log_dose_for_child: { Args: { child_uuid: string }; Returns: boolean }
      compute_dose_status: {
        Args: {
          caregiver_uuid?: string
          child_uuid?: string
          medication_uuid: string
        }
        Returns: {
          doses_in_last_24h: number
          last_dose_at: string
          next_safe_at: string
          status: string
        }[]
      }
      is_family_member: {
        Args: {
          family_uuid: string
          required_roles?: Database["public"]["Enums"]["caregiver_role"][]
        }
        Returns: boolean
      }
    }
    Enums: {
      caregiver_role: "admin" | "caregiver" | "readonly" | "guest"
      caregiver_status: "active" | "revoked" | "pending"
      dose_status: "active" | "superseded"
      medication_formulation:
        | "liquid_suspension"
        | "infant_drops"
        | "chewable"
        | "oral_disintegrating"
      medication_rx_status: "otc" | "rx"
      tag_status: "active" | "revoked" | "pending"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      caregiver_role: ["admin", "caregiver", "readonly", "guest"],
      caregiver_status: ["active", "revoked", "pending"],
      dose_status: ["active", "superseded"],
      medication_formulation: [
        "liquid_suspension",
        "infant_drops",
        "chewable",
        "oral_disintegrating",
      ],
      medication_rx_status: ["otc", "rx"],
      tag_status: ["active", "revoked", "pending"],
    },
  },
} as const
