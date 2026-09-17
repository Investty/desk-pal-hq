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
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          company_id: string
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
          company_id?: string
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
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          user_id?: string
          working_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_flags: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          reason: string
          resolved_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["flag_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          reason: string
          resolved_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["flag_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["flag_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_flags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_requests: {
        Row: {
          company_id: string
          created_at: string
          date: string
          flag_id: string | null
          id: string
          reason: string
          request_type: Database["public"]["Enums"]["attendance_request_type"]
          requested_check_in: string | null
          requested_check_out: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["approval_stage_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          date: string
          flag_id?: string | null
          id?: string
          reason: string
          request_type?: Database["public"]["Enums"]["attendance_request_type"]
          requested_check_in?: string | null
          requested_check_out?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_stage_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          flag_id?: string | null
          id?: string
          reason?: string
          request_type?: Database["public"]["Enums"]["attendance_request_type"]
          requested_check_in?: string | null
          requested_check_out?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_stage_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_requests_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: false
            referencedRelation: "attendance_flags"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_rules: {
        Row: {
          company_id: string
          created_at: string
          early_leave_enabled: boolean
          early_leave_max_hours: number
          early_leave_max_per_month: number
          regularization_backdate_days: number
          regularization_enabled: boolean
          regularization_max_per_month: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          early_leave_enabled?: boolean
          early_leave_max_hours?: number
          early_leave_max_per_month?: number
          regularization_backdate_days?: number
          regularization_enabled?: boolean
          regularization_max_per_month?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          early_leave_enabled?: boolean
          early_leave_max_hours?: number
          early_leave_max_per_month?: number
          regularization_backdate_days?: number
          regularization_enabled?: boolean
          regularization_max_per_month?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_reads: {
        Row: {
          broadcast_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          broadcast_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          broadcast_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_reads_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_published: boolean
          publish_at: string
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_published?: boolean
          publish_at?: string
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_published?: boolean
          publish_at?: string
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      celebration_wishes: {
        Row: {
          company_id: string
          created_at: string
          id: string
          message: string | null
          occasion_date: string
          occasion_type: string
          recipient_user_id: string
          sender_user_id: string
          thanked_at: string | null
          thanks_message: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          message?: string | null
          occasion_date: string
          occasion_type: string
          recipient_user_id: string
          sender_user_id: string
          thanked_at?: string | null
          thanks_message?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          message?: string | null
          occasion_date?: string
          occasion_type?: string
          recipient_user_id?: string
          sender_user_id?: string
          thanked_at?: string | null
          thanks_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "celebration_wishes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      comp_off_grants: {
        Row: {
          company_id: string
          created_at: string
          days: number
          granted_by: string | null
          id: string
          reason: string
          updated_at: string
          user_id: string
          worked_on: string
        }
        Insert: {
          company_id: string
          created_at?: string
          days: number
          granted_by?: string | null
          id?: string
          reason: string
          updated_at?: string
          user_id: string
          worked_on: string
        }
        Update: {
          company_id?: string
          created_at?: string
          days?: number
          granted_by?: string | null
          id?: string
          reason?: string
          updated_at?: string
          user_id?: string
          worked_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "comp_off_grants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          billing_interval: string
          churned_at: string | null
          created_at: string
          custom_price: number | null
          id: string
          name: string
          notes: string | null
          plan: string
          plan_started_at: string
          seat_limit: number
          setup_completed_at: string | null
          status: string
          timezone: string
          trial_ends_at: string | null
          updated_at: string
          weekly_offs: number[]
        }
        Insert: {
          billing_interval?: string
          churned_at?: string | null
          created_at?: string
          custom_price?: number | null
          id?: string
          name: string
          notes?: string | null
          plan?: string
          plan_started_at?: string
          seat_limit?: number
          setup_completed_at?: string | null
          status?: string
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          weekly_offs?: number[]
        }
        Update: {
          billing_interval?: string
          churned_at?: string | null
          created_at?: string
          custom_price?: number | null
          id?: string
          name?: string
          notes?: string | null
          plan?: string
          plan_started_at?: string
          seat_limit?: number
          setup_completed_at?: string | null
          status?: string
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          weekly_offs?: number[]
        }
        Relationships: []
      }
      company_features: {
        Row: {
          company_id: string
          created_at: string
          feature_key: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          feature_key: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invites: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_limits: {
        Row: {
          company_id: string
          created_at: string
          monthly_notification_limit: number
          soft_warn_pct: number
          storage_mb_limit: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          monthly_notification_limit?: number
          soft_warn_pct?: number
          storage_mb_limit?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          monthly_notification_limit?: number
          soft_warn_pct?: number
          storage_mb_limit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_limits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_usage_counters: {
        Row: {
          company_id: string
          notifications_sent: number
          period_month: string
          updated_at: string
        }
        Insert: {
          company_id: string
          notifications_sent?: number
          period_month: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          notifications_sent?: number
          period_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_usage_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          company_id: string
          created_at: string
          document_type: string
          file_path: string
          file_size_bytes: number
          id: string
          title: string
          updated_at: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          document_type?: string
          file_path: string
          file_size_bytes?: number
          id?: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document_type?: string
          file_path?: string
          file_size_bytes?: number
          id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_leave_settings: {
        Row: {
          company_id: string
          created_at: string
          entitlement_override: number | null
          id: string
          is_enabled: boolean
          note: string | null
          policy_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          entitlement_override?: number | null
          id?: string
          is_enabled?: boolean
          note?: string | null
          policy_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          entitlement_override?: number | null
          id?: string
          is_enabled?: boolean
          note?: string | null
          policy_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_leave_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_leave_settings_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "leave_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_shifts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          period_month: string
          shift_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          period_month: string
          shift_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          period_month?: string
          shift_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          company_id: string
          created_at: string
          date: string
          id: string
          is_recurring: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          date: string
          id?: string
          is_recurring?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          admin_user_id: string
          company_id: string
          ended_at: string | null
          expires_at: string
          id: string
          reason: string | null
          started_at: string
        }
        Insert: {
          admin_user_id: string
          company_id: string
          ended_at?: string | null
          expires_at: string
          id?: string
          reason?: string | null
          started_at?: string
        }
        Update: {
          admin_user_id?: string
          company_id?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          reason?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          filename: string | null
          id: string
          imported_rows: number
          kind: string
          skipped_rows: number
          total_rows: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          filename?: string | null
          id?: string
          imported_rows?: number
          kind: string
          skipped_rows?: number
          total_rows?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          filename?: string | null
          id?: string
          imported_rows?: number
          kind?: string
          skipped_rows?: number
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          company_id: string
          created_at: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"] | null
          policy_id: string | null
          remaining_days: number
          total_days: number
          updated_at: string
          used_days: number
          user_id: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"] | null
          policy_id?: string | null
          remaining_days?: number
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"] | null
          policy_id?: string | null
          remaining_days?: number
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "leave_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_policies: {
        Row: {
          applies_to: string
          carry_forward_enabled: boolean
          carry_forward_max: number
          code: string
          company_id: string
          created_at: string
          default_days: number
          id: string
          is_enabled: boolean
          label: string
          last_carry_forward_at: string | null
          leave_type: Database["public"]["Enums"]["leave_type"] | null
          updated_at: string
        }
        Insert: {
          applies_to?: string
          carry_forward_enabled?: boolean
          carry_forward_max?: number
          code: string
          company_id?: string
          created_at?: string
          default_days?: number
          id?: string
          is_enabled?: boolean
          label: string
          last_carry_forward_at?: string | null
          leave_type?: Database["public"]["Enums"]["leave_type"] | null
          updated_at?: string
        }
        Update: {
          applies_to?: string
          carry_forward_enabled?: boolean
          carry_forward_max?: number
          code?: string
          company_id?: string
          created_at?: string
          default_days?: number
          id?: string
          is_enabled?: boolean
          label?: string
          last_carry_forward_at?: string | null
          leave_type?: Database["public"]["Enums"]["leave_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_by: string | null
          company_id: string
          created_at: string
          day_portion: Database["public"]["Enums"]["day_portion"]
          end_date: string
          hr_comment: string | null
          hr_reviewed_at: string | null
          hr_reviewed_by: string | null
          hr_status: Database["public"]["Enums"]["approval_stage_status"]
          id: string
          is_public: boolean
          leave_type: Database["public"]["Enums"]["leave_type"] | null
          manager_comment: string | null
          manager_reviewed_at: string | null
          manager_reviewed_by: string | null
          manager_status: Database["public"]["Enums"]["approval_stage_status"]
          policy_id: string | null
          reason: string | null
          reviewed_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          company_id?: string
          created_at?: string
          day_portion?: Database["public"]["Enums"]["day_portion"]
          end_date: string
          hr_comment?: string | null
          hr_reviewed_at?: string | null
          hr_reviewed_by?: string | null
          hr_status?: Database["public"]["Enums"]["approval_stage_status"]
          id?: string
          is_public?: boolean
          leave_type?: Database["public"]["Enums"]["leave_type"] | null
          manager_comment?: string | null
          manager_reviewed_at?: string | null
          manager_reviewed_by?: string | null
          manager_status?: Database["public"]["Enums"]["approval_stage_status"]
          policy_id?: string | null
          reason?: string | null
          reviewed_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          company_id?: string
          created_at?: string
          day_portion?: Database["public"]["Enums"]["day_portion"]
          end_date?: string
          hr_comment?: string | null
          hr_reviewed_at?: string | null
          hr_reviewed_by?: string | null
          hr_status?: Database["public"]["Enums"]["approval_stage_status"]
          id?: string
          is_public?: boolean
          leave_type?: Database["public"]["Enums"]["leave_type"] | null
          manager_comment?: string | null
          manager_reviewed_at?: string | null
          manager_reviewed_by?: string | null
          manager_status?: Database["public"]["Enums"]["approval_stage_status"]
          policy_id?: string | null
          reason?: string | null
          reviewed_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "leave_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklists: {
        Row: {
          checklist_type: string
          company_id: string
          created_at: string
          id: string
          is_done: boolean
          task: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist_type?: string
          company_id?: string
          created_at?: string
          id?: string
          is_done?: boolean
          task: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist_type?: string
          company_id?: string
          created_at?: string
          id?: string
          is_done?: boolean
          task?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          basic: number
          company_id: string
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
          company_id?: string
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
          company_id?: string
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
        Relationships: [
          {
            foreignKeyName: "payslips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_employees: {
        Row: {
          batch_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          department_id: string | null
          designation: string | null
          email: string
          employee_code: string | null
          full_name: string
          id: string
          joining_date: string | null
          linked_at: string | null
          linked_user_id: string | null
          manager_email: string | null
          phone: string | null
          shift_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          designation?: string | null
          email: string
          employee_code?: string | null
          full_name: string
          id?: string
          joining_date?: string | null
          linked_at?: string | null
          linked_user_id?: string | null
          manager_email?: string | null
          phone?: string | null
          shift_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string
          employee_code?: string | null
          full_name?: string
          id?: string
          joining_date?: string | null
          linked_at?: string | null
          linked_user_id?: string | null
          manager_email?: string | null
          phone?: string | null
          shift_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_employees_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_cycles: {
        Row: {
          company_id: string
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_cycles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          company_id: string
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
          company_id?: string
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
          company_id?: string
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
            foreignKeyName: "performance_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          annual_price: number
          created_at: string
          currency: string
          description: string | null
          id: string
          included_seats: number
          is_active: boolean
          key: string
          monthly_price: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          annual_price?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          included_seats?: number
          is_active?: boolean
          key: string
          monthly_price?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          annual_price?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          included_seats?: number
          is_active?: boolean
          key?: string
          monthly_price?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          company_id: string | null
          created_at: string
          details: Json
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          details?: Json
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          details?: Json
          id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          branch: string | null
          business_unit: string | null
          company: string | null
          company_id: string
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
          last_working_day: string | null
          manager_id: string | null
          phone: string | null
          region: string | null
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
          retirement_date: string | null
          status: string
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
          company_id: string
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
          last_working_day?: string | null
          manager_id?: string | null
          phone?: string | null
          region?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          retirement_date?: string | null
          status?: string
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
          company_id?: string
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
          last_working_day?: string | null
          manager_id?: string | null
          phone?: string | null
          region?: string | null
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          retirement_date?: string | null
          status?: string
          sub_branch?: string | null
          sub_department?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
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
          company_id?: string
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
          company_id?: string
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
        Relationships: [
          {
            foreignKeyName: "salary_structures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_minutes: number
          company_id: string
          created_at: string
          end_time: string
          grace_minutes: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          break_minutes?: number
          company_id: string
          created_at?: string
          end_time?: string
          grace_minutes?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          start_time?: string
          updated_at?: string
        }
        Update: {
          break_minutes?: number
          company_id?: string
          created_at?: string
          end_time?: string
          grace_minutes?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_active_company: {
        Row: {
          company_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_active_company_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      applicable_leave_types: {
        Args: { _user_id?: string }
        Returns: {
          carry_forward_enabled: boolean
          carry_forward_max: number
          code: string
          default_days: number
          entitlement: number
          is_override: boolean
          label: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          policy_id: string
        }[]
      }
      clock_in: {
        Args: never
        Returns: {
          check_in: string | null
          check_out: string | null
          company_id: string
          created_at: string
          date: string
          id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          user_id: string
          working_hours: number | null
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clock_out: {
        Args: never
        Returns: {
          check_in: string | null
          check_out: string | null
          company_id: string
          created_at: string
          date: string
          id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          user_id: string
          working_hours: number | null
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_attendance_day: { Args: never; Returns: Json }
      current_company_id: { Args: never; Returns: string }
      current_impersonation: { Args: never; Returns: string }
      current_support_session: {
        Args: never
        Returns: {
          company_id: string
          company_name: string
          expires_at: string
        }[]
      }
      effective_leave_days: {
        Args: { _policy_id: string; _user_id: string }
        Returns: number
      }
      get_celebrations: {
        Args: never
        Returns: {
          date_of_birth: string
          full_name: string
          joining_date: string
          user_id: string
        }[]
      }
      get_leave_calendar: {
        Args: { _from: string; _to: string }
        Returns: {
          day_portion: Database["public"]["Enums"]["day_portion"]
          end_date: string
          is_self: boolean
          kind: string
          label: string
          start_date: string
        }[]
      }
      get_manager_user_id: { Args: { _user_id: string }; Returns: string }
      get_my_memberships: {
        Args: never
        Returns: {
          company_id: string
          company_name: string
          company_status: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }[]
      }
      get_people_on_leave_today: {
        Args: never
        Returns: {
          end_date: string
          full_name: string
          leave_type: string
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
      hr_set_employee_leave: {
        Args: {
          _entitlement: number
          _is_enabled: boolean
          _note?: string
          _policy_id: string
          _user_id: string
        }
        Returns: undefined
      }
      hr_sync_policy_balances: {
        Args: { _policy_id: string }
        Returns: undefined
      }
      import_employees: {
        Args: { _filename?: string; _rows: Json }
        Returns: Json
      }
      import_shifts: {
        Args: { _filename?: string; _rows: Json }
        Returns: Json
      }
      is_hr: { Args: { _user_id: string }; Returns: boolean }
      is_manager_of: {
        Args: { _employee_user_id: string; _manager_user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_working_day: {
        Args: { _company: string; _date: string }
        Returns: boolean
      }
      leave_days: { Args: { _end: string; _start: string }; Returns: number }
      link_pending_employee: {
        Args: { _company_id: string; _email: string; _user_id: string }
        Returns: undefined
      }
      my_broadcasts: {
        Args: never
        Returns: {
          body: string
          expires_at: string
          id: string
          publish_at: string
          severity: string
          title: string
        }[]
      }
      owner_audit: {
        Args: { _action: string; _company_id: string; _details: Json }
        Returns: undefined
      }
      owner_audit_log: {
        Args: { _company_id?: string; _limit?: number }
        Returns: {
          action: string
          actor_email: string
          company_id: string
          company_name: string
          created_at: string
          details: Json
          id: string
        }[]
      }
      owner_delete_broadcast: { Args: { _id: string }; Returns: undefined }
      owner_delete_company: {
        Args: { _company_id: string }
        Returns: undefined
      }
      owner_end_support: { Args: never; Returns: undefined }
      owner_list_broadcasts: {
        Args: never
        Returns: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_published: boolean
          publish_at: string
          severity: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "broadcasts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      owner_list_companies: {
        Args: never
        Returns: {
          active_people: number
          admins: number
          created_at: string
          features: Json
          id: string
          monthly_notification_limit: number
          name: string
          notes: string
          notifications_this_month: number
          plan: string
          removed_people: number
          seat_limit: number
          soft_warn_pct: number
          status: string
          storage_mb_limit: number
          storage_used_mb: number
          trial_ends_at: string
        }[]
      }
      owner_list_plans: {
        Args: never
        Returns: {
          annual_price: number
          companies: number
          currency: string
          description: string
          id: string
          included_seats: number
          is_active: boolean
          key: string
          monthly_price: number
          mrr: number
          name: string
          sort_order: number
        }[]
      }
      owner_revenue: { Args: never; Returns: Json }
      owner_revenue_by_company: {
        Args: never
        Returns: {
          active_seats: number
          billing_interval: string
          company_id: string
          company_name: string
          mrr: number
          plan: string
          seat_limit: number
          status: string
        }[]
      }
      owner_set_billing: {
        Args: {
          _billing_interval: string
          _company_id: string
          _custom_price: number
        }
        Returns: undefined
      }
      owner_set_feature: {
        Args: {
          _company_id: string
          _feature_key: string
          _is_enabled: boolean
        }
        Returns: undefined
      }
      owner_set_limits: {
        Args: {
          _company_id: string
          _monthly_notification_limit?: number
          _seat_limit?: number
          _soft_warn_pct?: number
          _storage_mb_limit?: number
        }
        Returns: undefined
      }
      owner_start_support: {
        Args: { _company_id: string; _minutes?: number; _reason?: string }
        Returns: string
      }
      owner_stats: { Args: never; Returns: Json }
      owner_update_company: {
        Args: {
          _company_id: string
          _name?: string
          _notes?: string
          _plan?: string
          _seat_limit?: number
          _status?: string
          _trial_ends_at?: string
        }
        Returns: undefined
      }
      owner_upsert_broadcast: {
        Args: {
          _audience: string
          _body: string
          _expires_at: string
          _id: string
          _is_published: boolean
          _publish_at: string
          _severity: string
          _title: string
        }
        Returns: string
      }
      owner_upsert_plan: {
        Args: {
          _annual_price: number
          _currency: string
          _description: string
          _id: string
          _included_seats: number
          _is_active: boolean
          _key: string
          _monthly_price: number
          _name: string
          _sort_order: number
        }
        Returns: string
      }
      owner_usage: {
        Args: never
        Returns: {
          attendance_rows: number
          company_id: string
          company_name: string
          document_rows: number
          leave_rows: number
          payslip_rows: number
          people: number
          rows_last_30d: number
          storage_mb: number
        }[]
      }
      redeem_invite: { Args: { _code: string }; Returns: string }
      remove_employee: {
        Args: { _last_working_day?: string; _reason?: string; _user_id: string }
        Returns: undefined
      }
      request_days: {
        Args: {
          _end: string
          _portion: Database["public"]["Enums"]["day_portion"]
          _start: string
        }
        Returns: number
      }
      restore_employee: {
        Args: {
          _role?: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      run_leave_carry_forward: { Args: never; Returns: number }
      set_active_company: { Args: { _company_id: string }; Returns: undefined }
      shift_for: {
        Args: { _date: string; _user: string }
        Returns: {
          break_minutes: number
          company_id: string
          created_at: string
          end_time: string
          grace_minutes: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          start_time: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      working_days_between: {
        Args: { _company: string; _end: string; _start: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee" | "hr"
      approval_stage_status: "pending" | "approved" | "rejected" | "cancelled"
      attendance_request_type: "regularization" | "early_leave"
      attendance_status: "present" | "absent" | "late"
      day_portion: "full_day" | "first_half" | "second_half"
      flag_status: "open" | "resolved"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      leave_type:
        | "sick"
        | "casual"
        | "paid"
        | "compensatory"
        | "bereavement"
        | "maternity"
        | "paternity"
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
      app_role: ["admin", "manager", "employee", "hr"],
      approval_stage_status: ["pending", "approved", "rejected", "cancelled"],
      attendance_request_type: ["regularization", "early_leave"],
      attendance_status: ["present", "absent", "late"],
      day_portion: ["full_day", "first_half", "second_half"],
      flag_status: ["open", "resolved"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: [
        "sick",
        "casual",
        "paid",
        "compensatory",
        "bereavement",
        "maternity",
        "paternity",
      ],
    },
  },
} as const
