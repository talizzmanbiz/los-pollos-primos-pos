// Generated from the Supabase schema (mcp generate_typescript_types).
// Regenerate after schema changes.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accounting_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          reason: string | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      accounting_chart_of_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["accounting_account_type"]
          active: boolean
          created_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["accounting_account_type"]
          active?: boolean
          created_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: Database["public"]["Enums"]["accounting_account_type"]
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      accounting_journal: {
        Row: {
          account_code: string
          account_name: string
          created_at: string
          credit_amount: number
          debit_amount: number
          description: string | null
          entry_number: number
          id: string
          journal_date: string
          line_number: number
          source_id: string | null
          source_type: string | null
        }
        Insert: {
          account_code: string
          account_name: string
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          entry_number: number
          id?: string
          journal_date: string
          line_number: number
          source_id?: string | null
          source_type?: string | null
        }
        Update: {
          account_code?: string
          account_name?: string
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          entry_number?: number
          id?: string
          journal_date?: string
          line_number?: number
          source_id?: string | null
          source_type?: string | null
        }
        Relationships: []
      }
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["accounting_period_status"]
          year_month: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["accounting_period_status"]
          year_month: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["accounting_period_status"]
          year_month?: string
        }
        Relationships: []
      }
      accounting_transactions_expense: {
        Row: {
          account_code: string | null
          base_amount_usd: number
          created_at: string
          created_by: string | null
          description: string | null
          document_number: string | null
          document_type: Database["public"]["Enums"]["accounting_doc_type"]
          expense_type: Database["public"]["Enums"]["accounting_expense_type"]
          id: string
          is_deductible: boolean
          iva_amount_usd: number
          iva_creditable: boolean
          iva_rate: number | null
          location_id: string | null
          retention_amount: number
          supplier_name: string | null
          supplier_nit: string | null
          total_amount_usd: number
          transaction_date: string
        }
        Insert: {
          account_code?: string | null
          base_amount_usd: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["accounting_doc_type"]
          expense_type: Database["public"]["Enums"]["accounting_expense_type"]
          id?: string
          is_deductible?: boolean
          iva_amount_usd?: number
          iva_creditable?: boolean
          iva_rate?: number | null
          location_id?: string | null
          retention_amount?: number
          supplier_name?: string | null
          supplier_nit?: string | null
          total_amount_usd: number
          transaction_date?: string
        }
        Update: {
          account_code?: string | null
          base_amount_usd?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["accounting_doc_type"]
          expense_type?: Database["public"]["Enums"]["accounting_expense_type"]
          id?: string
          is_deductible?: boolean
          iva_amount_usd?: number
          iva_creditable?: boolean
          iva_rate?: number | null
          location_id?: string | null
          retention_amount?: number
          supplier_name?: string | null
          supplier_nit?: string | null
          total_amount_usd?: number
          transaction_date?: string
        }
        Relationships: []
      }
      accounting_transactions_income: {
        Row: {
          base_amount_usd: number
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_nit: string | null
          document_number: string | null
          id: string
          iva_amount_usd: number
          location_id: string | null
          payment_method: string
          quantity: number | null
          source_order_id: string | null
          synced_from_pos: boolean
          total_amount_usd: number
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          base_amount_usd: number
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_nit?: string | null
          document_number?: string | null
          id?: string
          iva_amount_usd?: number
          location_id?: string | null
          payment_method?: string
          quantity?: number | null
          source_order_id?: string | null
          synced_from_pos?: boolean
          total_amount_usd: number
          transaction_date?: string
          transaction_type?: string
        }
        Update: {
          base_amount_usd?: number
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_nit?: string | null
          document_number?: string | null
          id?: string
          iva_amount_usd?: number
          location_id?: string | null
          payment_method?: string
          quantity?: number | null
          source_order_id?: string | null
          synced_from_pos?: boolean
          total_amount_usd?: number
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          reason: string
          ref_id: string | null
          ref_type: string | null
          session_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason: string
          ref_id?: string | null
          ref_type?: string | null
          session_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          ref_id?: string | null
          ref_type?: string | null
          session_id?: string
        }
        Relationships: []
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          counted_amount: number | null
          expected_amount: number | null
          id: string
          location_id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          status: Database["public"]["Enums"]["cash_session_status"]
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          counted_amount?: number | null
          expected_amount?: number | null
          id?: string
          location_id: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_amount: number
          status?: Database["public"]["Enums"]["cash_session_status"]
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          counted_amount?: number | null
          expected_amount?: number | null
          id?: string
          location_id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          status?: Database["public"]["Enums"]["cash_session_status"]
        }
        Relationships: []
      }
      combo_components: {
        Row: {
          combo_product_id: string
          component_product_id: string
          id: string
          quantity: number
        }
        Insert: {
          combo_product_id: string
          component_product_id: string
          id?: string
          quantity: number
        }
        Update: {
          combo_product_id?: string
          component_product_id?: string
          id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_components_combo_product_id_fkey"
            columns: ["combo_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_components_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          active: boolean
          fee: number
          id: string
          location_id: string
          name: string
        }
        Insert: {
          active?: boolean
          fee: number
          id?: string
          location_id: string
          name: string
        }
        Update: {
          active?: boolean
          fee?: number
          id?: string
          location_id?: string
          name?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          unit: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          unit: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          unit?: string
        }
        Relationships: []
      }
      inventory_levels: {
        Row: {
          id: string
          inventory_item_id: string
          location_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          inventory_item_id: string
          location_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          inventory_item_id?: string
          location_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          inventory_item_id: string
          location_id: string
          notes: string | null
          reason: Database["public"]["Enums"]["inventory_reason"]
          ref_id: string | null
          ref_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          inventory_item_id: string
          location_id: string
          notes?: string | null
          reason: Database["public"]["Enums"]["inventory_reason"]
          ref_id?: string | null
          ref_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          inventory_item_id?: string
          location_id?: string
          notes?: string | null
          reason?: Database["public"]["Enums"]["inventory_reason"]
          ref_id?: string | null
          ref_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          allows_delivery: boolean
          code: string
          created_at: string
          id: string
          is_production: boolean
          name: string
        }
        Insert: {
          active?: boolean
          allows_delivery?: boolean
          code: string
          created_at?: string
          id?: string
          is_production?: boolean
          name: string
        }
        Update: {
          active?: boolean
          allows_delivery?: boolean
          code?: string
          created_at?: string
          id?: string
          is_production?: boolean
          name?: string
        }
        Relationships: []
      }
      order_counters: {
        Row: {
          last_number: number
          location_id: string
        }
        Insert: {
          last_number?: number
          location_id: string
        }
        Update: {
          last_number?: number
          location_id?: string
        }
        Relationships: []
      }
      order_item_batch_consumption: {
        Row: {
          id: string
          order_item_id: string
          production_batch_id: string
          quantity: number
        }
        Insert: {
          id?: string
          order_item_id: string
          production_batch_id: string
          quantity: number
        }
        Update: {
          id?: string
          order_item_id?: string
          production_batch_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_batch_consumption_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_batch_consumption_production_batch_id_fkey"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          notes: string | null
          order_id: string
          product_id: string
          production_batch_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number | null
          notes?: string | null
          order_id: string
          product_id: string
          production_batch_id?: string | null
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number | null
          notes?: string | null
          order_id?: string
          product_id?: string
          production_batch_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_production_batch_id_fkey"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cashier_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_fee: number
          delivery_zone_id: string | null
          estimated_minutes: number | null
          ghl_synced_at: string | null
          id: string
          location_id: string
          notes: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          cashier_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_zone_id?: string | null
          estimated_minutes?: number | null
          ghl_synced_at?: string | null
          id?: string
          location_id: string
          notes?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          source: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          cashier_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_zone_id?: string | null
          estimated_minutes?: number | null
          ghl_synced_at?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock_usage: {
        Row: {
          id: string
          inventory_item_id: string
          product_id: string
          quantity: number
        }
        Insert: {
          id?: string
          inventory_item_id: string
          product_id: string
          quantity: number
        }
        Update: {
          id?: string
          inventory_item_id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_usage_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_usage_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batch_inputs: {
        Row: {
          id: string
          production_batch_id: string
          purchase_batch_id: string
          quantity_consumed: number
        }
        Insert: {
          id?: string
          production_batch_id: string
          purchase_batch_id: string
          quantity_consumed: number
        }
        Update: {
          id?: string
          production_batch_id?: string
          purchase_batch_id?: string
          quantity_consumed?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_batch_inputs_production_batch_id_fkey"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_inputs_purchase_batch_id_fkey"
            columns: ["purchase_batch_id"]
            isOneToOne: false
            referencedRelation: "purchase_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batch_stock: {
        Row: {
          id: string
          location_id: string
          production_batch_id: string
          quantity_remaining: number
        }
        Insert: {
          id?: string
          location_id: string
          production_batch_id: string
          quantity_remaining?: number
        }
        Update: {
          id?: string
          location_id?: string
          production_batch_id?: string
          quantity_remaining?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_batch_stock_production_batch_id_fkey"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          created_at: string
          id: string
          location_id: string
          marination_start_at: string | null
          notes: string | null
          quantity_produced: number
          quantity_wasted: number
          roast_end_at: string | null
          roast_start_at: string | null
          staff_id: string | null
          status: Database["public"]["Enums"]["batch_status"]
          yield_percentage: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          marination_start_at?: string | null
          notes?: string | null
          quantity_produced?: number
          quantity_wasted?: number
          roast_end_at?: string | null
          roast_start_at?: string | null
          staff_id?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          yield_percentage?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          marination_start_at?: string | null
          notes?: string | null
          quantity_produced?: number
          quantity_wasted?: number
          roast_end_at?: string | null
          roast_start_at?: string | null
          staff_id?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          yield_percentage?: number | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          cost_price: number | null
          created_at: string
          id: string
          name: string
          price: number
          product_type: Database["public"]["Enums"]["product_type"]
          secondary_name: string | null
          sku: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          cost_price?: number | null
          created_at?: string
          id?: string
          name: string
          price: number
          product_type: Database["public"]["Enums"]["product_type"]
          secondary_name?: string | null
          sku: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          cost_price?: number | null
          created_at?: string
          id?: string
          name?: string
          price?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          secondary_name?: string | null
          sku?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          location_id: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id: string
          location_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          location_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      purchase_batches: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          notes: string | null
          purchase_date: string
          quantity_lb: number | null
          quantity_received: number
          quantity_remaining: number
          quantity_units: number | null
          supplier_name: string
          total_cost: number
          unit: Database["public"]["Enums"]["purchase_unit"]
          unit_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          notes?: string | null
          purchase_date?: string
          quantity_lb?: number | null
          quantity_received?: number
          quantity_remaining?: number
          quantity_units?: number | null
          supplier_name: string
          total_cost?: number
          unit?: Database["public"]["Enums"]["purchase_unit"]
          unit_cost: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          purchase_date?: string
          quantity_lb?: number | null
          quantity_received?: number
          quantity_remaining?: number
          quantity_units?: number | null
          supplier_name?: string
          total_cost?: number
          unit?: Database["public"]["Enums"]["purchase_unit"]
          unit_cost?: number
        }
        Relationships: []
      }
      reviews: {
        Row: {
          approved: boolean
          comment: string | null
          created_at: string
          customer_name: string | null
          id: string
          order_id: string | null
          rating: number
        }
        Insert: {
          approved?: boolean
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          order_id?: string | null
          rating: number
        }
        Update: {
          approved?: boolean
          comment?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          order_id?: string | null
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_items: {
        Row: {
          id: string
          inventory_item_id: string
          production_batch_id: string | null
          quantity: number
          transfer_id: string
        }
        Insert: {
          id?: string
          inventory_item_id: string
          production_batch_id?: string | null
          quantity: number
          transfer_id: string
        }
        Update: {
          id?: string
          inventory_item_id?: string
          production_batch_id?: string | null
          quantity?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          created_at: string
          created_by: string | null
          from_location_id: string
          id: string
          notes: string | null
          received_at: string | null
          received_by: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_location_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_location_id: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_location_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_location_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      accounting_iva_monthly: {
        Row: {
          year_month: string | null
          total_sales_base: number | null
          iva_debito: number | null
          total_purchases_base: number | null
          iva_credito: number | null
          iva_neto: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accounting_ledger: {
        Args: { p_start: string; p_end: string }
        Returns: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["accounting_account_type"]
          opening_balance: number
          period_debits: number
          period_credits: number
          closing_balance: number
        }[]
      }
      accounting_set_period: {
        Args: { p_month: string; p_status: Database["public"]["Enums"]["accounting_period_status"]; p_notes?: string }
        Returns: Database["public"]["Tables"]["accounting_periods"]["Row"]
      }
      accounting_sync_from_pos: {
        Args: { p_since?: string }
        Returns: number
      }
      close_cash_session: {
        Args: { p_session: string; p_counted: number; p_notes?: string }
        Returns: Database["public"]["Tables"]["cash_sessions"]["Row"]
      }
      adjust_inventory: {
        Args: { p_location: string; p_item: string; p_new_quantity: number; p_notes: string }
        Returns: undefined
      }
      create_transfer: {
        Args: {
          p_from: string
          p_to: string
          p_items: { inventory_item_id: string; quantity: number }[]
          p_notes?: string
        }
        Returns: Database["public"]["Tables"]["transfers"]["Row"]
      }
      receive_transfer: {
        Args: { p_transfer: string }
        Returns: Database["public"]["Tables"]["transfers"]["Row"]
      }
      close_production_batch: {
        Args: {
          p_batch: string
          p_quantity_produced: number
          p_quantity_wasted?: number
          p_raw_consumed?: number
          p_inputs?: { purchase_batch_id: string; quantity: number }[]
        }
        Returns: Database["public"]["Tables"]["production_batches"]["Row"]
      }
    }
    Enums: {
      accounting_account_type: "activo" | "pasivo" | "capital" | "ingreso" | "gasto"
      accounting_doc_type: "ccf" | "dte" | "factura" | "recibo" | "ticket" | "ninguno"
      accounting_period_status: "abierto" | "revisado" | "cerrado"
      accounting_expense_type:
        | "ingredientes"
        | "gas"
        | "luz"
        | "agua"
        | "mod"
        | "alquiler"
        | "empaques"
        | "servicios"
        | "otros"
      batch_status: "open" | "closed"
      cash_session_status: "open" | "closed"
      inventory_reason:
        | "sale"
        | "cancellation"
        | "production"
        | "purchase"
        | "transfer_out"
        | "transfer_in"
        | "adjustment"
        | "waste"
        | "initial"
      order_source: "pos" | "online" | "whatsapp"
      order_status:
        | "received"
        | "in_progress"
        | "ready"
        | "out_for_delivery"
        | "completed"
        | "cancelled"
      order_type: "walk_in" | "pickup" | "delivery"
      payment_method: "cash" | "payment_link"
      payment_status: "pending" | "paid" | "refunded"
      product_type: "combo" | "chicken" | "extra" | "beverage"
      purchase_unit: "unidades" | "libras"
      transfer_status: "in_transit" | "received" | "cancelled"
      user_role: "superadmin" | "admin" | "cajero" | "cocina" | "repartidor" | "contador" | "auditor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]

export type UserRole = Enums<"user_role">
export type OrderStatus = Enums<"order_status">
export type OrderSource = Enums<"order_source">
export type OrderType = Enums<"order_type">
export type Profile = Tables<"profiles">
export type Location = Tables<"locations">
export type Product = Tables<"products">
export type Order = Tables<"orders">
export type OrderItem = Tables<"order_items">
export type Review = Tables<"reviews">
export type AccountingIncome = Tables<"accounting_transactions_income">
export type AccountingExpense = Tables<"accounting_transactions_expense">
export type AccountingJournalLine = Tables<"accounting_journal">
export type AccountingAccount = Tables<"accounting_chart_of_accounts">
export type AccountingAuditLog = Tables<"accounting_audit_log">
export type IvaMonthly = Database["public"]["Views"]["accounting_iva_monthly"]["Row"]
export type LedgerRow = Database["public"]["Functions"]["accounting_ledger"]["Returns"][number]
export type AccountingPeriod = Tables<"accounting_periods">
export type AccountingPeriodStatus = Enums<"accounting_period_status">
