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
      activity_logs: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
          target: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          id?: string
          target: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
          target?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          attrs: Json
          created_at: string
          hash: string
          id: string
          name: string
          prefix: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attrs?: Json
          created_at?: string
          hash: string
          id?: string
          name: string
          prefix: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attrs?: Json
          created_at?: string
          hash?: string
          id?: string
          name?: string
          prefix?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          created_at: string
          duration_ms: number
          id: string
          key_id: string | null
          method: string
          path: string
          request_id: string
          status: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          id?: string
          key_id?: string | null
          method: string
          path: string
          request_id: string
          status: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number
          id?: string
          key_id?: string | null
          method?: string
          path?: string
          request_id?: string
          status?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_run_actions: {
        Row: {
          action_id: string
          attrs: Json
          id: string
          idempotency_key: string
          run_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          action_id: string
          attrs?: Json
          id?: string
          idempotency_key: string
          run_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          action_id?: string
          attrs?: Json
          id?: string
          idempotency_key?: string
          run_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_run_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          attrs: Json
          automation_id: string
          id: string
          started_at: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attrs?: Json
          automation_id: string
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attrs?: Json
          automation_id?: string
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          attrs: Json
          created_at: string
          id: string
          name: string
          status: string
          trigger_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attrs?: Json
          created_at?: string
          id?: string
          name: string
          status?: string
          trigger_type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attrs?: Json
          created_at?: string
          id?: string
          name?: string
          status?: string
          trigger_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      config_entries: {
        Row: {
          key: string
          updated_at: string
          value: Json
          workspace_id: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
          workspace_id: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_tokens: {
        Row: {
          connection_id: string
          created_at: string
          sealed_token: string
          updated_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          sealed_token: string
          updated_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          sealed_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_tokens_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          attrs: Json
          created_at: string
          id: string
          name: string
          provider_id: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attrs?: Json
          created_at?: string
          id?: string
          name: string
          provider_id: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attrs?: Json
          created_at?: string
          id?: string
          name?: string
          provider_id?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          last_rotated_at: string | null
          masked_value: string
          provider_id: string | null
          rotation_days: number
          sealed_value: string
          status: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          last_rotated_at?: string | null
          masked_value: string
          provider_id?: string | null
          rotation_days?: number
          sealed_value: string
          status?: string
          type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          last_rotated_at?: string | null
          masked_value?: string
          provider_id?: string | null
          rotation_days?: number
          sealed_value?: string
          status?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      drives: {
        Row: {
          attrs: Json
          connection_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attrs?: Json
          connection_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attrs?: Json
          connection_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drives_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drives_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          enabled?: boolean
          key: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          enabled?: boolean
          key?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          attrs: Json
          connection_id: string
          created_at: string
          id: string
          kind: string
          modified_at: string
          name: string
          path: string
          provider_file_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attrs?: Json
          connection_id: string
          created_at?: string
          id?: string
          kind?: string
          modified_at?: string
          name: string
          path?: string
          provider_file_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attrs?: Json
          connection_id?: string
          created_at?: string
          id?: string
          kind?: string
          modified_at?: string
          name?: string
          path?: string
          provider_file_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      job_logs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          message: string
          severity: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          message: string
          severity?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          message?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attrs: Json
          created_at: string
          id: string
          kind: string
          priority: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attrs?: Json
          created_at?: string
          id?: string
          kind: string
          priority?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attrs?: Json
          created_at?: string
          id?: string
          kind?: string
          priority?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          enabled: boolean
          id: string
          installed_at: string
          key: string
          manifest: Json
          permissions: Json
          updated_at: string
          version: string
          workspace_id: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          installed_at?: string
          key: string
          manifest?: Json
          permissions?: Json
          updated_at?: string
          version: string
          workspace_id: string
        }
        Update: {
          enabled?: boolean
          id?: string
          installed_at?: string
          key?: string
          manifest?: Json
          permissions?: Json
          updated_at?: string
          version?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email: string
          id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_states: {
        Row: {
          checked_at: string | null
          enabled: boolean
          health: string
          provider_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          checked_at?: string | null
          enabled?: boolean
          health?: string
          provider_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          checked_at?: string | null
          enabled?: boolean
          health?: string
          provider_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      share_access_logs: {
        Row: {
          attrs: Json
          created_at: string
          id: string
          share_id: string
        }
        Insert: {
          attrs?: Json
          created_at?: string
          id?: string
          share_id: string
        }
        Update: {
          attrs?: Json
          created_at?: string
          id?: string
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_access_logs_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "shares"
            referencedColumns: ["id"]
          },
        ]
      }
      shares: {
        Row: {
          attrs: Json
          created_at: string
          drive_id: string | null
          id: string
          status: string
          token: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attrs?: Json
          created_at?: string
          drive_id?: string | null
          id?: string
          status?: string
          token: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attrs?: Json
          created_at?: string
          drive_id?: string | null
          id?: string
          status?: string
          token?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_drive_id_fkey"
            columns: ["drive_id"]
            isOneToOne: false
            referencedRelation: "drives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shares_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_history: {
        Row: {
          changes: number
          conflicts: number
          connection_id: string | null
          created_at: string
          id: string
          sync_id: string | null
          workspace_id: string
        }
        Insert: {
          changes?: number
          conflicts?: number
          connection_id?: string | null
          created_at?: string
          id?: string
          sync_id?: string | null
          workspace_id: string
        }
        Update: {
          changes?: number
          conflicts?: number
          connection_id?: string | null
          created_at?: string
          id?: string
          sync_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          attrs: Json
          connection_id: string | null
          id: string
          started_at: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attrs?: Json
          connection_id?: string | null
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attrs?: Json
          connection_id?: string | null
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          category: string
          context: Json
          created_at: string
          id: string
          message: string
          provider_id: string | null
          severity: string
          workspace_id: string
        }
        Insert: {
          category: string
          context?: Json
          created_at?: string
          id?: string
          message: string
          provider_id?: string | null
          severity: string
          workspace_id: string
        }
        Update: {
          category?: string
          context?: Json
          created_at?: string
          id?: string
          message?: string
          provider_id?: string | null
          severity?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          attrs: Json
          connection_id: string | null
          created_at: string
          id: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attrs?: Json
          connection_id?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attrs?: Json
          connection_id?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      webhook_deliveries: {
        Row: {
          attrs: Json
          created_at: string
          endpoint_id: string
          event_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          attrs?: Json
          created_at?: string
          endpoint_id: string
          event_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attrs?: Json
          created_at?: string
          endpoint_id?: string
          event_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          attrs: Json
          created_at: string
          id: string
          status: string
          updated_at: string
          url: string
          workspace_id: string
        }
        Insert: {
          attrs?: Json
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          url: string
          workspace_id: string
        }
        Update: {
          attrs?: Json
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          created_at: string
          data: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_profile_workspace_id: { Args: never; Returns: string }
      current_workspace_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "member"
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
      app_role: ["owner", "admin", "member"],
    },
  },
} as const
