export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      bookable_items: {
        Row: {
          booking_url: string;
          building_slug: string | null;
          capacity: number | null;
          floor: number | null;
          grouping: string | null;
          instance: string;
          is_listed: boolean;
          kind: string;
          libcal_item_id: number;
          lid: number;
          location_name: string | null;
          room_number: string | null;
          room_zone_id: string | null;
          space_id: string | null;
          thumbnail_url: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          booking_url: string;
          building_slug?: string | null;
          capacity?: number | null;
          floor?: number | null;
          grouping?: string | null;
          instance: string;
          is_listed?: boolean;
          kind: string;
          libcal_item_id: number;
          lid: number;
          location_name?: string | null;
          room_number?: string | null;
          room_zone_id?: string | null;
          space_id?: string | null;
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          booking_url?: string;
          building_slug?: string | null;
          capacity?: number | null;
          floor?: number | null;
          grouping?: string | null;
          instance?: string;
          is_listed?: boolean;
          kind?: string;
          libcal_item_id?: number;
          lid?: number;
          location_name?: string | null;
          room_number?: string | null;
          room_zone_id?: string | null;
          space_id?: string | null;
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookable_items_building_slug_fkey";
            columns: ["building_slug"];
            isOneToOne: false;
            referencedRelation: "buildings";
            referencedColumns: ["slug"];
          },
          {
            foreignKeyName: "bookable_items_room_zone_id_fkey";
            columns: ["room_zone_id"];
            isOneToOne: false;
            referencedRelation: "room_zones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookable_items_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      buildings: {
        Row: {
          acronym: string | null;
          address: string | null;
          campus: string | null;
          category: string | null;
          elevator_access: string | null;
          extra: NonNullable<Json>;
          floors: number | null;
          footprint: Json | null;
          lat: number | null;
          lng: number | null;
          name: string;
          official_id: string | null;
          ramp_access: string | null;
          short_name: string | null;
          slug: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          acronym?: string | null;
          address?: string | null;
          campus?: string | null;
          category?: string | null;
          elevator_access?: string | null;
          extra?: NonNullable<Json>;
          floors?: number | null;
          footprint?: Json | null;
          lat?: number | null;
          lng?: number | null;
          name: string;
          official_id?: string | null;
          ramp_access?: string | null;
          short_name?: string | null;
          slug: string;
          website?: string | null;
        };
        Update: {
          acronym?: string | null;
          address?: string | null;
          campus?: string | null;
          category?: string | null;
          elevator_access?: string | null;
          extra?: NonNullable<Json>;
          floors?: number | null;
          footprint?: Json | null;
          lat?: number | null;
          lng?: number | null;
          name?: string;
          official_id?: string | null;
          ramp_access?: string | null;
          short_name?: string | null;
          slug?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      floor_plans: {
        Row: {
          building_slug: string;
          corners: Json | null;
          floor_label: string | null;
          floor_number: number;
          height: number;
          id: string;
          image_path: string;
          is_listed: boolean;
          mask_path: string;
          mprint_tag: string;
          source_sha256: string;
          width: number;
        };
        ComputedFields: never;
        Insert: {
          building_slug: string;
          corners?: Json | null;
          floor_label?: string | null;
          floor_number: number;
          height: number;
          id?: string;
          image_path: string;
          is_listed?: boolean;
          mask_path: string;
          mprint_tag: string;
          source_sha256: string;
          width: number;
        };
        Update: {
          building_slug?: string;
          corners?: Json | null;
          floor_label?: string | null;
          floor_number?: number;
          height?: number;
          id?: string;
          image_path?: string;
          is_listed?: boolean;
          mask_path?: string;
          mprint_tag?: string;
          source_sha256?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: "floor_plans_building_slug_fkey";
            columns: ["building_slug"];
            isOneToOne: false;
            referencedRelation: "buildings";
            referencedColumns: ["slug"];
          },
        ];
      };
      photos: {
        Row: {
          alt: string;
          building_slug: string | null;
          credit: string;
          floor: number | null;
          heading: number | null;
          height: number;
          id: string;
          is_listed: boolean;
          kind: string;
          lat: number | null;
          license: string;
          lng: number | null;
          path_prefix: string;
          sort_order: number;
          source_url: string | null;
          space_id: string | null;
          width: number;
          widths: number[];
        };
        ComputedFields: never;
        Insert: {
          alt: string;
          building_slug?: string | null;
          credit: string;
          floor?: number | null;
          heading?: number | null;
          height: number;
          id?: string;
          is_listed?: boolean;
          kind?: string;
          lat?: number | null;
          license: string;
          lng?: number | null;
          path_prefix: string;
          sort_order?: number;
          source_url?: string | null;
          space_id?: string | null;
          width: number;
          widths: number[];
        };
        Update: {
          alt?: string;
          building_slug?: string | null;
          credit?: string;
          floor?: number | null;
          heading?: number | null;
          height?: number;
          id?: string;
          is_listed?: boolean;
          kind?: string;
          lat?: number | null;
          license?: string;
          lng?: number | null;
          path_prefix?: string;
          sort_order?: number;
          source_url?: string | null;
          space_id?: string | null;
          width?: number;
          widths?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "photos_building_slug_fkey";
            columns: ["building_slug"];
            isOneToOne: false;
            referencedRelation: "buildings";
            referencedColumns: ["slug"];
          },
          {
            foreignKeyName: "photos_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      room_zones: {
        Row: {
          bbox: number[];
          centroid_x: number;
          centroid_y: number;
          floor_plan_id: string;
          id: string;
          mask_index: number;
          name: string | null;
          room_number: string;
          space_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          bbox: number[];
          centroid_x: number;
          centroid_y: number;
          floor_plan_id: string;
          id?: string;
          mask_index: number;
          name?: string | null;
          room_number: string;
          space_id?: string | null;
        };
        Update: {
          bbox?: number[];
          centroid_x?: number;
          centroid_y?: number;
          floor_plan_id?: string;
          id?: string;
          mask_index?: number;
          name?: string | null;
          room_number?: string;
          space_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "room_zones_floor_plan_id_fkey";
            columns: ["floor_plan_id"];
            isOneToOne: false;
            referencedRelation: "floor_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_zones_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      spaces: {
        Row: {
          building_slug: string;
          capacity: number | null;
          features: Database["public"]["Enums"]["space_feature"][];
          floor: number | null;
          floor_label: string | null;
          id: string;
          image_alt: string | null;
          image_url: string | null;
          is_listed: boolean;
          lat: number | null;
          lng: number | null;
          name: string;
          noise_level: Database["public"]["Enums"]["noise_level"] | null;
          slug: string;
          source: Database["public"]["Enums"]["space_source"];
          source_url: string | null;
          summary: string | null;
          updated_at: string;
          waitz_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          building_slug: string;
          capacity?: number | null;
          features?: Database["public"]["Enums"]["space_feature"][];
          floor?: number | null;
          floor_label?: string | null;
          id?: string;
          image_alt?: string | null;
          image_url?: string | null;
          is_listed?: boolean;
          lat?: number | null;
          lng?: number | null;
          name: string;
          noise_level?: Database["public"]["Enums"]["noise_level"] | null;
          slug: string;
          source: Database["public"]["Enums"]["space_source"];
          source_url?: string | null;
          summary?: string | null;
          updated_at?: string;
          waitz_id?: string | null;
        };
        Update: {
          building_slug?: string;
          capacity?: number | null;
          features?: Database["public"]["Enums"]["space_feature"][];
          floor?: number | null;
          floor_label?: string | null;
          id?: string;
          image_alt?: string | null;
          image_url?: string | null;
          is_listed?: boolean;
          lat?: number | null;
          lng?: number | null;
          name?: string;
          noise_level?: Database["public"]["Enums"]["noise_level"] | null;
          slug?: string;
          source?: Database["public"]["Enums"]["space_source"];
          source_url?: string | null;
          summary?: string | null;
          updated_at?: string;
          waitz_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "spaces_building_slug_fkey";
            columns: ["building_slug"];
            isOneToOne: false;
            referencedRelation: "buildings";
            referencedColumns: ["slug"];
          },
        ];
      };
      user_settings: {
        Row: {
          settings: NonNullable<Json>;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          settings?: NonNullable<Json>;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          settings?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_in_overview: {
        Args: { since?: string; target_kind: string };
        Returns: {
          check_in_count: number;
          ease_of_focus_median: number;
          last_at: string;
          target_id: string;
          typical_light: Database["public"]["Enums"]["light_level"];
          typical_noise: Database["public"]["Enums"]["noise_level"];
        }[];
      };
      check_in_summary: {
        Args: { since?: string; target_id: string; target_kind: string };
        Returns: Json;
      };
      hook_before_user_created: { Args: { event: Json }; Returns: Json };
      submit_check_in: {
        Args: {
          busyness?: Database["public"]["Enums"]["busyness_level"];
          ease_of_focus?: number;
          features?: Database["public"]["Enums"]["space_feature"][];
          light?: Database["public"]["Enums"]["light_level"];
          natural_light?: boolean;
          noise?: Database["public"]["Enums"]["noise_level"];
          target_id: string;
          target_kind: string;
          visited_at?: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      busyness_level: "empty" | "some_seats" | "half_full" | "mostly_full" | "packed";
      light_level: "dim" | "moderate" | "bright";
      noise_level: "quiet" | "low_noise" | "conversational" | "loud";
      space_feature:
        | "natural_light"
        | "wheelchair_accessible"
        | "all_gender_restroom_on_floor"
        | "whiteboards"
        | "bookable"
        | "external_monitors"
        | "outlets"
        | "computers"
        | "printing"
        | "scanners"
        | "group_rooms";
      space_source: "um_library" | "mguide" | "manual";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      busyness_level: ["empty", "some_seats", "half_full", "mostly_full", "packed"],
      light_level: ["dim", "moderate", "bright"],
      noise_level: ["quiet", "low_noise", "conversational", "loud"],
      space_feature: [
        "natural_light",
        "wheelchair_accessible",
        "all_gender_restroom_on_floor",
        "whiteboards",
        "bookable",
        "external_monitors",
        "outlets",
        "computers",
        "printing",
        "scanners",
        "group_rooms",
      ],
      space_source: ["um_library", "mguide", "manual"],
    },
  },
} as const;
