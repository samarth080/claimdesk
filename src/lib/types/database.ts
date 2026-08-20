export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: Table<
        {
          id: string;
          email: string;
          name: string;
          signup_date: string;
          lifetime_cashback: number;
          tier: Database["public"]["Enums"]["user_tier"];
        },
        {
          id?: string;
          email: string;
          name: string;
          signup_date: string;
          lifetime_cashback?: number;
          tier?: Database["public"]["Enums"]["user_tier"];
        }
      >;
      retailers: Table<
        {
          id: string;
          name: string;
          tracking_sla_hours: number;
          confirmation_window_days: number;
          excluded_categories: string[];
          allows_coupon_stacking: boolean;
          allows_cart_preloading: boolean;
          known_deeplink_issue: boolean;
          terms_url: string;
        },
        {
          id?: string;
          name: string;
          tracking_sla_hours: number;
          confirmation_window_days: number;
          excluded_categories?: string[];
          allows_coupon_stacking?: boolean;
          allows_cart_preloading?: boolean;
          known_deeplink_issue?: boolean;
          terms_url: string;
        }
      >;
      clicks: Table<
        {
          id: string;
          user_id: string;
          retailer_id: string;
          clicked_at: string;
          click_id: string;
          device: Database["public"]["Enums"]["device_type"];
          handoff_to_native_app: boolean;
          referrer_intact: boolean;
          cart_preloaded: boolean;
        },
        {
          id?: string;
          user_id: string;
          retailer_id: string;
          clicked_at: string;
          click_id: string;
          device: Database["public"]["Enums"]["device_type"];
          handoff_to_native_app?: boolean;
          referrer_intact?: boolean;
          cart_preloaded?: boolean;
        }
      >;
      orders: Table<
        {
          id: string;
          user_id: string;
          retailer_id: string;
          ordered_at: string;
          order_value: number;
          category: string;
          status: Database["public"]["Enums"]["order_status"];
          coupon_code_used: string | null;
          email_used: string;
        },
        {
          id?: string;
          user_id: string;
          retailer_id: string;
          ordered_at: string;
          order_value: number;
          category: string;
          status: Database["public"]["Enums"]["order_status"];
          coupon_code_used?: string | null;
          email_used: string;
        }
      >;
      cashback_records: Table<
        {
          id: string;
          click_id: string | null;
          order_id: string | null;
          status: Database["public"]["Enums"]["cashback_status"];
          amount: number;
          reported_at: string | null;
        },
        {
          id?: string;
          click_id?: string | null;
          order_id?: string | null;
          status: Database["public"]["Enums"]["cashback_status"];
          amount?: number;
          reported_at?: string | null;
        }
      >;
      claims: Table<
        {
          id: string;
          user_id: string;
          raw_text: string;
          submitted_at: string;
          claimed_order_value: number | null;
          claimed_retailer_id: string | null;
          claimed_order_date: string | null;
          status: Database["public"]["Enums"]["claim_status"];
          diagnosis_code: Database["public"]["Enums"]["diagnosis_code"] | null;
          confidence: number | null;
          resolution_text: string | null;
          clarifying_question: string | null;
          clarifying_answer: string | null;
          escalation_packet: Json | null;
          resolved_at: string | null;
        },
        {
          id?: string;
          user_id: string;
          raw_text: string;
          submitted_at?: string;
          claimed_order_value?: number | null;
          claimed_retailer_id?: string | null;
          claimed_order_date?: string | null;
          status?: Database["public"]["Enums"]["claim_status"];
          diagnosis_code?: Database["public"]["Enums"]["diagnosis_code"] | null;
          confidence?: number | null;
          resolution_text?: string | null;
          clarifying_question?: string | null;
          clarifying_answer?: string | null;
          escalation_packet?: Json | null;
          resolved_at?: string | null;
        }
      >;
      platform_coupons: Table<
        { code: string; retailer_id: string; active: boolean },
        { code: string; retailer_id: string; active?: boolean }
      >;
      goodwill_credits: Table<
        {
          id: string;
          user_id: string;
          claim_id: string | null;
          amount: number;
          awarded_at: string;
          reason_code: Database["public"]["Enums"]["diagnosis_code"];
        },
        {
          id?: string;
          user_id: string;
          claim_id?: string | null;
          amount: number;
          awarded_at?: string;
          reason_code: Database["public"]["Enums"]["diagnosis_code"];
        }
      >;
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      user_tier: "standard" | "gold";
      device_type: "android_app" | "ios_app" | "mweb" | "desktop";
      order_status: "placed" | "shipped" | "delivered" | "cancelled" | "returned";
      cashback_status: "untracked" | "pending" | "confirmed" | "cancelled";
      claim_status: "submitted" | "needs_input" | "resolved" | "escalated" | "closed";
      diagnosis_code:
        | "WITHIN_TRACKING_SLA"
        | "PENDING_CONFIRMATION_WINDOW"
        | "ORDER_CANCELLED_OR_RETURNED"
        | "EXCLUDED_CATEGORY"
        | "NO_CLICK_RECORDED"
        | "REFERRER_STRIPPED"
        | "NATIVE_APP_HANDOFF"
        | "COUPON_ATTRIBUTION_LOSS"
        | "SESSION_EXPIRED"
        | "CART_PRELOADED"
        | "ACCOUNT_MISMATCH"
        | "GENUINE_TRACKING_FAILURE"
        | "INSUFFICIENT_EVIDENCE";
    };
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Row"];

export type TablesInsert<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Insert"];
