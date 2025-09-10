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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          created_at: string
          description: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          project_id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          project_id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          project_id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dailies: {
        Row: {
          content: Json | null
          created_at: string
          date: string
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          date: string
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          date?: string
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dailies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_tasks: {
        Row: {
          created_at: string
          daily_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          daily_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          daily_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_tasks_daily_id_fkey"
            columns: ["daily_id"]
            isOneToOne: false
            referencedRelation: "dailies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          incident_id: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          incident_id: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          incident_id?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_comments_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          additional_comments: string | null
          assigned_to: string | null
          category: Database["public"]["Enums"]["incident_category"]
          created_at: string
          created_by: string | null
          description: string | null
          device: string | null
          environment: string | null
          epic: string | null
          evidence: string | null
          id: string
          incident_number: number
          name: string
          occurred_at: string
          project_id: string
          status: Database["public"]["Enums"]["incident_status"]
          updated_at: string
        }
        Insert: {
          additional_comments?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["incident_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          device?: string | null
          environment?: string | null
          epic?: string | null
          evidence?: string | null
          id?: string
          incident_number?: number
          name: string
          occurred_at?: string
          project_id: string
          status?: Database["public"]["Enums"]["incident_status"]
          updated_at?: string
        }
        Update: {
          additional_comments?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["incident_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          device?: string | null
          environment?: string | null
          epic?: string | null
          evidence?: string | null
          id?: string
          incident_number?: number
          name?: string
          occurred_at?: string
          project_id?: string
          status?: Database["public"]["Enums"]["incident_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      interesting_links: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "interesting_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          project_id: string
          role: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          project_id: string
          role: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          color: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_access: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          created_by: string | null
          dailies_password: string
          id: string
          logo_url: string | null
          name: string
          project_number: number
          project_password: string
          theme_color: string
          updated_at: string
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          dailies_password: string
          id?: string
          logo_url?: string | null
          name: string
          project_number?: number
          project_password: string
          theme_color?: string
          updated_at?: string
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          dailies_password?: string
          id?: string
          logo_url?: string | null
          name?: string
          project_number?: number
          project_password?: string
          theme_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      releases: {
        Row: {
          created_at: string
          description: string | null
          id: string
          platform: string
          project_id: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          platform: string
          project_id: string
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          platform?: string
          project_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "releases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      repository_files: {
        Row: {
          content_type: string | null
          created_at: string
          description: string | null
          file_path: string
          file_size: number | null
          id: string
          name: string
          password_hash: string | null
          password_required: boolean
          project_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          description?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          name: string
          password_hash?: string | null
          password_required?: boolean
          project_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          name?: string
          password_hash?: string | null
          password_required?: boolean
          project_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      shared_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          last_edited_by: string | null
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          last_edited_by?: string | null
          project_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          last_edited_by?: string | null
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_notes_history: {
        Row: {
          content: string
          created_at: string
          edited_by: string | null
          id: string
          note_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          edited_by?: string | null
          id?: string
          note_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_by?: string | null
          id?: string
          note_id?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          daily_id: string | null
          description: string | null
          id: string
          incident_id: string | null
          is_completed: boolean
          person_id: string | null
          project_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          daily_id?: string | null
          description?: string | null
          id?: string
          incident_id?: string | null
          is_completed?: boolean
          person_id?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          daily_id?: string | null
          description?: string | null
          id?: string
          incident_id?: string | null
          is_completed?: boolean
          person_id?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_daily_id_fkey"
            columns: ["daily_id"]
            isOneToOne: false
            referencedRelation: "dailies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_access: boolean
          created_at: string
          id: string
          project_id: string
          section: string
          section_new: Database["public"]["Enums"]["project_section"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          id?: string
          project_id: string
          section: string
          section_new?: Database["public"]["Enums"]["project_section"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          id?: string
          project_id?: string
          section?: string
          section_new?: Database["public"]["Enums"]["project_section"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vacations: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          person_id: string | null
          project_id: string
          start_date: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          person_id?: string | null
          project_id: string
          start_date: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          person_id?: string | null
          project_id?: string
          start_date?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_user_to_project: {
        Args: { granted_by_id?: string; project_id: string; user_email: string }
        Returns: Json
      }
      current_user_is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      delete_shared_note: {
        Args: { note_id: string }
        Returns: undefined
      }
      find_user_by_email: {
        Args: { user_email: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          is_active: boolean
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      incident_category: "incident" | "improvement"
      incident_status:
        | "pending"
        | "in_progress"
        | "closed"
        | "in_qa"
        | "resolved"
      project_section:
        | "home"
        | "tasks"
        | "dailies"
        | "notes"
        | "repository"
        | "team"
        | "contacts"
        | "releases"
        | "vacations"
        | "settings"
        | "users"
      task_status: "pending" | "in_progress" | "resolved"
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
      app_role: ["admin", "moderator", "user"],
      incident_category: ["incident", "improvement"],
      incident_status: [
        "pending",
        "in_progress",
        "closed",
        "in_qa",
        "resolved",
      ],
      project_section: [
        "home",
        "tasks",
        "dailies",
        "notes",
        "repository",
        "team",
        "contacts",
        "releases",
        "vacations",
        "settings",
        "users",
      ],
      task_status: ["pending", "in_progress", "resolved"],
    },
  },
} as const
