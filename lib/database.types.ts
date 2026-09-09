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
          has_variants: boolean;
          status: string;
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
          has_variants?: boolean;
          status?: string;
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
          has_variants?: boolean;
          status?: string;
          is_featured?: boolean | null;
          sort_order?: number | null;
          images?: Json;
          video_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          title: string;
          item_id: string | null;
          description: string | null;
          opens_at: string | null;
          closes_at: string | null;
          status: string;
          winner_note: string | null;
          entries_per_dollar: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          item_id?: string | null;
          description?: string | null;
          opens_at?: string | null;
          closes_at?: string | null;
          status?: string;
          winner_note?: string | null;
          entries_per_dollar?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          item_id?: string | null;
          description?: string | null;
          opens_at?: string | null;
          closes_at?: string | null;
          status?: string;
          winner_note?: string | null;
          entries_per_dollar?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      entrants: {
        Row: {
          id: string;
          campaign_id: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          entry_count: number;
          entry_method: string;
          source: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          campaign_id?: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          entry_count?: number;
          entry_method?: string;
          source?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          campaign_id?: string | null;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          entry_count?: number;
          source?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "entrants_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
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
          campaign_id: string;
          entrant_id: string | null;
          display_name: string;
          photo_url: string | null;
          note: string | null;
          drawn_at: string;
          seed: string | null;
          ticket: number | null;
          entry_total: number | null;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          entrant_id?: string | null;
          display_name: string;
          photo_url?: string | null;
          note?: string | null;
          drawn_at?: string;
          seed?: string | null;
          ticket?: number | null;
          entry_total?: number | null;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          entrant_id?: string | null;
          display_name?: string;
          photo_url?: string | null;
          note?: string | null;
          drawn_at?: string;
          seed?: string | null;
          ticket?: number | null;
          entry_total?: number | null;
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
          campaign_id: string | null;
          entries_per_dollar: number | null;
          entries_awarded: number;
          gateway: string;
          gateway_transaction_id: string | null;
          gateway_auth_code: string | null;
          gateway_response_code: string | null;
          card_brand: string | null;
          card_last4: string | null;
          confirmation_token: string;
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
          campaign_id?: string | null;
          entries_per_dollar?: number | null;
          entries_awarded?: number;
          gateway?: string;
          gateway_transaction_id?: string | null;
          gateway_auth_code?: string | null;
          gateway_response_code?: string | null;
          card_brand?: string | null;
          card_last4?: string | null;
          confirmation_token: string;
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
      settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string | null;
        };
        Insert: {
          key: string;
          value?: Json;
          updated_at?: string | null;
        };
        Update: {
          key?: string;
          value?: Json;
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
    Views: Record<string, never>;
    Functions: {
      entry_count: {
        Args: { campaign: string };
        Returns: number;
      };
      entrant_count: {
        Args: { campaign: string };
        Returns: number;
      };
      claim_variant_stock: {
        Args: { p_variant: string; p_qty: number };
        Returns: boolean;
      };
      release_variant_stock: {
        Args: { p_variant: string; p_qty: number };
        Returns: undefined;
      };
      add_purchase_entries: {
        Args: {
          p_campaign: string;
          p_email: string;
          p_first_name: string;
          p_last_name: string;
          p_phone: string | null;
          p_entries: number;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type ItemRow = Database["public"]["Tables"]["items"]["Row"];
export type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
export type EntrantRow = Database["public"]["Tables"]["entrants"]["Row"];
export type EntrantInsert = Database["public"]["Tables"]["entrants"]["Insert"];
export type WinnerRow = Database["public"]["Tables"]["winners"]["Row"];
export type InquiryInsert = Database["public"]["Tables"]["inquiries"]["Insert"];
export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
export type ItemVariantRow = Database["public"]["Tables"]["item_variants"]["Row"];

export type ItemStatus = "available" | "reserved" | "sold";
export type ItemCategory =
  | "pistol"
  | "rifle"
  | "revolver"
  | "pcc"
  | "optic"
  | "accessory";
