export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "activity_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country_code: string
          created_at: string | null
          full_name: string
          id: string
          phone: string | null
          postal_code: string
          prefecture: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country_code?: string
          created_at?: string | null
          full_name: string
          id?: string
          phone?: string | null
          postal_code: string
          prefecture: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country_code?: string
          created_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          postal_code?: string
          prefecture?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_ingestions: {
        Row: {
          asset_id: string | null
          content_hash: string
          created_at: string | null
          id: string
          owner_user_id: string | null
          policy: Database["public"]["Enums"]["ingestion_policy"]
          provider: Database["public"]["Enums"]["asset_provider"]
          source_url: string
          status: Database["public"]["Enums"]["ingestion_status"]
        }
        Insert: {
          asset_id?: string | null
          content_hash: string
          created_at?: string | null
          id?: string
          owner_user_id?: string | null
          policy?: Database["public"]["Enums"]["ingestion_policy"]
          provider: Database["public"]["Enums"]["asset_provider"]
          source_url: string
          status?: Database["public"]["Enums"]["ingestion_status"]
        }
        Update: {
          asset_id?: string | null
          content_hash?: string
          created_at?: string | null
          id?: string
          owner_user_id?: string | null
          policy?: Database["public"]["Enums"]["ingestion_policy"]
          provider?: Database["public"]["Enums"]["asset_provider"]
          source_url?: string
          status?: Database["public"]["Enums"]["ingestion_status"]
        }
        Relationships: [
          {
            foreignKeyName: "asset_ingestions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_ingestions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_ingestions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          content_hash: string
          created_at: string | null
          height: number | null
          id: string
          mime_type: string | null
          owner_user_id: string | null
          provider: Database["public"]["Enums"]["asset_provider"]
          source_url: string | null
          storage_url: string | null
          width: number | null
        }
        Insert: {
          content_hash: string
          created_at?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          owner_user_id?: string | null
          provider?: Database["public"]["Enums"]["asset_provider"]
          source_url?: string | null
          storage_url?: string | null
          width?: number | null
        }
        Update: {
          content_hash?: string
          created_at?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          owner_user_id?: string | null
          provider?: Database["public"]["Enums"]["asset_provider"]
          source_url?: string | null
          storage_url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "assets_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string | null
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string | null
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string | null
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_invitations: {
        Row: {
          battle_id: string
          created_at: string | null
          from_user_id: string
          id: string
          status: string
          to_user_id: string
        }
        Insert: {
          battle_id: string
          created_at?: string | null
          from_user_id: string
          id?: string
          status: string
          to_user_id: string
        }
        Update: {
          battle_id?: string
          created_at?: string | null
          from_user_id?: string
          id?: string
          status?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_invitations_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_invitations_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "battle_invitations_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_invitations_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "battle_invitations_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_participants: {
        Row: {
          battle_id: string
          role: Database["public"]["Enums"]["participant_role"]
          user_id: string
        }
        Insert: {
          battle_id: string
          role: Database["public"]["Enums"]["participant_role"]
          user_id: string
        }
        Update: {
          battle_id?: string
          role?: Database["public"]["Enums"]["participant_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_participants_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "battle_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          created_at: string | null
          duration_minutes: number
          ended_at: string | null
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["battle_status"]
          winner_bonus_amount_jpy: number | null
          winner_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_minutes: number
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["battle_status"]
          winner_bonus_amount_jpy?: number | null
          winner_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["battle_status"]
          winner_bonus_amount_jpy?: number | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battles_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "battles_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          id: string
          product_variant_id: string
          quantity: number
        }
        Insert: {
          cart_id: string
          id?: string
          product_variant_id: string
          quantity: number
        }
        Update: {
          cart_id?: string
          id?: string
          product_variant_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "carts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cheer_tickets: {
        Row: {
          amount_jpy: number
          battle_id: string
          created_at: string | null
          creator_id: string
          exclusive_options: Json
          has_signed_goods_right: boolean
          id: string
          points: number
          supporter_id: string
        }
        Insert: {
          amount_jpy: number
          battle_id: string
          created_at?: string | null
          creator_id: string
          exclusive_options?: Json
          has_signed_goods_right?: boolean
          id?: string
          points: number
          supporter_id: string
        }
        Update: {
          amount_jpy?: number
          battle_id?: string
          created_at?: string | null
          creator_id?: string
          exclusive_options?: Json
          has_signed_goods_right?: boolean
          id?: string
          points?: number
          supporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheer_tickets_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheer_tickets_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cheer_tickets_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheer_tickets_supporter_id_fkey"
            columns: ["supporter_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cheer_tickets_supporter_id_fkey"
            columns: ["supporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_variant_assets: {
        Row: {
          asset_id: string
          license_terms: Json
          product_variant_id: string
        }
        Insert: {
          asset_id: string
          license_terms?: Json
          product_variant_id: string
        }
        Update: {
          asset_id?: string
          license_terms?: Json
          product_variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_variant_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_variant_assets_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      download_entitlements: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          max_downloads: number
          order_item_id: string
          product_variant_id: string
          state: Database["public"]["Enums"]["license_state"]
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          max_downloads?: number
          order_item_id: string
          product_variant_id: string
          state?: Database["public"]["Enums"]["license_state"]
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          max_downloads?: number
          order_item_id?: string
          product_variant_id?: string
          state?: Database["public"]["Enums"]["license_state"]
        }
        Relationships: [
          {
            foreignKeyName: "download_entitlements_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_entitlements_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      download_tokens: {
        Row: {
          created_at: string | null
          entitlement_id: string
          expires_at: string
          token: string
        }
        Insert: {
          created_at?: string | null
          entitlement_id: string
          expires_at: string
          token: string
        }
        Update: {
          created_at?: string | null
          entitlement_id?: string
          expires_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_tokens_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "download_entitlements"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
          work_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_events: {
        Row: {
          created_at: string | null
          fulfillment_id: string
          id: string
          message: string | null
          state: Database["public"]["Enums"]["fulfillment_state"]
        }
        Insert: {
          created_at?: string | null
          fulfillment_id: string
          id?: string
          message?: string | null
          state: Database["public"]["Enums"]["fulfillment_state"]
        }
        Update: {
          created_at?: string | null
          fulfillment_id?: string
          id?: string
          message?: string | null
          state?: Database["public"]["Enums"]["fulfillment_state"]
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_events_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillments: {
        Row: {
          cost_jpy: number | null
          created_at: string | null
          external_ref: string | null
          id: string
          order_item_id: string
          partner_id: string
          state: Database["public"]["Enums"]["fulfillment_state"]
          updated_at: string | null
        }
        Insert: {
          cost_jpy?: number | null
          created_at?: string | null
          external_ref?: string | null
          id?: string
          order_item_id: string
          partner_id: string
          state?: Database["public"]["Enums"]["fulfillment_state"]
          updated_at?: string | null
        }
        Update: {
          cost_jpy?: number | null
          created_at?: string | null
          external_ref?: string | null
          id?: string
          order_item_id?: string
          partner_id?: string
          state?: Database["public"]["Enums"]["fulfillment_state"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fulfillments_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          key: string
          request_hash: string
          response: Json | null
          scope: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key: string
          request_hash: string
          response?: Json | null
          scope: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key?: string
          request_hash?: string
          response?: Json | null
          scope?: string
        }
        Relationships: []
      }
      jp_prefectures: {
        Row: {
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
        }
        Relationships: []
      }
      live_offer_reservations: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          offer_id: string
          quantity: number
          state: Database["public"]["Enums"]["reservation_state"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          offer_id: string
          quantity: number
          state?: Database["public"]["Enums"]["reservation_state"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          offer_id?: string
          quantity?: number
          state?: Database["public"]["Enums"]["reservation_state"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_offer_reservations_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "live_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_offer_reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "live_offer_reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      live_offers: {
        Row: {
          created_at: string | null
          end_at: string | null
          id: string
          product_variant_id: string
          reserved_qty: number
          start_at: string | null
          status: Database["public"]["Enums"]["offer_status"]
          stock_qty: number
        }
        Insert: {
          created_at?: string | null
          end_at?: string | null
          id?: string
          product_variant_id: string
          reserved_qty?: number
          start_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          stock_qty: number
        }
        Update: {
          created_at?: string | null
          end_at?: string | null
          id?: string
          product_variant_id?: string
          reserved_qty?: number
          start_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          stock_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_offers_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturing_partners: {
        Row: {
          address: Json | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          metadata: Json
          name: string
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      order_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country_code: string
          full_name: string
          id: string
          kind: string
          order_id: string
          phone: string | null
          postal_code: string
          prefecture: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country_code?: string
          full_name: string
          id?: string
          kind: string
          order_id: string
          phone?: string | null
          postal_code: string
          prefecture: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country_code?: string
          full_name?: string
          id?: string
          kind?: string
          order_id?: string
          phone?: string | null
          postal_code?: string
          prefecture?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_addresses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          creator_earnings_jpy: number
          creator_id: string
          id: string
          is_digital: boolean
          manufacturing_partner_id: string | null
          order_id: string
          platform_fee_amount_jpy: number
          platform_fee_rate_bps: number
          product_variant_id: string
          quantity: number
          subtotal_excl_tax_jpy: number
          subtotal_tax_jpy: number
          tax_amount_jpy: number
          tax_rate_bps: number
          unit_price_jpy: number
        }
        Insert: {
          creator_earnings_jpy?: number
          creator_id: string
          id?: string
          is_digital?: boolean
          manufacturing_partner_id?: string | null
          order_id: string
          platform_fee_amount_jpy?: number
          platform_fee_rate_bps?: number
          product_variant_id: string
          quantity: number
          subtotal_excl_tax_jpy: number
          subtotal_tax_jpy: number
          tax_amount_jpy: number
          tax_rate_bps: number
          unit_price_jpy: number
        }
        Update: {
          creator_earnings_jpy?: number
          creator_id?: string
          id?: string
          is_digital?: boolean
          manufacturing_partner_id?: string | null
          order_id?: string
          platform_fee_amount_jpy?: number
          platform_fee_rate_bps?: number
          product_variant_id?: string
          quantity?: number
          subtotal_excl_tax_jpy?: number
          subtotal_tax_jpy?: number
          tax_amount_jpy?: number
          tax_rate_bps?: number
          unit_price_jpy?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "order_items_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_manufacturing_partner_id_fkey"
            columns: ["manufacturing_partner_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          discount_total_jpy: number
          id: string
          notes: string | null
          payment_state: Database["public"]["Enums"]["payment_state"]
          platform_fee_total_jpy: number
          shipment_state: Database["public"]["Enums"]["shipment_state"] | null
          shipping_total_jpy: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_excl_tax_jpy: number
          tax_total_jpy: number
          total_payable_jpy: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          discount_total_jpy?: number
          id?: string
          notes?: string | null
          payment_state?: Database["public"]["Enums"]["payment_state"]
          platform_fee_total_jpy?: number
          shipment_state?: Database["public"]["Enums"]["shipment_state"] | null
          shipping_total_jpy?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_excl_tax_jpy?: number
          tax_total_jpy?: number
          total_payable_jpy?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          discount_total_jpy?: number
          id?: string
          notes?: string | null
          payment_state?: Database["public"]["Enums"]["payment_state"]
          platform_fee_total_jpy?: number
          shipment_state?: Database["public"]["Enums"]["shipment_state"] | null
          shipping_total_jpy?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_excl_tax_jpy?: number
          tax_total_jpy?: number
          total_payable_jpy?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_profiles: {
        Row: {
          created_at: string | null
          metadata: Json
          organization_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          metadata?: Json
          organization_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          metadata?: Json
          organization_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organizer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_notifications: {
        Row: {
          created_at: string | null
          dedupe_key: string | null
          id: string
          partner_id: string
          payload: Json
          type: string
          unread: boolean
        }
        Insert: {
          created_at?: string | null
          dedupe_key?: string | null
          id?: string
          partner_id: string
          payload: Json
          type: string
          unread?: boolean
        }
        Update: {
          created_at?: string | null
          dedupe_key?: string | null
          id?: string
          partner_id?: string
          payload?: Json
          type?: string
          unread?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "partner_notifications_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_product_mockups: {
        Row: {
          asset_id: string
          created_at: string | null
          id: string
          partner_product_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          id?: string
          partner_product_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          id?: string
          partner_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_product_mockups_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_product_mockups_partner_product_id_fkey"
            columns: ["partner_product_id"]
            isOneToOne: false
            referencedRelation: "partner_products"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_products: {
        Row: {
          base_cost_jpy: number
          created_at: string | null
          id: string
          lead_time_days: number | null
          name: string
          partner_id: string
          specs: Json
        }
        Insert: {
          base_cost_jpy: number
          created_at?: string | null
          id?: string
          lead_time_days?: number | null
          name: string
          partner_id: string
          specs?: Json
        }
        Update: {
          base_cost_jpy?: number
          created_at?: string | null
          id?: string
          lead_time_days?: number | null
          name?: string
          partner_id?: string
          specs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "partner_products_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_users: {
        Row: {
          partner_id: string
          role: string
          user_id: string
        }
        Insert: {
          partner_id: string
          role?: string
          user_id: string
        }
        Update: {
          partner_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_users_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "partner_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_failures: {
        Row: {
          created_at: string | null
          id: string
          payload: Json | null
          payment_id: string | null
          payment_intent_id: string | null
          reason: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          payment_id?: string | null
          payment_intent_id?: string | null
          reason?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          payment_id?: string | null
          payment_intent_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_failures_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_jpy: number
          authorized_at: string | null
          captured_at: string | null
          created_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          order_id: string
          provider: string
          state: Database["public"]["Enums"]["payment_state"]
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_jpy: number
          authorized_at?: string | null
          captured_at?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          order_id: string
          provider?: string
          state: Database["public"]["Enums"]["payment_state"]
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_jpy?: number
          authorized_at?: string | null
          captured_at?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          order_id?: string
          provider?: string
          state?: Database["public"]["Enums"]["payment_state"]
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          created_at: string | null
          ends_at: string | null
          id: string
          price_jpy: number
          product_variant_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string | null
          ends_at?: string | null
          id?: string
          price_jpy: number
          product_variant_id: string
          starts_at: string
        }
        Update: {
          created_at?: string | null
          ends_at?: string | null
          id?: string
          price_jpy?: number
          product_variant_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string | null
          id: string
          inventory_qty: number | null
          is_active: boolean
          kind: Database["public"]["Enums"]["product_type"]
          manufacturing_partner_id: string | null
          options: Json
          price_jpy: number
          product_id: string
          sku: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_qty?: number | null
          is_active?: boolean
          kind: Database["public"]["Enums"]["product_type"]
          manufacturing_partner_id?: string | null
          options?: Json
          price_jpy: number
          product_id: string
          sku?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_qty?: number | null
          is_active?: boolean
          kind?: Database["public"]["Enums"]["product_type"]
          manufacturing_partner_id?: string | null
          options?: Json
          price_jpy?: number
          product_id?: string
          sku?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_manufacturing_partner_id_fkey"
            columns: ["manufacturing_partner_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string | null
          creator_id: string
          description: string | null
          id: string
          platform_fee_rate_bps: number
          product_type: Database["public"]["Enums"]["product_type"]
          status: Database["public"]["Enums"]["product_status"]
          title: string
          updated_at: string | null
          work_id: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          description?: string | null
          id?: string
          platform_fee_rate_bps?: number
          product_type: Database["public"]["Enums"]["product_type"]
          status?: Database["public"]["Enums"]["product_status"]
          title: string
          updated_at?: string | null
          work_id?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          description?: string | null
          id?: string
          platform_fee_rate_bps?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          status?: Database["public"]["Enums"]["product_status"]
          title?: string
          updated_at?: string | null
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "products_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_logs: {
        Row: {
          endpoint: string
          id: string
          key: string
          occurred_at: string
          status: number
          user_id: string | null
        }
        Insert: {
          endpoint: string
          id?: string
          key: string
          occurred_at?: string
          status: number
          user_id?: string | null
        }
        Update: {
          endpoint?: string
          id?: string
          key?: string
          occurred_at?: string
          status?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "rate_limit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_jpy: number
          created_at: string | null
          id: string
          payment_id: string
          processed_at: string | null
          reason: string | null
          state: string
          stripe_refund_id: string | null
        }
        Insert: {
          amount_jpy: number
          created_at?: string | null
          id?: string
          payment_id: string
          processed_at?: string | null
          reason?: string | null
          state: string
          stripe_refund_id?: string | null
        }
        Update: {
          amount_jpy?: number
          created_at?: string | null
          id?: string
          payment_id?: string
          processed_at?: string | null
          reason?: string | null
          state?: string
          stripe_refund_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          executed_at: string | null
          version: string
        }
        Insert: {
          executed_at?: string | null
          version: string
        }
        Update: {
          executed_at?: string | null
          version?: string
        }
        Relationships: []
      }
      shipment_items: {
        Row: {
          id: string
          order_item_id: string
          quantity: number
          shipment_id: string
        }
        Insert: {
          id?: string
          order_item_id: string
          quantity: number
          shipment_id: string
        }
        Update: {
          id?: string
          order_item_id?: string
          quantity?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier_name: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          manufacturing_partner_id: string | null
          order_id: string
          shipped_at: string | null
          shipping_fee_jpy: number
          state: Database["public"]["Enums"]["shipment_state"]
          tracking_number: string | null
        }
        Insert: {
          carrier_name?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          manufacturing_partner_id?: string | null
          order_id: string
          shipped_at?: string | null
          shipping_fee_jpy?: number
          state: Database["public"]["Enums"]["shipment_state"]
          tracking_number?: string | null
        }
        Update: {
          carrier_name?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          manufacturing_partner_id?: string | null
          order_id?: string
          shipped_at?: string | null
          shipping_fee_jpy?: number
          state?: Database["public"]["Enums"]["shipment_state"]
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_manufacturing_partner_id_fkey"
            columns: ["manufacturing_partner_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          id: string
          manufacturing_partner_id: string
          rate_jpy: number
          zone_id: string
        }
        Insert: {
          id?: string
          manufacturing_partner_id: string
          rate_jpy: number
          zone_id: string
        }
        Update: {
          id?: string
          manufacturing_partner_id?: string
          rate_jpy?: number
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_manufacturing_partner_id_fkey"
            columns: ["manufacturing_partner_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zone_members: {
        Row: {
          prefecture_code: string
          zone_id: string
        }
        Insert: {
          prefecture_code: string
          zone_id: string
        }
        Update: {
          prefecture_code?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zone_members_prefecture_code_fkey"
            columns: ["prefecture_code"]
            isOneToOne: false
            referencedRelation: "jp_prefectures"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "shipping_zone_members_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          event_type: string
          id: string
          payload: Json
          received_at: string
        }
        Insert: {
          event_type: string
          id: string
          payload: Json
          received_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json
          received_at?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      upload_attempts: {
        Row: {
          created_at: string | null
          id: string
          outcome: string | null
          target: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          outcome?: string | null
          target?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          outcome?: string | null
          target?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "upload_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          created_at: string | null
          id: string
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string
          public_flags: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name: string
          public_flags?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          public_flags?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          role: string
          user_id: string
        }
        Update: {
          granted_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string | null
          notification_settings: Json
          privacy_settings: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          notification_settings?: Json
          privacy_settings?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          notification_settings?: Json
          privacy_settings?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          is_verified: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          is_verified?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_verified?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      work_assets: {
        Row: {
          asset_id: string
          position: number
          purpose: string | null
          work_id: string
        }
        Insert: {
          asset_id: string
          position?: number
          purpose?: string | null
          work_id: string
        }
        Update: {
          asset_id?: string
          position?: number
          purpose?: string | null
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_assets_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_tags: {
        Row: {
          tag_id: string
          work_id: string
        }
        Insert: {
          tag_id: string
          work_id: string
        }
        Update: {
          tag_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tags_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          category_id: string | null
          created_at: string | null
          creator_id: string
          description: string | null
          id: string
          is_active: boolean
          primary_asset_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          primary_asset_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          primary_asset_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "works_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "works_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "works_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "works_primary_asset_id_fkey"
            columns: ["primary_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      battle_eligibility_mv: {
        Row: {
          is_eligible: boolean | null
          last_month_sales_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
      battle_points: {
        Row: {
          battle_id: string | null
          creator_id: string | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cheer_tickets_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheer_tickets_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "battle_eligibility_mv"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cheer_tickets_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_creator_earnings: {
        Args: { amount_excl_tax_jpy: number; platform_fee_rate_bps?: number }
        Returns: number
      }
      calculate_order_totals: {
        Args: { p_order_id: string }
        Returns: {
          platform_fee_total_jpy: number
          shipping_total_jpy: number
          subtotal_excl_tax_jpy: number
          tax_total_jpy: number
          total_payable_jpy: number
        }[]
      }
      calculate_platform_fee: {
        Args: { amount_excl_tax_jpy: number; fee_rate_bps?: number }
        Returns: number
      }
      calculate_tax: {
        Args: { amount_excl_tax_jpy: number; tax_rate_bps?: number }
        Returns: number
      }
      cleanup_expired_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      determine_battle_winner: {
        Args: { p_battle_id: string }
        Returns: string
      }
      get_config: {
        Args: { config_key: string }
        Returns: Json
      }
      get_config_int: {
        Args: { config_key: string }
        Returns: number
      }
      get_shipping_fee: {
        Args: { p_manufacturing_partner_id: string; p_prefecture: string }
        Returns: number
      }
      jpy_to_points: {
        Args: { amount_jpy: number }
        Returns: number
      }
      points_to_jpy: {
        Args: { points: number }
        Returns: number
      }
      release_expired_reservations: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      reserve_inventory: {
        Args: { p_quantity: number; p_variant_id: string }
        Returns: boolean
      }
      reserve_live_offer: {
        Args: { p_offer_id: string; p_quantity?: number; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      asset_provider:
        | "upload"
        | "url"
        | "instagram"
        | "twitter"
        | "pinterest"
        | "other"
      battle_status: "scheduled" | "live" | "finished" | "cancelled"
      fulfillment_state:
        | "pending"
        | "accepted"
        | "in_production"
        | "ready_to_ship"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "failed"
      ingestion_policy: "allow" | "deny" | "manual"
      ingestion_status: "pending" | "approved" | "rejected" | "blocked"
      license_state: "active" | "expired" | "revoked"
      offer_status: "scheduled" | "live" | "ended" | "cancelled"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      participant_role: "challenger" | "opponent"
      payment_state:
        | "requires_payment"
        | "authorized"
        | "captured"
        | "failed"
        | "refunded"
        | "cancelled"
      product_status: "draft" | "pending" | "published" | "disabled"
      product_type: "print" | "merch" | "digital" | "other"
      reservation_state: "active" | "expired" | "converted" | "cancelled"
      shipment_state:
        | "pending"
        | "packed"
        | "shipped"
        | "delivered"
        | "returned"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      asset_provider: [
        "upload",
        "url",
        "instagram",
        "twitter",
        "pinterest",
        "other",
      ],
      battle_status: ["scheduled", "live", "finished", "cancelled"],
      fulfillment_state: [
        "pending",
        "accepted",
        "in_production",
        "ready_to_ship",
        "shipped",
        "delivered",
        "cancelled",
        "failed",
      ],
      ingestion_policy: ["allow", "deny", "manual"],
      ingestion_status: ["pending", "approved", "rejected", "blocked"],
      license_state: ["active", "expired", "revoked"],
      offer_status: ["scheduled", "live", "ended", "cancelled"],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      participant_role: ["challenger", "opponent"],
      payment_state: [
        "requires_payment",
        "authorized",
        "captured",
        "failed",
        "refunded",
        "cancelled",
      ],
      product_status: ["draft", "pending", "published", "disabled"],
      product_type: ["print", "merch", "digital", "other"],
      reservation_state: ["active", "expired", "converted", "cancelled"],
      shipment_state: [
        "pending",
        "packed",
        "shipped",
        "delivered",
        "returned",
        "cancelled",
      ],
    },
  },
} as const

