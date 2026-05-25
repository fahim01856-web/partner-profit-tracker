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
      account_opening_entries: {
        Row: {
          account_type: string
          created_at: string
          date: string
          id: string
          month: number
          num_accounts: number
          officer_name: string | null
          opening_amount: number
          remarks: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          account_type: string
          created_at?: string
          date?: string
          id?: string
          month: number
          num_accounts?: number
          officer_name?: string | null
          opening_amount?: number
          remarks?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          account_type?: string
          created_at?: string
          date?: string
          id?: string
          month?: number
          num_accounts?: number
          officer_name?: string | null
          opening_amount?: number
          remarks?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          in_time: string | null
          note: string | null
          out_time: string | null
          staff_id: string
          status: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          in_time?: string | null
          note?: string | null
          out_time?: string | null
          staff_id: string
          status?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          in_time?: string | null
          note?: string | null
          out_time?: string | null
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          note: string | null
          paid_to: string | null
          voucher_no: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          note?: string | null
          paid_to?: string | null
          voucher_no: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          note?: string | null
          paid_to?: string | null
          voucher_no?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          holiday_type: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          date: string
          holiday_type?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          date?: string
          holiday_type?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      incomes: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      leaves: {
        Row: {
          approved_by: string | null
          created_at: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          staff_id: string
          start_date: string
          status: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          staff_id: string
          start_date: string
          status?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          staff_id?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_profits: {
        Row: {
          created_at: string
          id: string
          month: number
          notes: string | null
          partner1_name: string
          partner1_percent: number
          partner2_name: string
          partner2_percent: number
          total_profit: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          partner1_name?: string
          partner1_percent?: number
          partner2_name?: string
          partner2_percent?: number
          total_profit?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          partner1_name?: string
          partner1_percent?: number
          partner2_name?: string
          partner2_percent?: number
          total_profit?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      monthly_report_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          item_type: string
          month: number
          sl_no: number
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          item_type: string
          month: number
          sl_no?: number
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          item_type?: string
          month?: number
          sl_no?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      partner_withdrawals: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          note: string | null
          partner_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          partner_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_withdrawals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          created_at: string
          id: string
          name: string
          share_percent: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          share_percent?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          share_percent?: number
        }
        Relationships: []
      }
      remittance_entries: {
        Row: {
          amount: number
          branch: string | null
          created_at: string
          customer_name: string | null
          date: string
          id: string
          note: string | null
          quantity: number
          remittance_type: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          branch?: string | null
          created_at?: string
          customer_name?: string | null
          date?: string
          id?: string
          note?: string | null
          quantity?: number
          remittance_type?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          branch?: string | null
          created_at?: string
          customer_name?: string | null
          date?: string
          id?: string
          note?: string | null
          quantity?: number
          remittance_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      salaries: {
        Row: {
          allowance: number
          base_salary: number
          bonus: number
          created_at: string
          deductions: number
          id: string
          month: number
          net_paid: number
          note: string | null
          paid_on: string | null
          payment_status: string
          staff_id: string
          working_days: number
          year: number
        }
        Insert: {
          allowance?: number
          base_salary?: number
          bonus?: number
          created_at?: string
          deductions?: number
          id?: string
          month: number
          net_paid?: number
          note?: string | null
          paid_on?: string | null
          payment_status?: string
          staff_id: string
          working_days?: number
          year: number
        }
        Update: {
          allowance?: number
          base_salary?: number
          bonus?: number
          created_at?: string
          deductions?: number
          id?: string
          month?: number
          net_paid?: number
          note?: string | null
          paid_on?: string | null
          payment_status?: string
          staff_id?: string
          working_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "salaries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          employee_code: string | null
          id: string
          joining_date: string | null
          monthly_salary: number
          name: string
          phone: string | null
          photo_url: string | null
          position: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          employee_code?: string | null
          id?: string
          joining_date?: string | null
          monthly_salary?: number
          name: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          employee_code?: string | null
          id?: string
          joining_date?: string | null
          monthly_salary?: number
          name?: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
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
    Enums: {},
  },
} as const
