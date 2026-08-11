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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type ItemRow = Database["public"]["Tables"]["items"]["Row"];
export type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
export type EntrantInsert = Database["public"]["Tables"]["entrants"]["Insert"];
export type InquiryInsert = Database["public"]["Tables"]["inquiries"]["Insert"];

export type ItemStatus = "available" | "reserved" | "sold";
export type ItemCategory =
  | "pistol"
  | "rifle"
  | "revolver"
  | "pcc"
  | "optic"
  | "accessory";
