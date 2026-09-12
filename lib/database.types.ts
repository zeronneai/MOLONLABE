// Typed schema for supabase-js, matching the shape `supabase gen types
// typescript` emits. Regenerate against a linked project with:
//   supabase gen types typescript --linked > lib/database.types.ts
// and keep the convenience aliases at the bottom.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      items: {
        Row: {
          id: string;
          slug: string;
          name: string;
          category: string;
          brand: string | null;
          short_desc: string | null;
          long_desc: string | null;
          specs: Json;
          price_display: string | null;
          price_cents: number | null;
          fulfillment_type: string;
          shipping_tier: string;
          shipping_override_cents: number | null;
          has_variants: boolean;
          status: string;
          created_by: string | null;
          created_by_name: string | null;
          updated_by: string | null;
          updated_by_name: string | null;
          is_featured: boolean | null;
          sort_order: number | null;
          images: Json;
          video_url: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          category: string;
          brand?: string | null;
          short_desc?: string | null;
          long_desc?: string | null;
          specs?: Json;
          price_display?: string | null;
          price_cents?: number | null;
          fulfillment_type?: string;
          shipping_tier?: string;
          shipping_override_cents?: number | null;
          has_variants?: boolean;
          status?: string;
          created_by_name?: string | null;
          updated_by_name?: string | null;
          is_featured?: boolean | null;
          sort_order?: number | null;
          images?: Json;
          video_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          category?: string;
          brand?: string | null;
          short_desc?: string | null;
          long_desc?: string | null;
          specs?: Json;
          price_display?: string | null;
          price_cents?: number | null;
          fulfillment_type?: string;
          shipping_tier?: string;
          shipping_override_cents?: number | null;
          has_variants?: boolean;
          status?: string;
          created_by_name?: string | null;
          updated_by_name?: string | null;
          is_featured?: boolean | null;
          sort_order?: number | null;
          images?: Json;
          video_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          title: string;
          item_id: string | null;
          description: string | null;
          status: string;
          winner_note: string | null;
          total_spots: number;
          spot_price_cents: number;
          created_by: string | null;
          created_by_name: string | null;
          updated_by: string | null;
          updated_by_name: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          item_id?: string | null;
          description?: string | null;
          status?: string;
          winner_note?: string | null;
          total_spots: number;
          spot_price_cents: number;
          created_by_name?: string | null;
          updated_by_name?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          item_id?: string | null;
          description?: string | null;
          status?: string;
          winner_note?: string | null;
          total_spots?: number;
          spot_price_cents?: number;
          created_by_name?: string | null;
          updated_by_name?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      game_spots: {
        Row: {
          id: string;
          game_id: string;
          spot_number: number;
          status: string;
          order_id: string | null;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          show_name: boolean;
          held_at: string | null;
          sold_at: string | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          spot_number: number;
          status?: string;
          order_id?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          show_name?: boolean;
          held_at?: string | null;
          sold_at?: string | null;
        };
        Update: {
          status?: string;
          order_id?: string | null;
          show_name?: boolean;
        };
        Relationships: [];
      };
      item_variants: {
        Row: {
          id: string;
          item_id: string;
          size: string;
          stock: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          size: string;
          stock?: number;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          size?: string;
          stock?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "item_variants_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      winners: {
        Row: {
          id: string;
          game_id: string;
          spot_id: string | null;
          display_name: string;
          photo_url: string | null;
          note: string | null;
          drawn_at: string;
          seed: string | null;
          ticket: number | null;
          entry_total: number | null;
          pool: Json | null;
          ticket_index: number | null;
          drawn_early: boolean;
          unsold_spots: number | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          spot_id?: string | null;
          display_name: string;
          photo_url?: string | null;
          note?: string | null;
          drawn_at?: string;
          seed?: string | null;
          ticket?: number | null;
          entry_total?: number | null;
          pool?: Json | null;
          ticket_index?: number | null;
          drawn_early?: boolean;
          unsold_spots?: number | null;
        };
        Update: {
          id?: string;
          game_id?: string;
          spot_id?: string | null;
          display_name?: string;
          photo_url?: string | null;
          note?: string | null;
          drawn_at?: string;
          seed?: string | null;
          ticket?: number | null;
          entry_total?: number | null;
          pool?: Json | null;
          ticket_index?: number | null;
          drawn_early?: boolean;
          unsold_spots?: number | null;
        };
        Relationships: [];
      };
      inquiries: {
        Row: {
          id: string;
          type: string;
          item_id: string | null;
          name: string;
          email: string;
          phone: string | null;
          message: string | null;
          status: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          type: string;
          item_id?: string | null;
          name: string;
          email: string;
          phone?: string | null;
          message?: string | null;
          status?: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          type?: string;
          item_id?: string | null;
          name?: string;
          email?: string;
          phone?: string | null;
          message?: string | null;
          status?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inquiries_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          status: string;
          email: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          subtotal_cents: number;
          tax_cents: number;
          shipping_cents: number;
          total_cents: number;
          has_shipment: boolean;
          has_pickup: boolean;
          ship_name: string | null;
          ship_line1: string | null;
          ship_line2: string | null;
          ship_city: string | null;
          ship_region: string | null;
          ship_postal_code: string | null;
          disclaimer_accepted_at: string;
          disclaimer_text: string;
          disclaimer_version: string | null;
          refund_policy_text: string;
          game_id: string | null;
          gateway: string;
          gateway_transaction_id: string | null;
          gateway_auth_code: string | null;
          gateway_response_code: string | null;
          card_brand: string | null;
          card_last4: string | null;
          confirmation_token: string;
          confirmation_expires_at: string;
          idempotency_key: string | null;
          game_terms_accepted_at: string | null;
          game_terms_text: string | null;
          confirmation_sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          status?: string;
          email: string;
          first_name: string;
          last_name: string;
          phone?: string | null;
          subtotal_cents: number;
          tax_cents?: number;
          shipping_cents?: number;
          total_cents: number;
          has_shipment?: boolean;
          has_pickup?: boolean;
          ship_name?: string | null;
          ship_line1?: string | null;
          ship_line2?: string | null;
          ship_city?: string | null;
          ship_region?: string | null;
          ship_postal_code?: string | null;
          disclaimer_accepted_at: string;
          disclaimer_text: string;
          disclaimer_version: string | null;
          refund_policy_text: string;
          game_id?: string | null;
          gateway?: string;
          gateway_transaction_id?: string | null;
          gateway_auth_code?: string | null;
          gateway_response_code?: string | null;
          card_brand?: string | null;
          card_last4?: string | null;
          confirmation_token: string;
          /** Defaulted by the database to a year out. */
          confirmation_expires_at?: string;
          idempotency_key?: string | null;
          game_terms_accepted_at?: string | null;
          game_terms_text?: string | null;
          confirmation_sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: string;
          confirmation_sent_at?: string | null;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          line_type: string;
          item_id: string | null;
          pack_id: string | null;
          game_id: string | null;
          spot_numbers: number[] | null;
          name: string;
          unit_price_cents: number;
          quantity: number;
          fulfillment_type: string;
          line_total_cents: number;
          variant_id: string | null;
          size: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          line_type: string;
          item_id?: string | null;
          pack_id?: string | null;
          game_id?: string | null;
          spot_numbers?: number[] | null;
          name: string;
          unit_price_cents: number;
          quantity: number;
          fulfillment_type: string;
          line_total_cents: number;
          variant_id?: string | null;
          size?: string | null;
        };
        Update: {
          line_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_activity: {
        Row: {
          id: string;
          at: string;
          actor_id: string | null;
          actor_name: string;
          action: string;
          entity: string;
          entity_id: string | null;
          entity_label: string | null;
          field: string | null;
          before_value: Json | null;
          after_value: Json | null;
        };
        Insert: {
          id?: string;
          at?: string;
          actor_id?: string | null;
          actor_name: string;
          action: string;
          entity: string;
          entity_id?: string | null;
          entity_label?: string | null;
          field?: string | null;
          before_value?: Json | null;
          after_value?: Json | null;
        };
        Update: { id?: string };
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string | null;
          updated_by: string | null;
          updated_by_name: string | null;
        };
        Insert: {
          key: string;
          value?: Json;
          updated_at?: string | null;
          updated_by_name?: string | null;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_by_name?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      game_events: {
        Row: {
          id: string;
          kind: string;
          mode: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          kind: string;
          mode?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          kind?: string;
          mode?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      game_spot_board: {
        Row: {
          game_id: string;
          spot_number: number;
          status: string;
          /**
           * First name plus last initial, and only where the buyer opted
           * in. There is no email column on this view at all — that is
           * why the board reads it rather than the table.
           */
          display_name: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      claim_variant_stock: {
        Args: { p_variant: string; p_qty: number };
        Returns: boolean;
      };
      release_variant_stock: {
        Args: { p_variant: string; p_qty: number };
        Returns: undefined;
      };
      /** The spot numbers claimed, or null when the game cannot supply them. */
      claim_game_spots: {
        Args: { p_game: string; p_qty: number };
        Returns: number[] | null;
      };
      release_game_spots: {
        Args: { p_game: string; p_spots: number[] };
        Returns: undefined;
      };
      sell_game_spots: {
        Args: {
          p_game: string;
          p_spots: number[];
          p_order: string;
          p_first_name: string;
          p_last_name: string;
          p_email: string;
          p_phone: string | null;
          p_show_name: boolean;
        };
        Returns: undefined;
      };
      game_spots_remaining: {
        Args: { p_game: string };
        Returns: number;
      };
      /** 'claimed' | 'in_flight' | 'done:<order number>' */
      claim_checkout: {
        Args: { p_key: string };
        Returns: string;
      };
      finish_checkout: {
        Args: { p_key: string; p_order: string | null; p_outcome: string | null };
        Returns: undefined;
      };
      release_checkout: {
        Args: { p_key: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type ItemRow = Database["public"]["Tables"]["items"]["Row"];
export type GameRow = Database["public"]["Tables"]["games"]["Row"];
export type GameSpotRow = Database["public"]["Tables"]["game_spots"]["Row"];
export type WinnerRow = Database["public"]["Tables"]["winners"]["Row"];
export type InquiryInsert = Database["public"]["Tables"]["inquiries"]["Insert"];
export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["admin_activity"]["Row"];
export type ItemVariantRow = Database["public"]["Tables"]["item_variants"]["Row"];

export type ItemStatus = "available" | "reserved" | "sold";
export type ItemCategory =
  | "pistol"
  | "rifle"
  | "revolver"
  | "pcc"
  | "optic"
  | "accessory";
