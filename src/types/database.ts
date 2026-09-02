// Generated from the Supabase schema (mcp generate_typescript_types).
// Regenerate after schema changes — y despues volve a aplicar DOS parches a mano:
//   1. Columnas que llena un trigger, no un default, quedan como obligatorias en
//      Insert porque el generador no ve el trigger. Marcalas opcionales:
//      orders.order_number, purchase_batches.quantity_received/_remaining/total_cost.
//      Ojo con order_number: si el cliente lo manda, el trigger NO lo asigna y se
//      rompe el correlativo (ver 0027_correlativo_a_prueba_de_desfase.sql).
//   2. El bloque de alias de dominio del final.
//   3. La tabla `customers` y `orders.customer_id` se agregaron a mano (0034).
//      phone_key/nit_key son columnas generadas: van en Row pero NUNCA en
//      Insert/Update, o Postgres rechaza la escritura. Si regeneras, revisa que
//      sigan fuera y que cancel_order/mark_order_refunded incluyan customer_id
//      en su retorno, que es una fila de orders.
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
        Relationships: [
          {
            foreignKeyName: "accounting_journal_account_code_fkey"
            columns: ["account_code"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["account_code"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "accounting_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_periods_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_suppliers: {
        Row: {
          created_at: string
          dui: string | null
          expense_type: Database["public"]["Enums"]["accounting_expense_type"]
          id: string
          name: string
          nit: string | null
          nrc: string | null
          renta_clasificacion: string
          renta_sector: string
          renta_tipo_costo_gasto: string
        }
        Insert: {
          created_at?: string
          dui?: string | null
          expense_type?: Database["public"]["Enums"]["accounting_expense_type"]
          id?: string
          name: string
          nit?: string | null
          nrc?: string | null
          renta_clasificacion?: string
          renta_sector?: string
          renta_tipo_costo_gasto?: string
        }
        Update: {
          created_at?: string
          dui?: string | null
          expense_type?: Database["public"]["Enums"]["accounting_expense_type"]
          id?: string
          name?: string
          nit?: string | null
          nrc?: string | null
          renta_clasificacion?: string
          renta_sector?: string
          renta_tipo_costo_gasto?: string
        }
        Relationships: []
      }
      accounting_transactions_expense: {
        Row: {
          account_code: string | null
          base_amount_usd: number
          clase_documento: string
          codigo_generacion: string | null
          compras_exentas: number
          created_at: string
          created_by: string | null
          description: string | null
          document_number: string | null
          document_type: Database["public"]["Enums"]["accounting_doc_type"]
          expense_type: Database["public"]["Enums"]["accounting_expense_type"]
          id: string
          importaciones_exentas: number
          importaciones_gravadas_bienes: number
          importaciones_gravadas_servicios: number
          internaciones_exentas: number
          internaciones_gravadas: number
          is_deductible: boolean
          iva_amount_usd: number
          iva_creditable: boolean
          iva_rate: number | null
          location_id: string | null
          raw_dte: Json | null
          renta_clasificacion: string
          renta_sector: string
          renta_tipo_costo_gasto: string
          renta_tipo_operacion: string
          retention_amount: number
          sello_recibido: string | null
          source: string
          supplier_dui: string | null
          supplier_name: string | null
          supplier_nit: string | null
          tipo_documento_mh: string
          total_amount_usd: number
          transaction_date: string
        }
        Insert: {
          account_code?: string | null
          base_amount_usd: number
          clase_documento?: string
          codigo_generacion?: string | null
          compras_exentas?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["accounting_doc_type"]
          expense_type: Database["public"]["Enums"]["accounting_expense_type"]
          id?: string
          importaciones_exentas?: number
          importaciones_gravadas_bienes?: number
          importaciones_gravadas_servicios?: number
          internaciones_exentas?: number
          internaciones_gravadas?: number
          is_deductible?: boolean
          iva_amount_usd?: number
          iva_creditable?: boolean
          iva_rate?: number | null
          location_id?: string | null
          raw_dte?: Json | null
          renta_clasificacion?: string
          renta_sector?: string
          renta_tipo_costo_gasto?: string
          renta_tipo_operacion?: string
          retention_amount?: number
          sello_recibido?: string | null
          source?: string
          supplier_dui?: string | null
          supplier_name?: string | null
          supplier_nit?: string | null
          tipo_documento_mh?: string
          total_amount_usd: number
          transaction_date?: string
        }
        Update: {
          account_code?: string | null
          base_amount_usd?: number
          clase_documento?: string
          codigo_generacion?: string | null
          compras_exentas?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["accounting_doc_type"]
          expense_type?: Database["public"]["Enums"]["accounting_expense_type"]
          id?: string
          importaciones_exentas?: number
          importaciones_gravadas_bienes?: number
          importaciones_gravadas_servicios?: number
          internaciones_exentas?: number
          internaciones_gravadas?: number
          is_deductible?: boolean
          iva_amount_usd?: number
          iva_creditable?: boolean
          iva_rate?: number | null
          location_id?: string | null
          raw_dte?: Json | null
          renta_clasificacion?: string
          renta_sector?: string
          renta_tipo_costo_gasto?: string
          renta_tipo_operacion?: string
          retention_amount?: number
          sello_recibido?: string | null
          source?: string
          supplier_dui?: string | null
          supplier_name?: string | null
          supplier_nit?: string | null
          tipo_documento_mh?: string
          total_amount_usd?: number
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_transactions_expense_account_code_fkey"
            columns: ["account_code"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["account_code"]
          },
          {
            foreignKeyName: "accounting_transactions_expense_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_transactions_expense_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "accounting_transactions_income_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_transactions_income_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_transactions_income_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "cash_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "cash_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      customers: {
        Row: {
          cod_actividad: string | null
          complemento: string | null
          created_at: string
          departamento: string | null
          desc_actividad: string | null
          distrito: string | null
          email: string | null
          id: string
          municipio: string | null
          name: string | null
          nit: string | null
          nit_key: string | null
          nrc: string | null
          phone: string | null
          phone_key: string | null
          updated_at: string
        }
        Insert: {
          cod_actividad?: string | null
          complemento?: string | null
          created_at?: string
          departamento?: string | null
          desc_actividad?: string | null
          distrito?: string | null
          email?: string | null
          id?: string
          municipio?: string | null
          name?: string | null
          nit?: string | null
          nrc?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          cod_actividad?: string | null
          complemento?: string | null
          created_at?: string
          departamento?: string | null
          desc_actividad?: string | null
          distrito?: string | null
          email?: string | null
          id?: string
          municipio?: string | null
          name?: string | null
          nit?: string | null
          nrc?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "delivery_zones_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      dte_correlativos: {
        Row: {
          tipo_dte: string
          ultimo: number
        }
        Insert: {
          tipo_dte: string
          ultimo?: number
        }
        Update: {
          tipo_dte?: string
          ultimo?: number
        }
        Relationships: []
      }
      dte_documents: {
        Row: {
          codigo_generacion: string
          created_at: string
          email_enviado_at: string | null
          estado: Database["public"]["Enums"]["dte_estado"]
          fecha_emision: string
          hora_emision: string
          id: string
          intentos: number
          json_dte: Json | null
          json_respuesta: Json | null
          numero_control: string
          order_id: string | null
          receptor_correo: string | null
          receptor_nit: string | null
          receptor_nombre: string | null
          receptor_nrc: string | null
          sello_recibido: string | null
          tipo_dte: string
          total_exento: number
          total_gravado: number
          total_iva: number
          total_pagar: number
          ultimo_error: string | null
          updated_at: string
        }
        Insert: {
          codigo_generacion?: string
          created_at?: string
          email_enviado_at?: string | null
          estado?: Database["public"]["Enums"]["dte_estado"]
          fecha_emision: string
          hora_emision: string
          id?: string
          intentos?: number
          json_dte?: Json | null
          json_respuesta?: Json | null
          numero_control: string
          order_id?: string | null
          receptor_correo?: string | null
          receptor_nit?: string | null
          receptor_nombre?: string | null
          receptor_nrc?: string | null
          sello_recibido?: string | null
          tipo_dte?: string
          total_exento?: number
          total_gravado?: number
          total_iva?: number
          total_pagar?: number
          ultimo_error?: string | null
          updated_at?: string
        }
        Update: {
          codigo_generacion?: string
          created_at?: string
          email_enviado_at?: string | null
          estado?: Database["public"]["Enums"]["dte_estado"]
          fecha_emision?: string
          hora_emision?: string
          id?: string
          intentos?: number
          json_dte?: Json | null
          json_respuesta?: Json | null
          numero_control?: string
          order_id?: string | null
          receptor_correo?: string | null
          receptor_nit?: string | null
          receptor_nombre?: string | null
          receptor_nrc?: string | null
          sello_recibido?: string | null
          tipo_dte?: string
          total_exento?: number
          total_gravado?: number
          total_iva?: number
          total_pagar?: number
          ultimo_error?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dte_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_settings: {
        Row: {
          ambiente: string
          cod_actividad: string
          cod_estable: string | null
          cod_estable_mh: string | null
          cod_punto_venta: string | null
          cod_punto_venta_mh: string | null
          complemento: string
          correo: string
          departamento: string
          desc_actividad: string
          id: boolean
          municipio: string
          nit: string
          nombre: string
          nombre_comercial: string | null
          nrc: string
          num_resolucion: string | null
          serie_documento: string | null
          telefono: string | null
          tipo_establecimiento: string
          updated_at: string
        }
        Insert: {
          ambiente?: string
          cod_actividad: string
          cod_estable?: string | null
          cod_estable_mh?: string | null
          cod_punto_venta?: string | null
          cod_punto_venta_mh?: string | null
          complemento: string
          correo: string
          departamento: string
          desc_actividad: string
          id?: boolean
          municipio: string
          nit: string
          nombre: string
          nombre_comercial?: string | null
          nrc: string
          num_resolucion?: string | null
          serie_documento?: string | null
          telefono?: string | null
          tipo_establecimiento?: string
          updated_at?: string
        }
        Update: {
          ambiente?: string
          cod_actividad?: string
          cod_estable?: string | null
          cod_estable_mh?: string | null
          cod_punto_venta?: string | null
          cod_punto_venta_mh?: string | null
          complemento?: string
          correo?: string
          departamento?: string
          desc_actividad?: string
          id?: boolean
          municipio?: string
          nit?: string
          nombre?: string
          nombre_comercial?: string | null
          nrc?: string
          num_resolucion?: string | null
          serie_documento?: string | null
          telefono?: string | null
          tipo_establecimiento?: string
          updated_at?: string
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
          {
            foreignKeyName: "inventory_levels_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
        Relationships: [
          {
            foreignKeyName: "order_counters_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "order_status_events_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          cancellation_reason: string | null
          cashier_id: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_nit: string | null
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
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_url: string | null
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cashier_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_nit?: string | null
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
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_url?: string | null
          source: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cashier_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_nit?: string | null
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
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_url?: string | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "production_batch_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "production_batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_batches: {
        Row: {
          created_at: string
          codigo_generacion: string | null
          created_by: string | null
          document_number: string | null
          document_type: Database["public"]["Enums"]["accounting_doc_type"]
          precio_con_iva: boolean
          supplier_nit: string | null
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
          codigo_generacion?: string | null
          created_by?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["accounting_doc_type"]
          precio_con_iva?: boolean
          supplier_nit?: string | null
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
          codigo_generacion?: string | null
          created_by?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["accounting_doc_type"]
          precio_con_iva?: boolean
          supplier_nit?: string | null
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
        Relationships: [
          {
            foreignKeyName: "purchase_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "transfer_items_production_batch_id_fkey"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
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
        Relationships: [
          {
            foreignKeyName: "transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          customer_name: string | null
          ghl_contact_id: string | null
          human_until: string | null
          id: string
          last_direction: string | null
          last_message_at: string
          last_message_preview: string | null
          message_count: number
          phone: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          ghl_contact_id?: string | null
          human_until?: string | null
          id?: string
          last_direction?: string | null
          last_message_at?: string
          last_message_preview?: string | null
          message_count?: number
          phone: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          ghl_contact_id?: string | null
          human_until?: string | null
          id?: string
          last_direction?: string | null
          last_message_at?: string
          last_message_preview?: string | null
          message_count?: number
          phone?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          sent_by: string | null
          wa_message_id: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          sent_by?: string | null
          wa_message_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          sent_by?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      accounting_iva_monthly: {
        Row: {
          iva_credito: number | null
          iva_debito: number | null
          iva_neto: number | null
          total_purchases_base: number | null
          total_sales_base: number | null
          year_month: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accounting_ledger: {
        Args: { p_end: string; p_start: string }
        Returns: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["accounting_account_type"]
          closing_balance: number
          opening_balance: number
          period_credits: number
          period_debits: number
        }[]
      }
      accounting_set_period: {
        Args: {
          p_month: string
          p_notes?: string
          p_status: Database["public"]["Enums"]["accounting_period_status"]
        }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["accounting_period_status"]
          year_month: string
        }
        SetofOptions: {
          from: "*"
          to: "accounting_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accounting_sync_from_pos: { Args: { p_since?: string }; Returns: number }
      adjust_inventory: {
        Args: {
          p_item: string
          p_location: string
          p_new_quantity: number
          p_notes: string
        }
        Returns: undefined
      }
      cancel_order: {
        Args: { p_order: string; p_reason: string }
        Returns: {
          cancellation_reason: string | null
          cashier_id: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_nit: string | null
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
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_url: string | null
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_cash_session: {
        Args: { p_counted: number; p_notes?: string; p_session: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "cash_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_production_batch: {
        Args: {
          p_batch: string
          p_inputs?: Json
          p_quantity_produced: number
          p_quantity_wasted?: number
          p_raw_consumed?: number
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "production_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_transfer: {
        Args: { p_from: string; p_items: Json; p_notes?: string; p_to: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_order_refunded: {
        Args: { p_order: string }
        Returns: {
          cancellation_reason: string | null
          cashier_id: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_nit: string | null
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
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_url: string | null
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      receive_transfer: {
        Args: { p_transfer: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      siguiente_numero_control: { Args: { p_tipo: string }; Returns: string }
    }
    Enums: {
      accounting_account_type:
        | "activo"
        | "pasivo"
        | "capital"
        | "ingreso"
        | "gasto"
      accounting_doc_type:
        | "ccf"
        | "dte"
        | "factura"
        | "recibo"
        | "ticket"
        | "ninguno"
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
      accounting_period_status: "abierto" | "revisado" | "cerrado"
      batch_status: "open" | "closed"
      cash_session_status: "open" | "closed"
      dte_estado:
        | "pendiente"
        | "firmado"
        | "procesado"
        | "rechazado"
        | "contingencia"
        | "anulado"
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
      user_role:
        | "superadmin"
        | "admin"
        | "cajero"
        | "cocina"
        | "repartidor"
        | "contador"
        | "auditor"
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
      accounting_account_type: [
        "activo",
        "pasivo",
        "capital",
        "ingreso",
        "gasto",
      ],
      accounting_doc_type: [
        "ccf",
        "dte",
        "factura",
        "recibo",
        "ticket",
        "ninguno",
      ],
      accounting_expense_type: [
        "ingredientes",
        "gas",
        "luz",
        "agua",
        "mod",
        "alquiler",
        "empaques",
        "servicios",
        "otros",
      ],
      accounting_period_status: ["abierto", "revisado", "cerrado"],
      batch_status: ["open", "closed"],
      cash_session_status: ["open", "closed"],
      dte_estado: [
        "pendiente",
        "firmado",
        "procesado",
        "rechazado",
        "contingencia",
        "anulado",
      ],
      inventory_reason: [
        "sale",
        "cancellation",
        "production",
        "purchase",
        "transfer_out",
        "transfer_in",
        "adjustment",
        "waste",
        "initial",
      ],
      order_source: ["pos", "online", "whatsapp"],
      order_status: [
        "received",
        "in_progress",
        "ready",
        "out_for_delivery",
        "completed",
        "cancelled",
      ],
      order_type: ["walk_in", "pickup", "delivery"],
      payment_method: ["cash", "payment_link"],
      payment_status: ["pending", "paid", "refunded"],
      product_type: ["combo", "chicken", "extra", "beverage"],
      purchase_unit: ["unidades", "libras"],
      transfer_status: ["in_transit", "received", "cancelled"],
      user_role: [
        "superadmin",
        "admin",
        "cajero",
        "cocina",
        "repartidor",
        "contador",
        "auditor",
      ],
    },
  },
} as const

// Alias de dominio — escritos a mano, el generador no los produce.
// Si regenerás el archivo, volvé a pegar este bloque.
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
export type AccountingSupplier = Tables<"accounting_suppliers">
export type FiscalSettings = Tables<"fiscal_settings">
export type DteDocument = Tables<"dte_documents">
export type DteEstado = Enums<"dte_estado">
export type WhatsappConversation = Tables<"whatsapp_conversations">
export type WhatsappMessage = Tables<"whatsapp_messages">
