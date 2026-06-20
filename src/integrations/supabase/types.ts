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
      ab_account_balances: {
        Row: {
          account_type: string
          balance: number
          created_at: string
          date: string
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          account_type: string
          balance?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          balance?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ab_income_entries: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          income_type: string
          note: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          income_type: string
          note?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          income_type?: string
          note?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ab_profit_slabs: {
        Row: {
          account_type: string
          created_at: string
          id: string
          max_amount: number | null
          min_amount: number
          sort_order: number
          updated_at: string
          yearly_percent: number
        }
        Insert: {
          account_type: string
          created_at?: string
          id?: string
          max_amount?: number | null
          min_amount?: number
          sort_order?: number
          updated_at?: string
          yearly_percent?: number
        }
        Update: {
          account_type?: string
          created_at?: string
          id?: string
          max_amount?: number | null
          min_amount?: number
          sort_order?: number
          updated_at?: string
          yearly_percent?: number
        }
        Relationships: []
      }
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
          account_type: string | null
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
          account_type?: string | null
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
          account_type?: string | null
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
      agent_bank_assets: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          note: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          note?: string | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      agent_bank_investments: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string | null
          id: string
          partner_name: string
          payment_method: string
          type: string
          updated_at: string
          voucher_image_url: string | null
          voucher_no: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          partner_name: string
          payment_method?: string
          type?: string
          updated_at?: string
          voucher_image_url?: string | null
          voucher_no?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          partner_name?: string
          payment_method?: string
          type?: string
          updated_at?: string
          voucher_image_url?: string | null
          voucher_no?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
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
      audit_compliance_checks: {
        Row: {
          audit_report_id: string
          created_at: string
          id: string
          note: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          audit_report_id: string
          created_at?: string
          id?: string
          note?: string | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          audit_report_id?: string
          created_at?: string
          id?: string
          note?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_compliance_checks_audit_report_id_fkey"
            columns: ["audit_report_id"]
            isOneToOne: false
            referencedRelation: "audit_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_findings: {
        Row: {
          audit_report_id: string | null
          category: string
          corrective_action: string | null
          created_at: string
          deadline: string | null
          details: string | null
          evidence_name: string | null
          evidence_url: string | null
          id: string
          recommendation: string | null
          resolved_date: string | null
          responsible_person: string | null
          risk_level: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          audit_report_id?: string | null
          category?: string
          corrective_action?: string | null
          created_at?: string
          deadline?: string | null
          details?: string | null
          evidence_name?: string | null
          evidence_url?: string | null
          id?: string
          recommendation?: string | null
          resolved_date?: string | null
          responsible_person?: string | null
          risk_level?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          audit_report_id?: string | null
          category?: string
          corrective_action?: string | null
          created_at?: string
          deadline?: string | null
          details?: string | null
          evidence_name?: string | null
          evidence_url?: string | null
          id?: string
          recommendation?: string | null
          resolved_date?: string | null
          responsible_person?: string | null
          risk_level?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_audit_report_id_fkey"
            columns: ["audit_report_id"]
            isOneToOne: false
            referencedRelation: "audit_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_reports: {
        Row: {
          approved_by: string | null
          attendance_check_note: string | null
          attendance_check_status: string | null
          audit_date: string
          audit_type: string
          auditor_name: string
          cash_check_note: string | null
          cash_check_status: string | null
          checked_by: string | null
          created_at: string
          document_check_note: string | null
          document_check_status: string | null
          id: string
          inventory_check_note: string | null
          inventory_check_status: string | null
          kyc_check_note: string | null
          kyc_check_status: string | null
          loan_check_note: string | null
          loan_check_status: string | null
          pending_check_note: string | null
          pending_check_status: string | null
          period_end: string | null
          period_start: string | null
          prepared_by: string | null
          reference_number: string | null
          remarks: string | null
          salary_check_note: string | null
          salary_check_status: string | null
          sign_date: string | null
          signature_check_note: string | null
          signature_check_status: string | null
          updated_at: string
          voucher_check_note: string | null
          voucher_check_status: string | null
        }
        Insert: {
          approved_by?: string | null
          attendance_check_note?: string | null
          attendance_check_status?: string | null
          audit_date?: string
          audit_type?: string
          auditor_name: string
          cash_check_note?: string | null
          cash_check_status?: string | null
          checked_by?: string | null
          created_at?: string
          document_check_note?: string | null
          document_check_status?: string | null
          id?: string
          inventory_check_note?: string | null
          inventory_check_status?: string | null
          kyc_check_note?: string | null
          kyc_check_status?: string | null
          loan_check_note?: string | null
          loan_check_status?: string | null
          pending_check_note?: string | null
          pending_check_status?: string | null
          period_end?: string | null
          period_start?: string | null
          prepared_by?: string | null
          reference_number?: string | null
          remarks?: string | null
          salary_check_note?: string | null
          salary_check_status?: string | null
          sign_date?: string | null
          signature_check_note?: string | null
          signature_check_status?: string | null
          updated_at?: string
          voucher_check_note?: string | null
          voucher_check_status?: string | null
        }
        Update: {
          approved_by?: string | null
          attendance_check_note?: string | null
          attendance_check_status?: string | null
          audit_date?: string
          audit_type?: string
          auditor_name?: string
          cash_check_note?: string | null
          cash_check_status?: string | null
          checked_by?: string | null
          created_at?: string
          document_check_note?: string | null
          document_check_status?: string | null
          id?: string
          inventory_check_note?: string | null
          inventory_check_status?: string | null
          kyc_check_note?: string | null
          kyc_check_status?: string | null
          loan_check_note?: string | null
          loan_check_status?: string | null
          pending_check_note?: string | null
          pending_check_status?: string | null
          period_end?: string | null
          period_start?: string | null
          prepared_by?: string | null
          reference_number?: string | null
          remarks?: string | null
          salary_check_note?: string | null
          salary_check_status?: string | null
          sign_date?: string | null
          signature_check_note?: string | null
          signature_check_status?: string | null
          updated_at?: string
          voucher_check_note?: string | null
          voucher_check_status?: string | null
        }
        Relationships: []
      }
      audit_tasks: {
        Row: {
          assigned_to: string | null
          attachment_name: string | null
          attachment_url: string | null
          audit_report_id: string | null
          completion_date: string | null
          completion_note: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          priority: string
          status: string
          task_name: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          audit_report_id?: string | null
          completion_date?: string | null
          completion_note?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          task_name: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          audit_report_id?: string | null
          completion_date?: string | null
          completion_note?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_tasks_audit_report_id_fkey"
            columns: ["audit_report_id"]
            isOneToOne: false
            referencedRelation: "audit_reports"
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
          is_manual: boolean
          opening_balance: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          is_manual?: boolean
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          is_manual?: boolean
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
      document_categories: {
        Row: {
          created_at: string
          id: string
          name_bn: string
          name_en: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_bn: string
          name_en: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_bn?: string
          name_en?: string
          slug?: string
          sort_order?: number
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
          staff_id: string | null
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
          staff_id?: string | null
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
          staff_id?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          last_used_at: string
          name: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string
          name: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string
          name?: string
          updated_at?: string
          usage_count?: number
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
      kyc_checklist_items: {
        Row: {
          checked: boolean
          checked_by: string | null
          checked_on: string | null
          created_at: string
          id: string
          item_key: string
          item_label: string
          kyc_id: string
          note: string | null
        }
        Insert: {
          checked?: boolean
          checked_by?: string | null
          checked_on?: string | null
          created_at?: string
          id?: string
          item_key: string
          item_label: string
          kyc_id: string
          note?: string | null
        }
        Update: {
          checked?: boolean
          checked_by?: string | null
          checked_on?: string | null
          created_at?: string
          id?: string
          item_key?: string
          item_label?: string
          kyc_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_checklist_items_kyc_id_fkey"
            columns: ["kyc_id"]
            isOneToOne: false
            referencedRelation: "kyc_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_documents: {
        Row: {
          created_at: string
          doc_name: string | null
          doc_type: string
          expire_on: string | null
          file_path: string | null
          file_url: string | null
          id: string
          issued_on: string | null
          kyc_id: string
          notes: string | null
          remarks: string | null
          verified: boolean | null
          verified_by: string | null
          verified_on: string | null
        }
        Insert: {
          created_at?: string
          doc_name?: string | null
          doc_type: string
          expire_on?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          issued_on?: string | null
          kyc_id: string
          notes?: string | null
          remarks?: string | null
          verified?: boolean | null
          verified_by?: string | null
          verified_on?: string | null
        }
        Update: {
          created_at?: string
          doc_name?: string | null
          doc_type?: string
          expire_on?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          issued_on?: string | null
          kyc_id?: string
          notes?: string | null
          remarks?: string | null
          verified?: boolean | null
          verified_by?: string | null
          verified_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_kyc_id_fkey"
            columns: ["kyc_id"]
            isOneToOne: false
            referencedRelation: "kyc_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_profiles: {
        Row: {
          account_number: string | null
          account_type: string | null
          address: string | null
          approved_by: string | null
          approved_on: string | null
          branch_name: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          date_of_birth: string | null
          email: string | null
          emergency_contact: string | null
          expected_monthly_transaction: number | null
          father_name: string | null
          gender: string | null
          id: string
          introducer_account: string | null
          introducer_name: string | null
          marital_status: string | null
          monthly_income: number | null
          mother_name: string | null
          nationality: string | null
          next_review_date: string | null
          nid_number: string | null
          nominee_name: string | null
          nominee_nid: string | null
          nominee_relation: string | null
          notes: string | null
          occupation: string | null
          opening_date: string | null
          pep_status: boolean | null
          permanent_address: string | null
          phone: string | null
          photo_url: string | null
          place_of_birth: string | null
          relationship_officer: string | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          source_of_income: string | null
          spouse_name: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          tin_number: string | null
          updated_at: string
          verified_by: string | null
          verified_on: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          approved_by?: string | null
          approved_on?: string | null
          branch_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: string | null
          expected_monthly_transaction?: number | null
          father_name?: string | null
          gender?: string | null
          id?: string
          introducer_account?: string | null
          introducer_name?: string | null
          marital_status?: string | null
          monthly_income?: number | null
          mother_name?: string | null
          nationality?: string | null
          next_review_date?: string | null
          nid_number?: string | null
          nominee_name?: string | null
          nominee_nid?: string | null
          nominee_relation?: string | null
          notes?: string | null
          occupation?: string | null
          opening_date?: string | null
          pep_status?: boolean | null
          permanent_address?: string | null
          phone?: string | null
          photo_url?: string | null
          place_of_birth?: string | null
          relationship_officer?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          source_of_income?: string | null
          spouse_name?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          tin_number?: string | null
          updated_at?: string
          verified_by?: string | null
          verified_on?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          approved_by?: string | null
          approved_on?: string | null
          branch_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: string | null
          expected_monthly_transaction?: number | null
          father_name?: string | null
          gender?: string | null
          id?: string
          introducer_account?: string | null
          introducer_name?: string | null
          marital_status?: string | null
          monthly_income?: number | null
          mother_name?: string | null
          nationality?: string | null
          next_review_date?: string | null
          nid_number?: string | null
          nominee_name?: string | null
          nominee_nid?: string | null
          nominee_relation?: string | null
          notes?: string | null
          occupation?: string | null
          opening_date?: string | null
          pep_status?: boolean | null
          permanent_address?: string | null
          phone?: string | null
          photo_url?: string | null
          place_of_birth?: string | null
          relationship_officer?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          source_of_income?: string | null
          spouse_name?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          tin_number?: string | null
          updated_at?: string
          verified_by?: string | null
          verified_on?: string | null
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
      loan_persons: {
        Row: {
          account_number: string | null
          address: string | null
          created_at: string
          due_date: string | null
          emi_day: number | null
          guarantor_name: string | null
          guarantor_nid: string | null
          guarantor_phone: string | null
          id: string
          interest_rate: number | null
          loan_amount: number | null
          loan_type: string | null
          name: string
          nid_url: string | null
          notes: string | null
          opening_balance: number
          opening_date: string
          phone: string | null
          photo_url: string | null
          purpose: string | null
          status: string | null
          tenure_months: number | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          address?: string | null
          created_at?: string
          due_date?: string | null
          emi_day?: number | null
          guarantor_name?: string | null
          guarantor_nid?: string | null
          guarantor_phone?: string | null
          id?: string
          interest_rate?: number | null
          loan_amount?: number | null
          loan_type?: string | null
          name: string
          nid_url?: string | null
          notes?: string | null
          opening_balance?: number
          opening_date?: string
          phone?: string | null
          photo_url?: string | null
          purpose?: string | null
          status?: string | null
          tenure_months?: number | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          address?: string | null
          created_at?: string
          due_date?: string | null
          emi_day?: number | null
          guarantor_name?: string | null
          guarantor_nid?: string | null
          guarantor_phone?: string | null
          id?: string
          interest_rate?: number | null
          loan_amount?: number | null
          loan_type?: string | null
          name?: string
          nid_url?: string | null
          notes?: string | null
          opening_balance?: number
          opening_date?: string
          phone?: string | null
          photo_url?: string | null
          purpose?: string | null
          status?: string | null
          tenure_months?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      loan_transactions: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string | null
          id: string
          person_id: string
          receipt_url: string | null
          time: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          person_id: string
          receipt_url?: string | null
          time?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          person_id?: string
          receipt_url?: string | null
          time?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_transactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "loan_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_actions: {
        Row: {
          action: string
          completed_on: string | null
          completion_note: string | null
          created_at: string
          deadline: string | null
          id: string
          meeting_id: string
          responsible: string | null
          status: Database["public"]["Enums"]["action_status"]
          updated_at: string
        }
        Insert: {
          action: string
          completed_on?: string | null
          completion_note?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          meeting_id: string
          responsible?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Update: {
          action?: string
          completed_on?: string | null
          completion_note?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          meeting_id?: string
          responsible?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_actions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agendas: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          notes: string | null
          presenter: string | null
          sort_order: number
          time_slot: string | null
          topic: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          notes?: string | null
          presenter?: string | null
          sort_order?: number
          time_slot?: string | null
          topic: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          notes?: string | null
          presenter?: string | null
          sort_order?: number
          time_slot?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agendas_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendees: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          name: string
          present: boolean
          role: string | null
          staff_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          name: string
          present?: boolean
          role?: string | null
          staff_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          name?: string
          present?: boolean
          role?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_problems: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          problem: string
          raised_by: string | null
          resolution: string | null
          resolved_on: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          problem: string
          raised_by?: string | null
          resolution?: string | null
          resolved_on?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          problem?: string
          raised_by?: string | null
          resolution?: string | null
          resolved_on?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_problems_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_targets: {
        Row: {
          achievement_percent: number
          assigned_to: string | null
          created_at: string
          due_date: string | null
          id: string
          meeting_id: string
          remarks: string | null
          target: string
        }
        Insert: {
          achievement_percent?: number
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id: string
          remarks?: string | null
          target: string
        }
        Update: {
          achievement_percent?: number
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id?: string
          remarks?: string | null
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_targets_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          chairperson: string | null
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          meeting_date: string
          meeting_time: string | null
          meeting_type: string
          next_meeting_date: string | null
          status: Database["public"]["Enums"]["meeting_status"]
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          chairperson?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          meeting_time?: string | null
          meeting_type?: string
          next_meeting_date?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          chairperson?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          meeting_time?: string | null
          meeting_type?: string
          next_meeting_date?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          account_type: string | null
          created_at: string
          deadline: string | null
          id: string
          month: number
          notes: string | null
          priority: string | null
          staff_name: string
          status: string | null
          target_amount: number
          target_category: string
          target_quantity: number
          updated_at: string
          weight: number | null
          year: number
        }
        Insert: {
          account_type?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          month: number
          notes?: string | null
          priority?: string | null
          staff_name: string
          status?: string | null
          target_amount?: number
          target_category: string
          target_quantity?: number
          updated_at?: string
          weight?: number | null
          year: number
        }
        Update: {
          account_type?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          month?: number
          notes?: string | null
          priority?: string | null
          staff_name?: string
          status?: string | null
          target_amount?: number
          target_category?: string
          target_quantity?: number
          updated_at?: string
          weight?: number | null
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
      pending_categories: {
        Row: {
          created_at: string
          id: string
          name_bn: string
          name_en: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_bn: string
          name_en: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_bn?: string
          name_en?: string
          slug?: string
          sort_order?: number
          updated_at?: string
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
      staff_activity_log: {
        Row: {
          action: string
          category: string
          created_at: string
          details: string | null
          id: string
          performed_by: string | null
          staff_id: string
        }
        Insert: {
          action: string
          category?: string
          created_at?: string
          details?: string | null
          id?: string
          performed_by?: string | null
          staff_id: string
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          details?: string | null
          id?: string
          performed_by?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_activity_log_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_performance: {
        Row: {
          comments: string | null
          created_at: string
          goals: string | null
          id: string
          period: string
          rating: number
          review_date: string
          reviewer: string | null
          staff_id: string
          strengths: string | null
          updated_at: string
          weaknesses: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          goals?: string | null
          id?: string
          period?: string
          rating?: number
          review_date?: string
          reviewer?: string | null
          staff_id: string
          strengths?: string | null
          updated_at?: string
          weaknesses?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          goals?: string | null
          id?: string
          period?: string
          rating?: number
          review_date?: string
          reviewer?: string | null
          staff_id?: string
          strengths?: string | null
          updated_at?: string
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_performance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_name: string | null
          comment: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_name?: string | null
          comment: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_name?: string | null
          comment?: string
          created_at?: string
          id?: string
          task_id?: string
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
      task_history: {
        Row: {
          action: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          performed_by: string | null
          performed_by_name: string | null
          task_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          task_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          task_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          category: string | null
          checklist: Json | null
          created_at: string
          description: string | null
          estimated_hours: number | null
          id: string
          name: string
          priority: string | null
          tags: string[] | null
          title: string
        }
        Insert: {
          category?: string | null
          checklist?: Json | null
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          name: string
          priority?: string | null
          tags?: string[] | null
          title: string
        }
        Update: {
          category?: string | null
          checklist?: Json | null
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          name?: string
          priority?: string | null
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          assigned_to_name: string | null
          attachment_url: string | null
          category: string
          checklist: Json | null
          color: string | null
          completed_on: string | null
          completion_note: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          location: string | null
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          progress: number
          recurrence: string | null
          reminder_date: string | null
          source_id: string | null
          source_type: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[] | null
          title: string
          updated_at: string
          verified_by: string | null
          verified_on: string | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          assigned_to_name?: string | null
          attachment_url?: string | null
          category?: string
          checklist?: Json | null
          color?: string | null
          completed_on?: string | null
          completion_note?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          location?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          recurrence?: string | null
          reminder_date?: string | null
          source_id?: string | null
          source_type?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
          verified_by?: string | null
          verified_on?: string | null
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          assigned_to_name?: string | null
          attachment_url?: string | null
          category?: string
          checklist?: Json | null
          color?: string | null
          completed_on?: string | null
          completion_note?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          location?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          recurrence?: string | null
          reminder_date?: string | null
          source_id?: string | null
          source_type?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
          verified_by?: string | null
          verified_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      upcoming_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_account_id: string | null
          customer_mobile: string | null
          customer_name: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_date: string
          purpose: string | null
          serial_no: number
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_account_id?: string | null
          customer_mobile?: string | null
          customer_name: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_date: string
          purpose?: string | null
          serial_no?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_account_id?: string | null
          customer_mobile?: string | null
          customer_name?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_date?: string
          purpose?: string | null
          serial_no?: number
          status?: string
          updated_at?: string
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
      get_system_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      action_status: "pending" | "in_progress" | "completed" | "overdue"
      app_role: "admin" | "user"
      kyc_status: "pending" | "verified" | "approved" | "rejected"
      meeting_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      risk_level: "low" | "medium" | "high"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "verified"
        | "cancelled"
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
      action_status: ["pending", "in_progress", "completed", "overdue"],
      app_role: ["admin", "user"],
      kyc_status: ["pending", "verified", "approved", "rejected"],
      meeting_status: ["scheduled", "in_progress", "completed", "cancelled"],
      risk_level: ["low", "medium", "high"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "pending",
        "in_progress",
        "completed",
        "verified",
        "cancelled",
      ],
    },
  },
} as const
