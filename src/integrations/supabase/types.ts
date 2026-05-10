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
      accessory_stock_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          master_product_id: string
          movement_type: string
          notes: string | null
          qty: number
          reference_id: string | null
          supplier_id: string | null
          transaction_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          master_product_id: string
          movement_type: string
          notes?: string | null
          qty: number
          reference_id?: string | null
          supplier_id?: string | null
          transaction_date?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          master_product_id?: string
          movement_type?: string
          notes?: string | null
          qty?: number
          reference_id?: string | null
          supplier_id?: string | null
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "accessory_stock_ledger_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "accessory_stock_summary"
            referencedColumns: ["master_product_id"]
          },
          {
            foreignKeyName: "accessory_stock_ledger_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessory_stock_ledger_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bonus_items: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          master_product_id: string | null
          name: string
          sort_order: number
          track_stock: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          master_product_id?: string | null
          name: string
          sort_order?: number
          track_stock?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          master_product_id?: string | null
          name?: string
          sort_order?: number
          track_stock?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bonus_items_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "accessory_stock_summary"
            referencedColumns: ["master_product_id"]
          },
          {
            foreignKeyName: "bonus_items_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_rules: {
        Row: {
          bonus_item_id: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          master_product_id: string | null
          scope_type: string
          sort_order: number
        }
        Insert: {
          bonus_item_id: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          master_product_id?: string | null
          scope_type: string
          sort_order?: number
        }
        Update: {
          bonus_item_id?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          master_product_id?: string | null
          scope_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_rules_bonus_item_id_fkey"
            columns: ["bonus_item_id"]
            isOneToOne: false
            referencedRelation: "bonus_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_rules_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "accessory_stock_summary"
            referencedColumns: ["master_product_id"]
          },
          {
            foreignKeyName: "bonus_rules_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          city: string | null
          code: string | null
          created_at: string
          district: string | null
          full_address: string | null
          google_maps_url: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          postal_code: string | null
          province: string | null
          updated_at: string
          village: string | null
        }
        Insert: {
          city?: string | null
          code?: string | null
          created_at?: string
          district?: string | null
          full_address?: string | null
          google_maps_url?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          updated_at?: string
          village?: string | null
        }
        Update: {
          city?: string | null
          code?: string | null
          created_at?: string
          district?: string | null
          full_address?: string | null
          google_maps_url?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          updated_at?: string
          village?: string | null
        }
        Relationships: []
      }
      catalog_products: {
        Row: {
          catalog_series: string | null
          catalog_status: string
          catalog_warranty_type: string | null
          created_at: string
          description: string | null
          display_name: string
          free_shipping: boolean
          highlight_product: boolean
          id: string
          is_flash_sale: boolean
          override_display_price: number | null
          product_id: string | null
          promo_badge: string | null
          promo_label: string | null
          publish_to_web: boolean
          rating_score: number | null
          slug: string | null
          spec_warranty_duration: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          catalog_series?: string | null
          catalog_status?: string
          catalog_warranty_type?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          free_shipping?: boolean
          highlight_product?: boolean
          id?: string
          is_flash_sale?: boolean
          override_display_price?: number | null
          product_id?: string | null
          promo_badge?: string | null
          promo_label?: string | null
          publish_to_web?: boolean
          rating_score?: number | null
          slug?: string | null
          spec_warranty_duration?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          catalog_series?: string | null
          catalog_status?: string
          catalog_warranty_type?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          free_shipping?: boolean
          highlight_product?: boolean
          id?: string
          is_flash_sale?: boolean
          override_display_price?: number | null
          product_id?: string | null
          promo_badge?: string | null
          promo_label?: string | null
          publish_to_web?: boolean
          rating_score?: number | null
          slug?: string | null
          spec_warranty_duration?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "accessory_stock_summary"
            referencedColumns: ["master_product_id"]
          },
          {
            foreignKeyName: "catalog_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog_entries: {
        Row: {
          created_at: string
          description: string | null
          id: string
          title: string
          type: string
          version: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          title: string
          type?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          type?: string
          version?: string | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          city: string | null
          created_at: string
          district: string | null
          full_address: string
          id: string
          is_default: boolean
          label: string | null
          phone: string
          postal_code: string | null
          province: string | null
          recipient_name: string
          updated_at: string
          user_id: string
          village: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          district?: string | null
          full_address: string
          id?: string
          is_default?: boolean
          label?: string | null
          phone: string
          postal_code?: string | null
          province?: string | null
          recipient_name: string
          updated_at?: string
          user_id: string
          village?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          district?: string | null
          full_address?: string
          id?: string
          is_default?: boolean
          label?: string | null
          phone?: string
          postal_code?: string | null
          province?: string | null
          recipient_name?: string
          updated_at?: string
          user_id?: string
          village?: string | null
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          applies_to_all: boolean
          code: string
          cover_packing_kayu: boolean
          created_at: string
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_discount: number | null
          max_discount_cap: number | null
          max_uses: number | null
          min_purchase: number | null
          min_purchase_amount: number | null
          shipping_subsidy_amount: number | null
          shipping_subsidy_unlimited: boolean
          updated_at: string
          usage_count: number
          usage_limit: number | null
          used_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to_all?: boolean
          code: string
          cover_packing_kayu?: boolean
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_discount?: number | null
          max_discount_cap?: number | null
          max_uses?: number | null
          min_purchase?: number | null
          min_purchase_amount?: number | null
          shipping_subsidy_amount?: number | null
          shipping_subsidy_unlimited?: boolean
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to_all?: boolean
          code?: string
          cover_packing_kayu?: boolean
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_discount?: number | null
          max_discount_cap?: number | null
          max_uses?: number | null
          min_purchase?: number | null
          min_purchase_amount?: number | null
          shipping_subsidy_amount?: number | null
          shipping_subsidy_unlimited?: boolean
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      flash_sale_settings: {
        Row: {
          created_at: string
          duration_hours: number
          end_time: string | null
          event_name: string | null
          id: string
          is_active: boolean
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_hours?: number
          end_time?: string | null
          event_name?: string | null
          id?: string
          is_active?: boolean
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_hours?: number
          end_time?: string | null
          event_name?: string | null
          id?: string
          is_active?: boolean
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_settings: {
        Row: {
          branch_id: string | null
          company_address: string | null
          company_name: string | null
          company_phone: string | null
          created_at: string
          footer_note: string | null
          id: string
          logo_url: string | null
          show_logo: boolean
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_address?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          footer_note?: string | null
          id?: string
          logo_url?: string | null
          show_logo?: boolean
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_address?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          footer_note?: string | null
          id?: string
          logo_url?: string | null
          show_logo?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          branch_id: string | null
          channel: string | null
          created_at: string
          customer_name: string | null
          handled_by_name: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_status: string
          public_token: string | null
          status: string
          total: number
          transaction_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          channel?: string | null
          created_at?: string
          customer_name?: string | null
          handled_by_name?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: string
          public_token?: string | null
          status?: string
          total?: number
          transaction_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          channel?: string | null
          created_at?: string
          customer_name?: string | null
          handled_by_name?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: string
          public_token?: string | null
          status?: string
          total?: number
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      master_products: {
        Row: {
          base_price: number | null
          category: Database["public"]["Enums"]["product_category"]
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          series: string
          size_mm: number | null
          storage_gb: number | null
          updated_at: string
          warranty_type: Database["public"]["Enums"]["warranty_type"] | null
          weight_gram: number | null
        }
        Insert: {
          base_price?: number | null
          category: Database["public"]["Enums"]["product_category"]
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          series: string
          size_mm?: number | null
          storage_gb?: number | null
          updated_at?: string
          warranty_type?: Database["public"]["Enums"]["warranty_type"] | null
          weight_gram?: number | null
        }
        Update: {
          base_price?: number | null
          category?: Database["public"]["Enums"]["product_category"]
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          series?: string
          size_mm?: number | null
          storage_gb?: number | null
          updated_at?: string
          warranty_type?: Database["public"]["Enums"]["warranty_type"] | null
          weight_gram?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      opname_scanned_items: {
        Row: {
          action_notes: string | null
          action_taken: string | null
          id: string
          imei: string | null
          scan_result: string
          scanned_at: string
          scanned_by: string | null
          scanned_value: string | null
          session_id: string
          stock_unit_id: string | null
        }
        Insert: {
          action_notes?: string | null
          action_taken?: string | null
          id?: string
          imei?: string | null
          scan_result?: string
          scanned_at?: string
          scanned_by?: string | null
          scanned_value?: string | null
          session_id: string
          stock_unit_id?: string | null
        }
        Update: {
          action_notes?: string | null
          action_taken?: string | null
          id?: string
          imei?: string | null
          scan_result?: string
          scanned_at?: string
          scanned_by?: string | null
          scanned_value?: string | null
          session_id?: string
          stock_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opname_scanned_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "opname_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opname_scanned_items_stock_unit_id_fkey"
            columns: ["stock_unit_id"]
            isOneToOne: false
            referencedRelation: "stock_units"
            referencedColumns: ["id"]
          },
        ]
      }
      opname_schedules: {
        Row: {
          branch_id: string
          created_at: string
          cron_time: string | null
          days_of_week: number[] | null
          id: string
          is_active: boolean
          notes: string | null
          schedule_type: string
          scheduled_date: string
          status: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          cron_time?: string | null
          days_of_week?: number[] | null
          id?: string
          is_active?: boolean
          notes?: string | null
          schedule_type?: string
          scheduled_date: string
          status?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          cron_time?: string | null
          days_of_week?: number[] | null
          id?: string
          is_active?: boolean
          notes?: string | null
          schedule_type?: string
          scheduled_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "opname_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      opname_session_assignments: {
        Row: {
          created_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opname_session_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "opname_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      opname_sessions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          locked_at: string | null
          notes: string | null
          session_code: string | null
          session_status: string
          session_type: string
          started_at: string | null
          status: string
          total_expected: number
          total_match: number
          total_missing: number
          total_scanned: number
          total_unregistered: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          locked_at?: string | null
          notes?: string | null
          session_code?: string | null
          session_status?: string
          session_type?: string
          started_at?: string | null
          status?: string
          total_expected?: number
          total_match?: number
          total_missing?: number
          total_scanned?: number
          total_unregistered?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          locked_at?: string | null
          notes?: string | null
          session_code?: string | null
          session_status?: string
          session_type?: string
          started_at?: string | null
          status?: string
          total_expected?: number
          total_match?: number
          total_missing?: number
          total_scanned?: number
          total_unregistered?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opname_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      opname_snapshot_items: {
        Row: {
          action_notes: string | null
          action_taken: string | null
          branch_id: string | null
          cost_price: number | null
          created_at: string
          id: string
          imei: string | null
          product_id: string | null
          product_label: string | null
          scan_result: string
          selling_price: number | null
          serial_number: string | null
          session_id: string
          snapshot_at: string
          sold_reference_id: string | null
          stock_status: string | null
          stock_unit_id: string | null
          unit_id: string | null
        }
        Insert: {
          action_notes?: string | null
          action_taken?: string | null
          branch_id?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          imei?: string | null
          product_id?: string | null
          product_label?: string | null
          scan_result?: string
          selling_price?: number | null
          serial_number?: string | null
          session_id: string
          snapshot_at?: string
          sold_reference_id?: string | null
          stock_status?: string | null
          stock_unit_id?: string | null
          unit_id?: string | null
        }
        Update: {
          action_notes?: string | null
          action_taken?: string | null
          branch_id?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          imei?: string | null
          product_id?: string | null
          product_label?: string | null
          scan_result?: string
          selling_price?: number | null
          serial_number?: string | null
          session_id?: string
          snapshot_at?: string
          sold_reference_id?: string | null
          stock_status?: string | null
          stock_unit_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opname_snapshot_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opname_snapshot_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "accessory_stock_summary"
            referencedColumns: ["master_product_id"]
          },
          {
            foreignKeyName: "opname_snapshot_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opname_snapshot_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "opname_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opname_snapshot_items_stock_unit_id_fkey"
            columns: ["stock_unit_id"]
            isOneToOne: false
            referencedRelation: "stock_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opname_snapshot_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "stock_units"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      rajaongkir_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          priority: number
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          priority?: number
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          priority?: number
        }
        Relationships: []
      }
      shipping_settings: {
        Row: {
          id: string
          packing_kayu_global: number
          packing_kayu_jawa: number | null
          packing_kayu_sumatra: number | null
          packing_kayu_kalimantan: number | null
          packing_kayu_sulawesi: number | null
          packing_kayu_ntt: number | null
          packing_kayu_maluku: number | null
          packing_kayu_papua: number | null
          enabled_couriers: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          packing_kayu_global?: number
          packing_kayu_jawa?: number | null
          packing_kayu_sumatra?: number | null
          packing_kayu_kalimantan?: number | null
          packing_kayu_sulawesi?: number | null
          packing_kayu_ntt?: number | null
          packing_kayu_maluku?: number | null
          packing_kayu_papua?: number | null
          enabled_couriers?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          packing_kayu_global?: number
          packing_kayu_jawa?: number | null
          packing_kayu_sumatra?: number | null
          packing_kayu_kalimantan?: number | null
          packing_kayu_sulawesi?: number | null
          packing_kayu_ntt?: number | null
          packing_kayu_maluku?: number | null
          packing_kayu_papua?: number | null
          enabled_couriers?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          is_approved: boolean
          is_featured: boolean
          product_name: string | null
          rating: number
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          product_name?: string | null
          rating?: number
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          product_name?: string | null
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      sale_campaign_items: {
        Row: {
          campaign_id: string
          catalog_product_id: string | null
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          id: string
        }
        Insert: {
          campaign_id: string
          catalog_product_id?: string | null
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
        }
        Update: {
          campaign_id?: string
          catalog_product_id?: string | null
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_campaign_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sale_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_campaign_items_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_campaigns: {
        Row: {
          campaign_name: string
          created_at: string
          end_time: string | null
          gradient_end: string | null
          gradient_start: string | null
          id: string
          is_active: boolean
          start_time: string | null
          updated_at: string
        }
        Insert: {
          campaign_name: string
          created_at?: string
          end_time?: string | null
          gradient_end?: string | null
          gradient_start?: string | null
          id?: string
          is_active?: boolean
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          campaign_name?: string
          created_at?: string
          end_time?: string | null
          gradient_end?: string | null
          gradient_start?: string | null
          id?: string
          is_active?: boolean
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_vendors: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_status_labels: {
        Row: {
          color_hue: number
          color_lightness: number
          color_saturation: number
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color_hue?: number
          color_lightness?: number
          color_saturation?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color_hue?: number
          color_lightness?: number
          color_saturation?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_unit_logs: {
        Row: {
          changed_at: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
          unit_id: string
        }
        Insert: {
          changed_at?: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          unit_id: string
        }
        Update: {
          changed_at?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_unit_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "stock_units"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_units: {
        Row: {
          batch_code: string | null
          branch_id: string | null
          condition_status:
            | Database["public"]["Enums"]["condition_status"]
            | null
          cost_price: number | null
          cost_price_per_unit: number | null
          created_at: string
          estimated_arrival_at: string | null
          id: string
          imei: string | null
          minus_description: string | null
          minus_severity: Database["public"]["Enums"]["minus_severity"] | null
          notes: string | null
          product_id: string
          qty_available: number | null
          received_at: string
          reserved_at: string | null
          selling_price: number | null
          serial_number: string | null
          sold_at: string | null
          sold_channel: Database["public"]["Enums"]["sold_channel"] | null
          sold_reference_id: string | null
          status_changed_at: string
          stock_status: string
          supplier: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          batch_code?: string | null
          branch_id?: string | null
          condition_status?:
            | Database["public"]["Enums"]["condition_status"]
            | null
          cost_price?: number | null
          cost_price_per_unit?: number | null
          created_at?: string
          estimated_arrival_at?: string | null
          id?: string
          imei?: string | null
          minus_description?: string | null
          minus_severity?: Database["public"]["Enums"]["minus_severity"] | null
          notes?: string | null
          product_id: string
          qty_available?: number | null
          received_at?: string
          reserved_at?: string | null
          selling_price?: number | null
          serial_number?: string | null
          sold_at?: string | null
          sold_channel?: Database["public"]["Enums"]["sold_channel"] | null
          sold_reference_id?: string | null
          status_changed_at?: string
          stock_status?: string
          supplier?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          batch_code?: string | null
          branch_id?: string | null
          condition_status?:
            | Database["public"]["Enums"]["condition_status"]
            | null
          cost_price?: number | null
          cost_price_per_unit?: number | null
          created_at?: string
          estimated_arrival_at?: string | null
          id?: string
          imei?: string | null
          minus_description?: string | null
          minus_severity?: Database["public"]["Enums"]["minus_severity"] | null
          notes?: string | null
          product_id?: string
          qty_available?: number | null
          received_at?: string
          reserved_at?: string | null
          selling_price?: number | null
          serial_number?: string | null
          sold_at?: string | null
          sold_channel?: Database["public"]["Enums"]["sold_channel"] | null
          sold_reference_id?: string | null
          status_changed_at?: string
          stock_status?: string
          supplier?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_units_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "accessory_stock_summary"
            referencedColumns: ["master_product_id"]
          },
          {
            foreignKeyName: "stock_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_units_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transaction_items: {
        Row: {
          created_at: string
          id: string
          imei: string | null
          product_label: string | null
          product_name: string
          qty: number
          selling_price: number | null
          serial_number: string | null
          stock_unit_id: string | null
          subtotal: number
          transaction_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          imei?: string | null
          product_label?: string | null
          product_name: string
          qty?: number
          selling_price?: number | null
          serial_number?: string | null
          stock_unit_id?: string | null
          subtotal?: number
          transaction_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          imei?: string | null
          product_label?: string | null
          product_name?: string
          qty?: number
          selling_price?: number | null
          serial_number?: string | null
          stock_unit_id?: string | null
          subtotal?: number
          transaction_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_stock_unit_id_fkey"
            columns: ["stock_unit_id"]
            isOneToOne: false
            referencedRelation: "stock_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          branch_id: string | null
          channel: Database["public"]["Enums"]["sold_channel"] | null
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_user_id: string | null
          discount: number
          grand_total: number
          handled_by: string | null
          handled_by_name: string | null
          id: string
          notes: string | null
          payment_method: string | null
          payment_method_name: string | null
          payment_status: string
          shipping_courier: string | null
          shipping_service: string | null
          status: string
          total: number
          transaction_code: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          channel?: Database["public"]["Enums"]["sold_channel"] | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_user_id?: string | null
          discount?: number
          grand_total?: number
          handled_by?: string | null
          handled_by_name?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_method_name?: string | null
          payment_status?: string
          shipping_courier?: string | null
          shipping_service?: string | null
          status?: string
          total?: number
          transaction_code?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          channel?: Database["public"]["Enums"]["sold_channel"] | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_user_id?: string | null
          discount?: number
          grand_total?: number
          handled_by?: string | null
          handled_by_name?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_method_name?: string | null
          payment_status?: string
          shipping_courier?: string | null
          shipping_service?: string | null
          status?: string
          total?: number
          transaction_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_default: boolean
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_resend_at: string | null
          phone: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          last_resend_at?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_resend_at?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
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
      warranty_claims: {
        Row: {
          claim_date: string
          claim_status: string
          claim_type: string
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          is_imei_warranty_claimed: boolean
          issue_description: string | null
          notes: string | null
          repair_branch_id: string | null
          repair_cost: number | null
          replacement_unit_id: string | null
          resolution: string | null
          resolution_type: string | null
          resolved_at: string | null
          service_vendor_id: string | null
          service_vendor_name: string | null
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          claim_date?: string
          claim_status?: string
          claim_type?: string
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_imei_warranty_claimed?: boolean
          issue_description?: string | null
          notes?: string | null
          repair_branch_id?: string | null
          repair_cost?: number | null
          replacement_unit_id?: string | null
          resolution?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          service_vendor_id?: string | null
          service_vendor_name?: string | null
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          claim_date?: string
          claim_status?: string
          claim_type?: string
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_imei_warranty_claimed?: boolean
          issue_description?: string | null
          notes?: string | null
          repair_branch_id?: string | null
          repair_cost?: number | null
          replacement_unit_id?: string | null
          resolution?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          service_vendor_id?: string | null
          service_vendor_name?: string | null
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_claims_repair_branch_id_fkey"
            columns: ["repair_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_replacement_unit_id_fkey"
            columns: ["replacement_unit_id"]
            isOneToOne: false
            referencedRelation: "stock_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_service_vendor_id_fkey"
            columns: ["service_vendor_id"]
            isOneToOne: false
            referencedRelation: "service_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "stock_units"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_labels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          label: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
        }
        Relationships: []
      }
    }
    Views: {
      accessory_stock_summary: {
        Row: {
          category: Database["public"]["Enums"]["product_category"] | null
          master_product_id: string | null
          name: string | null
          qty_remaining: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_active_flash_sale_info: { Args: never; Returns: Json[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "pending" | "active" | "suspended" | "rejected"
      app_role: "super_admin" | "admin_branch" | "employee" | "web_admin"
      condition_status: "no_minus" | "minus"
      minus_severity: "minor" | "mayor"
      product_category:
        | "iphone"
        | "ipad"
        | "accessory"
        | "macbook"
        | "watch"
        | "airpods"
      sold_channel:
        | "pos"
        | "ecommerce_tokopedia"
        | "ecommerce_shopee"
        | "website"
        | "offline_non_pos"
      warranty_type:
        | "resmi_bc"
        | "ibox"
        | "inter"
        | "whitelist"
        | "digimap"
        | "resmi"
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
      account_status: ["pending", "active", "suspended", "rejected"],
      app_role: ["super_admin", "admin_branch", "employee", "web_admin"],
      condition_status: ["no_minus", "minus"],
      minus_severity: ["minor", "mayor"],
      product_category: [
        "iphone",
        "ipad",
        "accessory",
        "macbook",
        "watch",
        "airpods",
      ],
      sold_channel: [
        "pos",
        "ecommerce_tokopedia",
        "ecommerce_shopee",
        "website",
        "offline_non_pos",
      ],
      warranty_type: [
        "resmi_bc",
        "ibox",
        "inter",
        "whitelist",
        "digimap",
        "resmi",
      ],
    },
  },
} as const
