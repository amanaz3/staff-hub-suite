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
      allowed_ips: {
        Row: {
          created_at: string
          description: string
          id: string
          ip_address: unknown
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          ip_address: unknown
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          ip_address?: unknown
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          break_duration_minutes: number | null
          clock_in_time: string | null
          clock_out_time: string | null
          created_at: string | null
          date: string
          employee_id: string | null
          id: string
          ip_address: unknown | null
          is_wfh: boolean
          notes: string | null
          status: string
          total_hours: number | null
          updated_at: string | null
        }
        Insert: {
          break_duration_minutes?: number | null
          clock_in_time?: string | null
          clock_out_time?: string | null
          created_at?: string | null
          date: string
          employee_id?: string | null
          id?: string
          ip_address?: unknown | null
          is_wfh?: boolean
          notes?: string | null
          status?: string
          total_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          break_duration_minutes?: number | null
          clock_in_time?: string | null
          clock_out_time?: string | null
          created_at?: string | null
          date?: string
          employee_id?: string | null
          id?: string
          ip_address?: unknown | null
          is_wfh?: boolean
          notes?: string | null
          status?: string
          total_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_exceptions: {
        Row: {
          admin_comments: string | null
          attendance_id: string | null
          created_at: string
          document_url: string | null
          duration_hours: number | null
          employee_id: string
          exception_type: string
          id: string
          proposed_clock_in_time: string | null
          proposed_clock_out_time: string | null
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_date: string | null
          updated_at: string
        }
        Insert: {
          admin_comments?: string | null
          attendance_id?: string | null
          created_at?: string
          document_url?: string | null
          duration_hours?: number | null
          employee_id: string
          exception_type: string
          id?: string
          proposed_clock_in_time?: string | null
          proposed_clock_out_time?: string | null
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          admin_comments?: string | null
          attendance_id?: string | null
          created_at?: string
          document_url?: string | null
          duration_hours?: number | null
          employee_id?: string
          exception_type?: string
          id?: string
          proposed_clock_in_time?: string | null
          proposed_clock_out_time?: string | null
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      attendance_notification_log: {
        Row: {
          attendance_date: string
          created_at: string | null
          email_sent_at: string | null
          email_status: string | null
          employee_id: string
          id: string
          issue_details: Json
          issues_detected: Json
          notification_date: string
        }
        Insert: {
          attendance_date: string
          created_at?: string | null
          email_sent_at?: string | null
          email_status?: string | null
          employee_id: string
          id?: string
          issue_details: Json
          issues_detected: Json
          notification_date: string
        }
        Update: {
          attendance_date?: string
          created_at?: string | null
          email_sent_at?: string | null
          email_status?: string | null
          employee_id?: string
          id?: string
          issue_details?: Json
          issues_detected?: Json
          notification_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_notification_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_notification_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          content: string
          created_at: string | null
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          content: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
        }
        Update: {
          content?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: []
      }
      employee_leave_balances: {
        Row: {
          allocated_days: number
          created_at: string
          employee_id: string
          id: string
          leave_type_id: string
          updated_at: string
          used_days: number
          year: number
        }
        Insert: {
          allocated_days?: number
          created_at?: string
          employee_id: string
          id?: string
          leave_type_id: string
          updated_at?: string
          used_days?: number
          year?: number
        }
        Update: {
          allocated_days?: number
          created_at?: string
          employee_id?: string
          id?: string
          leave_type_id?: string
          updated_at?: string
          used_days?: number
          year?: number
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string | null
          department: string
          division: string | null
          email: string
          employee_id: string
          full_name: string
          hire_date: string
          id: string
          manager_id: string | null
          phone: string | null
          position: string
          salary: number | null
          staff_id: string | null
          status: string
          updated_at: string | null
          user_id: string | null
          wfh_enabled: boolean
        }
        Insert: {
          created_at?: string | null
          department: string
          division?: string | null
          email: string
          employee_id: string
          full_name: string
          hire_date: string
          id?: string
          manager_id?: string | null
          phone?: string | null
          position: string
          salary?: number | null
          staff_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
          wfh_enabled?: boolean
        }
        Update: {
          created_at?: string | null
          department?: string
          division?: string | null
          email?: string
          employee_id?: string
          full_name?: string
          hire_date?: string
          id?: string
          manager_id?: string | null
          phone?: string | null
          position?: string
          salary?: number | null
          staff_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
          wfh_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string | null
          employee_id: string | null
          end_date: string
          id: string
          leave_type_id: string | null
          reason: string | null
          review_comments: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          total_days: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id?: string | null
          end_date: string
          id?: string
          leave_type_id?: string | null
          reason?: string | null
          review_comments?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          total_days: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string | null
          end_date?: string
          id?: string
          leave_type_id?: string | null
          reason?: string | null
          review_comments?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          total_days?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_days: number
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_days?: number
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_days?: number
          name?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department: string | null
          email: string
          full_name: string
          hire_date: string | null
          id: string
          phone: string | null
          position: string | null
          role: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          email: string
          full_name: string
          hire_date?: string | null
          id?: string
          phone?: string | null
          position?: string | null
          role: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          email?: string
          full_name?: string
          hire_date?: string | null
          id?: string
          phone?: string | null
          position?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      staff_documents: {
        Row: {
          created_at: string
          document_name: string
          document_type: string
          employee_id: string
          expiry_date: string | null
          file_url: string
          id: string
          issue_date: string | null
          notes: string | null
          notification_sent_30_days: boolean | null
          notification_sent_7_days: boolean | null
          notification_sent_90_days: boolean | null
          status: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type: string
          employee_id: string
          expiry_date?: string | null
          file_url: string
          id?: string
          issue_date?: string | null
          notes?: string | null
          notification_sent_30_days?: boolean | null
          notification_sent_7_days?: boolean | null
          notification_sent_90_days?: boolean | null
          status?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string
          employee_id?: string
          expiry_date?: string | null
          file_url?: string
          id?: string
          issue_date?: string | null
          notes?: string | null
          notification_sent_30_days?: boolean | null
          notification_sent_7_days?: boolean | null
          notification_sent_90_days?: boolean | null
          status?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_schedules: {
        Row: {
          created_at: string
          employee_id: string
          end_time: string
          id: string
          is_active: boolean
          minimum_daily_hours: number
          start_time: string
          updated_at: string
          working_days: string[] | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_time?: string
          id?: string
          is_active?: boolean
          minimum_daily_hours?: number
          start_time?: string
          updated_at?: string
          working_days?: string[] | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_time?: string
          id?: string
          is_active?: boolean
          minimum_daily_hours?: number
          start_time?: string
          updated_at?: string
          working_days?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      employee_directory: {
        Row: {
          department: string | null
          employee_id: string | null
          full_name: string | null
          hire_date: string | null
          id: string | null
          position: string | null
          status: string | null
          wfh_enabled: boolean | null
        }
        Insert: {
          department?: string | null
          employee_id?: string | null
          full_name?: string | null
          hire_date?: string | null
          id?: string | null
          position?: string | null
          status?: string | null
          wfh_enabled?: boolean | null
        }
        Update: {
          department?: string | null
          employee_id?: string | null
          full_name?: string | null
          hire_date?: string | null
          id?: string | null
          position?: string | null
          status?: string | null
          wfh_enabled?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      bootstrap_user: {
        Args: {
          _department?: string
          _email: string
          _full_name: string
          _position?: string
          _role?: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      send_notification_email: {
        Args: { p_html_content: string; p_subject: string; p_to_email: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      document_type_enum:
        | "emirates_id"
        | "passport"
        | "visa"
        | "driving_license"
        | "work_permit"
        | "health_card"
        | "insurance_card"
        | "other"
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
      app_role: ["admin", "staff"],
      document_type_enum: [
        "emirates_id",
        "passport",
        "visa",
        "driving_license",
        "work_permit",
        "health_card",
        "insurance_card",
        "other",
      ],
    },
  },
} as const
