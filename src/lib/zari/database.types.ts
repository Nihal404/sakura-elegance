// Types for the Zari Boutique Supabase project (ref: aqlqukvdgleialflldlq).
// Hand-maintained: this project's schema is owned outside Lovable, so it is NOT
// the auto-generated src/integrations/supabase/types.ts file.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type ProductCategory = "Clothing" | "Accessories";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          role: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          role?: string | null;
        };
        Update: {
          full_name?: string | null;
          phone?: string | null;
        };
        Relationships: [];
      };
      banners: {
        Row: {
          id: string;
          image: string;
          caption: string | null;
          sort_order: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          image: string;
          caption?: string | null;
          sort_order?: number;
          active?: boolean;
        };
        Update: {
          image?: string;
          caption?: string | null;
          sort_order?: number;
          active?: boolean;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          price: number;
          category: string;
          image_url: string | null;
          description: string | null;
          stock: number | null;
          features: string[] | null;
          mockups: string[] | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          price: number;
          category: string;
          image_url?: string | null;
          description?: string | null;
          stock?: number | null;
          features?: string[];
          mockups?: string[];
        };
        Update: {
          name?: string;
          price?: number;
          category?: string;
          image_url?: string | null;
          description?: string | null;
          stock?: number | null;
          features?: string[];
          mockups?: string[];
        };
        Relationships: [];
      };
      carts: {
        Row: { id: string; user_id: string; created_at: string; updated_at: string | null };
        Insert: { id?: string; user_id: string };
        Update: { user_id?: string };
        Relationships: [];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_id: string;
          quantity: number;
          created_at: string;
        };
        Insert: { id?: string; cart_id: string; product_id: string; quantity: number };
        Update: { quantity?: number };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          total: number;
          status: string | null;
          shipping_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total: number;
          status?: string | null;
          shipping_address?: string | null;
        };
        Update: { status?: string | null; shipping_address?: string | null };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
        };
        Update: { quantity?: number };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          product_id: string;
          user_id: string;
          rating: number;
          comment: string | null;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          user_id: string;
          rating: number;
          comment?: string | null;
          name?: string | null;
        };
        Update: { rating?: number; comment?: string | null };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      create_zari_order: { Args: { p_shipping_address?: string | null }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
