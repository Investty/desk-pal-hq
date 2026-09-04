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
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          user_id: string
          working_hours: number | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          user_id: string
          working_hours?: number | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          user_id?: string
          working_hours?: number | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          created_at: string
          document_type: string
          file_path: string
          id: string
          title: string
          updated_at: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          file_path: string
          id?: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_path?: string
          id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          is_recurring: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_recurring?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          created_at: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          remaining_days: number
          total_days: number
          updated_at: string
          used_days: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          remaining_days?: number
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          remaining_days?: number
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id?: string
        }
        Relationships: []
      }
      leave_policies: {
        Row: {
          created_at: string
          default_days: number
          id: string
          is_enabled: boolean
          label: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_days?: number
          id?: string
          is_enabled?: boolean
          label: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_days?: number
          id?: string
          is_enabled?: boolean
          label?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          end_date: string
          hr_comment: string | null
          hr_reviewed_at: string | null
          hr_reviewed_by: string | null
          hr_status: Database["public"]["Enums"]["approval_stage_status"]
          id: string
          is_public: boolean
          leave_type: Database["public"]["Enums"]["leave_type"]
          manager_comment: string | null
          manager_reviewed_at: string | null
          manager_reviewed_by: string | null
          manager_status: Database["public"]["Enums"]["approval_stage_status"]
          reason: string | null
          reviewed_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          end_date: string
          hr_comment?: string | null
          hr_reviewed_at?: string | null
          hr_reviewed_by?: string | null
          hr_status?: Database["public"]["Enums"]["approval_stage_status"]
          id?: string
          is_public?: boolean
          leave_type: Database["public"]["Enums"]["leave_type"]
          manager_comment?: string | null
          manager_reviewed_at?: string | null
          manager_reviewed_by?: string | null
          manager_status?: Database["public"]["Enums"]["approval_stage_status"]
          reason?: string | null
          reviewed_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          end_date?: string
          hr_comment?: string | null
          hr_reviewed_at?: string | null
          hr_reviewed_by?: string | null
          hr_status?: Database["public"]["Enums"]["approval_stage_status"]
          id?: string
          is_public?: boolean
          leave_type?: Database["public"]["Enums"]["leave_type"]
          manager_comment?: string | null
          manager_reviewed_at?: string | null
          manager_reviewed_by?: string | null
          manager_status?: Database["public"]["Enums"]["approval_stage_status"]
          reason?: string | null
          reviewed_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_checklists: {
        Row: {
          checklist_type: string
          created_at: string
          id: string
          is_done: boolean
          task: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist_type?: string
          created_at?: string
          id?: string
          is_done?: boolean
          task: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist_type?: string
          created_at?: string
          id?: string
          is_done?: boolean
          task?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payslips: {
        Row: {
          basic: number
          created_at: string
          da: number
          deductions: number
          generated_by: string | null
          gross: number
          hra: number
          id: string
          month: number
          net: number
          pf: number
          professional_tax: number
          special_allowance: number
          tds: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          basic?: number
          created_at?: string
          da?: number
          deductions?: number
          generated_by?: string | null
          gross?: number
          hra?: number
          id?: string
          month: number
          net?: number
          pf?: number
          professional_tax?: number
          special_allowance?: number
          tds?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          basic?: number
          created_at?: string
          da?: number
          deductions?: number
          generated_by?: string | null
          gross?: number
          hra?: number
          id?: string
          month?: number
          net?: number
          pf?: number
          professional_tax?: number
          special_allowance?: number
          tds?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      performance_cycles: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      performance_reviews: {
        Row: {
          created_at: string
          cycle_id: string
          goals: string | null
          id: string
          manager_feedback: string | null
          manager_rating: number | null
          self_comments: string | null
          self_rating: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          goals?: string | null
          id?: string
          manager_feedback?: string | null
          manager_rating?: number | null
          self_comments?: string | null
          self_rating?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          goals?: string | null
          id?: string
          manager_feedback?: string | null
          manager_rating?: number | null
          self_comments?: string | null
          self_rating?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          branch: string | null
          business_unit: string | null
          company: string | null
          confirmation_date: string | null
          created_at: string
          date_of_birth: string | null
          department_id: string | null
          designation: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_id: string
          employment_status: string | null
          employment_type: string | null
          full_name: string
          functional_manager_id: string | null
          id: string
          is_active: boolean
          joining_date: string
          manager_id: string | null
          phone: string | null
          region: string | null
          retirement_date: string | null
          sub_branch: string | null
          sub_department: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          branch?: string | null
          business_unit?: string | null
          company?: string | null
          confirmation_date?: string | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          designation?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id: string
          employment_status?: string | null
          employment_type?: string | null
          full_name: string
          functional_manager_id?: string | null
          id?: string
          is_active?: boolean
          joining_date?: string
          manager_id?: string | null
          phone?: string | null
          region?: string | null
          retirement_date?: string | null
          sub_branch?: string | null
          sub_department?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          branch?: string | null
          business_unit?: string | null
          company?: string | null
          confirmation_date?: string | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id?: string
          employment_status?: string | null
          employment_type?: string | null
          full_name?: string
          functional_manager_id?: string | null
          id?: string
          is_active?: boolean
          joining_date?: string
          manager_id?: string | null
          phone?: string | null
          region?: string | null
          retirement_date?: string | null
          sub_branch?: string | null
          sub_department?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_functional_manager_id_fkey"
            columns: ["functional_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_structures: {
        Row: {
          allowances: number
          basic: number
          created_at: string
          da: number
          deductions: number
          effective_from: string
          hra: number
          id: string
          pf_rate: number
          professional_tax: number
          special_allowance: number
          tds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allowances?: number
          basic?: number
          created_at?: string
          da?: number
          deductions?: number
          effective_from?: string
          hra?: number
          id?: string
          pf_rate?: number
          professional_tax?: number
          special_allowance?: number
          tds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allowances?: number
          basic?: number
          created_at?: string
          da?: number
          deductions?: number
          effective_from?: string
          hra?: number
          id?: string
          pf_rate?: number
          professional_tax?: number
          special_allowance?: number
          tds?: number
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_celebrations: {
        Args: never
        Returns: {
          date_of_birth: string
          full_name: string
          joining_date: string
        }[]
      }
      get_manager_user_id: { Args: { _user_id: string }; Returns: string }
      get_people_on_leave_today: {
        Args: never
        Returns: {
          end_date: string
          full_name: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          start_date: string
        }[]
      }
      get_yesterday_attendance: {
        Args: never
        Returns: {
          check_in: string
          check_out: string
          full_name: string
          status: Database["public"]["Enums"]["attendance_status"]
          working_hours: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_of: {
        Args: { _employee_user_id: string; _manager_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
      approval_stage_status: "pending" | "approved" | "rejected"
      attendance_status: "present" | "absent" | "late"
      leave_status: "pending" | "approved" | "rejected"
      leave_type: "sick" | "casual" | "paid" | "compensatory" | "bereavement"
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
      app_role: ["admin", "manager", "employee"],
      approval_stage_status: ["pending", "approved", "rejected"],
      attendance_status: ["present", "absent", "late"],
      leave_status: ["pending", "approved", "rejected"],
      leave_type: ["sick", "casual", "paid", "compensatory", "bereavement"],
    },
  },
} as const
