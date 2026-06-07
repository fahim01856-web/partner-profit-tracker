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
      achievements: {
        Row: {
          achievement_category: string
          amount: number
          created_at: string
          date: string
          id: string
          quantity: number
          remarks: string | null
          staff_name: string
        }
        Insert: {
          achievement_category: string
          amount?: number
          created_at?: string
          date?: string
          id?: string
          quantity?: number
          remarks?: string | null
          staff_name: string
        }
        Update: {
          achievement_category?: string
          amount?: number
          created_at?: string
          date?: string
          id?: string
          quantity?: number
          remarks?: string | null
          staff_name?: string
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
      cash_book_entries: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string
          entry_type: string
          id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          description: string
          entry_type: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string
          entry_type?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_book_opening: {
        Row: {
          created_at: string
          date: string
          opening_balance: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          opening_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_deposits: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          note: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date: string
          id?: string
          note?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          created_at: string
          description: string | null
          expiry_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
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
      inventory_distributions: {
        Row: {
          account_number: string
          created_at: string
          customer_name: string
          date: string
          id: string
          item_type: string
          note: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          account_number: string
          created_at?: string
          customer_name: string
          date: string
          id?: string
          item_type: string
          note?: string | null
          quantity: number
          updated_at?: string
        }
        Update: {
          account_number?: string
          created_at?: string
          customer_name?: string
          date?: string
          id?: string
          item_type?: string
          note?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory_pending_requests: {
        Row: {
          account_number: string
          created_at: string
          customer_name: string
          delivered_date: string | null
          id: string
          item_type: string
          mobile: string | null
          note: string | null
          quantity: number
          requested_date: string
          status: string
          updated_at: string
        }
        Insert: {
          account_number: string
          created_at?: string
          customer_name: string
          delivered_date?: string | null
          id?: string
          item_type: string
          mobile?: string | null
          note?: string | null
          quantity?: number
          requested_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_number?: string
          created_at?: string
          customer_name?: string
          delivered_date?: string | null
          id?: string
          item_type?: string
          mobile?: string | null
          note?: string | null
          quantity?: number
          requested_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_receipts: {
        Row: {
          created_at: string
          date: string
          id: string
          item_type: string
          note: string | null
          quantity: number
          source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          item_type: string
          note?: string | null
          quantity: number
          source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          item_type?: string
          note?: string | null
          quantity?: number
          source?: string | null
          updated_at?: string
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
      monthly_targets: {
        Row: {
          created_at: string
          id: string
          month: number
          notes: string | null
          staff_name: string
          target_amount: number
          target_category: string
          target_quantity: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          staff_name: string
          target_amount?: number
          target_category: string
          target_quantity?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          staff_name?: string
          target_amount?: number
          target_category?: string
          target_quantity?: number
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
      pending_works: {
        Row: {
          account_number: string | null
          assigned_to: string | null
          category: string
          completed_at: string | null
          created_at: string
          customer_name: string | null
          description: string | null
          due_date: string | null
          entry_date: string
          id: string
          mobile: string | null
          priority: string
          remarks: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          assigned_to?: string | null
          category: string
          completed_at?: string | null
          created_at?: string
          customer_name?: string | null
          description?: string | null
          due_date?: string | null
          entry_date?: string
          id?: string
          mobile?: string | null
          priority?: string
          remarks?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          assigned_to?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          customer_name?: string | null
          description?: string | null
          due_date?: string | null
          entry_date?: string
          id?: string
          mobile?: string | null
          priority?: string
          remarks?: string | null
          status?: string
          title?: string
          updated_at?: string
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
      signature_cards: {
        Row: {
          account_number: string
          created_at: string
          customer_name: string
          id: string
          image_path: string
          mobile: string | null
          note: string | null
          updated_at: string
        }
        Insert: {
          account_number: string
          created_at?: string
          customer_name: string
          id?: string
          image_path: string
          mobile?: string | null
          note?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string
          created_at?: string
          customer_name?: string
          id?: string
          image_path?: string
          mobile?: string | null
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          account_number: string | null
          created_at: string
          customer_name: string | null
          id: string
          message: string
          mobile: string
          receive_date: string | null
          sent_at: string | null
          sms_type: string
          status: string
        }
        Insert: {
          account_number?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          message: string
          mobile: string
          receive_date?: string | null
          sent_at?: string | null
          sms_type?: string
          status?: string
        }
        Update: {
          account_number?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          message?: string
          mobile?: string
          receive_date?: string | null
          sent_at?: string | null
          sms_type?: string
          status?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          emergency_contact: string | null
          employee_code: string | null
          id: string
          joining_date: string | null
          monthly_salary: number
          name: string
          nid: string | null
          phone: string | null
          photo_url: string | null
          position: string | null
          sort_order: number
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: string | null
          employee_code?: string | null
          id?: string
          joining_date?: string | null
          monthly_salary?: number
          name: string
          nid?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: string | null
          employee_code?: string | null
          id?: string
          joining_date?: string | null
          monthly_salary?: number
          name?: string
          nid?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          sort_order?: number
        }
        Relationships: []
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
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
