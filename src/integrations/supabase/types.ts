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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_agent_config: {
        Row: {
          about_company: string | null
          created_at: string
          faq_content: string | null
          id: string
          is_active: boolean
          max_context_messages: number
          model: string
          openai_api_key: string | null
          organization_id: string
          pause_on_human_reply: boolean
          system_prompt: string
          updated_at: string
        }
        Insert: {
          about_company?: string | null
          created_at?: string
          faq_content?: string | null
          id?: string
          is_active?: boolean
          max_context_messages?: number
          model?: string
          openai_api_key?: string | null
          organization_id: string
          pause_on_human_reply?: boolean
          system_prompt?: string
          updated_at?: string
        }
        Update: {
          about_company?: string | null
          created_at?: string
          faq_content?: string | null
          id?: string
          is_active?: boolean
          max_context_messages?: number
          model?: string
          openai_api_key?: string | null
          organization_id?: string
          pause_on_human_reply?: boolean
          system_prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          about_company: string | null
          category: string
          created_at: string
          department: string
          description: string | null
          enabled_tools: string[]
          faq_content: string | null
          id: string
          is_active: boolean
          is_sdr: boolean
          is_squad_member: boolean
          max_context_messages: number
          model: string
          name: string
          organization_id: string
          pause_on_human_reply: boolean
          position: number
          split_delay_ms: number
          split_long_messages: boolean
          split_max_parts: number
          split_target_chars: number
          system_prompt: string
          updated_at: string
        }
        Insert: {
          about_company?: string | null
          category?: string
          created_at?: string
          department?: string
          description?: string | null
          enabled_tools?: string[]
          faq_content?: string | null
          id?: string
          is_active?: boolean
          is_sdr?: boolean
          is_squad_member?: boolean
          max_context_messages?: number
          model?: string
          name: string
          organization_id: string
          pause_on_human_reply?: boolean
          position?: number
          split_delay_ms?: number
          split_long_messages?: boolean
          split_max_parts?: number
          split_target_chars?: number
          system_prompt?: string
          updated_at?: string
        }
        Update: {
          about_company?: string | null
          category?: string
          created_at?: string
          department?: string
          description?: string | null
          enabled_tools?: string[]
          faq_content?: string | null
          id?: string
          is_active?: boolean
          is_sdr?: boolean
          is_squad_member?: boolean
          max_context_messages?: number
          model?: string
          name?: string
          organization_id?: string
          pause_on_human_reply?: boolean
          position?: number
          split_delay_ms?: number
          split_long_messages?: boolean
          split_max_parts?: number
          split_target_chars?: number
          system_prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_curation_examples: {
        Row: {
          analysis_id: string | null
          contact_id: string | null
          conversation_excerpt: string | null
          correct_values: Json
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          organization_id: string
          wrong_values: Json | null
        }
        Insert: {
          analysis_id?: string | null
          contact_id?: string | null
          conversation_excerpt?: string | null
          correct_values: Json
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          organization_id: string
          wrong_values?: Json | null
        }
        Update: {
          analysis_id?: string | null
          contact_id?: string | null
          conversation_excerpt?: string | null
          correct_values?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          organization_id?: string
          wrong_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_curation_examples_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "conversation_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_curation_rules: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          rules_text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          rules_text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          rules_text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          created_at: string
          flow_data: Json
          id: string
          is_active: boolean
          name: string
          organization_id: string
          priority: number
          trigger_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          flow_data?: Json
          id?: string
          is_active?: boolean
          name?: string
          organization_id: string
          priority?: number
          trigger_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          flow_data?: Json
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          priority?: number
          trigger_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          ai_prompt: Json | null
          author_name: string
          category: string | null
          content_md: string
          cover_prompt: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          cta_text: string | null
          cta_url: string | null
          excerpt: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          published_at: string | null
          reading_minutes: number
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_prompt?: Json | null
          author_name?: string
          category?: string | null
          content_md?: string
          cover_prompt?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          reading_minutes?: number
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_prompt?: Json | null
          author_name?: string
          category?: string | null
          content_md?: string
          cover_prompt?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          excerpt?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          reading_minutes?: number
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_reminders: {
        Row: {
          booking_id: string
          channel: string
          created_at: string
          email_log_id: string | null
          error_message: string | null
          id: string
          reminder_type: string
          scheduled_for: string
          scheduled_message_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          booking_id: string
          channel: string
          created_at?: string
          email_log_id?: string | null
          error_message?: string | null
          id?: string
          reminder_type: string
          scheduled_for: string
          scheduled_message_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          booking_id?: string
          channel?: string
          created_at?: string
          email_log_id?: string | null
          error_message?: string | null
          id?: string
          reminder_type?: string
          scheduled_for?: string
          scheduled_message_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          calendar_id: string
          cancel_token: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          contact_id: string | null
          created_at: string
          created_by_user_id: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          ends_at: string
          event_type_id: string
          id: string
          ip_address: string | null
          notes: string | null
          organization_id: string
          source: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          calendar_id: string
          cancel_token?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          ends_at: string
          event_type_id: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          organization_id: string
          source?: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          calendar_id?: string
          cancel_token?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          ends_at?: string
          event_type_id?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          organization_id?: string
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_campaigns: {
        Row: {
          batch_pause_max_seconds: number
          batch_pause_min_seconds: number
          batch_size: number
          completed_at: string | null
          created_at: string
          created_by: string
          current_batch: number
          failed_count: number
          id: string
          max_interval_seconds: number
          media_type: string | null
          media_url: string | null
          message_content: string
          messages_per_hour_limit: number
          min_interval_seconds: number
          name: string
          next_send_at: string | null
          organization_id: string
          paused_until: string | null
          scheduled_at: string | null
          sent_count: number
          started_at: string | null
          status: string
          total_contacts: number
          updated_at: string
        }
        Insert: {
          batch_pause_max_seconds?: number
          batch_pause_min_seconds?: number
          batch_size?: number
          completed_at?: string | null
          created_at?: string
          created_by: string
          current_batch?: number
          failed_count?: number
          id?: string
          max_interval_seconds?: number
          media_type?: string | null
          media_url?: string | null
          message_content: string
          messages_per_hour_limit?: number
          min_interval_seconds?: number
          name: string
          next_send_at?: string | null
          organization_id: string
          paused_until?: string | null
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          total_contacts?: number
          updated_at?: string
        }
        Update: {
          batch_pause_max_seconds?: number
          batch_pause_min_seconds?: number
          batch_size?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string
          current_batch?: number
          failed_count?: number
          id?: string
          max_interval_seconds?: number
          media_type?: string | null
          media_url?: string | null
          message_content?: string
          messages_per_hour_limit?: number
          min_interval_seconds?: number
          name?: string
          next_send_at?: string | null
          organization_id?: string
          paused_until?: string | null
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          total_contacts?: number
          updated_at?: string
        }
        Relationships: []
      }
      broadcast_recipients: {
        Row: {
          campaign_id: string
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          name: string | null
          phone: string
          position: number
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          name?: string | null
          phone: string
          position?: number
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          name?: string | null
          phone?: string
          position?: number
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "broadcast_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_availability: {
        Row: {
          calendar_id: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          calendar_id: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          calendar_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_availability_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_blocks: {
        Row: {
          calendar_id: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          organization_id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          organization_id: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          organization_id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_blocks_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_blocks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_blocks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_templates: {
        Row: {
          availability: Json
          category: string | null
          created_at: string
          created_by: string | null
          default_color: string | null
          default_timezone: string
          description: string | null
          event_types: Json
          icon: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          reminders_enabled: boolean
          scope: string
          updated_at: string
        }
        Insert: {
          availability?: Json
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_color?: string | null
          default_timezone?: string
          description?: string | null
          event_types?: Json
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          reminders_enabled?: boolean
          scope: string
          updated_at?: string
        }
        Update: {
          availability?: Json
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_color?: string | null
          default_timezone?: string
          description?: string | null
          event_types?: Json
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          reminders_enabled?: boolean
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          avatar_url: string | null
          color: string
          contact_phone: string | null
          created_at: string
          created_by: string
          description: string | null
          google_review_url: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          owner_user_id: string | null
          reminders_enabled: boolean
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          color?: string
          contact_phone?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          google_review_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          owner_user_id?: string | null
          reminders_enabled?: boolean
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          color?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          google_review_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          owner_user_id?: string | null
          reminders_enabled?: boolean
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendars_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendars_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_orders: {
        Row: {
          contact_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          items: Json
          notes: string | null
          organization_id: string
          subtotal: number
          whatsapp_sent_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          id?: string
          items: Json
          notes?: string | null
          organization_id: string
          subtotal?: number
          whatsapp_sent_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          items?: Json
          notes?: string | null
          organization_id?: string
          subtotal?: number
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_settings: {
        Row: {
          about: string | null
          banner_url: string | null
          created_at: string
          display_name: string
          is_published: boolean
          logo_url: string | null
          organization_id: string
          show_prices: boolean
          slug: string
          tagline: string | null
          theme_color: string
          updated_at: string
          whatsapp_greeting_template: string
        }
        Insert: {
          about?: string | null
          banner_url?: string | null
          created_at?: string
          display_name?: string
          is_published?: boolean
          logo_url?: string | null
          organization_id: string
          show_prices?: boolean
          slug: string
          tagline?: string | null
          theme_color?: string
          updated_at?: string
          whatsapp_greeting_template?: string
        }
        Update: {
          about?: string | null
          banner_url?: string | null
          created_at?: string
          display_name?: string
          is_published?: boolean
          logo_url?: string | null
          organization_id?: string
          show_prices?: boolean
          slug?: string
          tagline?: string | null
          theme_color?: string
          updated_at?: string
          whatsapp_greeting_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_custom_fields: {
        Row: {
          contact_id: string
          created_at: string
          field_definition_id: string | null
          field_name: string
          field_value: string | null
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          field_definition_id?: string | null
          field_name: string
          field_value?: string | null
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          field_definition_id?: string | null
          field_name?: string
          field_value?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_custom_fields_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_custom_fields_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_custom_fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_custom_fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          active_flow_id: string | null
          ai_agent_id: string | null
          ai_enabled: boolean
          assigned_to: string | null
          automations_paused: boolean
          birth_date: string | null
          channel: string
          closed_at: string | null
          created_at: string
          current_node_id: string | null
          deal_notes: string | null
          deal_value: number | null
          email: string | null
          flow_context: Json | null
          flow_paused_until: string | null
          funnel_stage: string
          id: string
          is_archived: boolean
          kanban_column_id: string | null
          last_message_at: string | null
          loss_reason: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string
          pipeline_id: string | null
          profile_picture_url: string | null
          resume_at: string | null
          sale_result: string | null
          sla_alert_sent: boolean
          snoozed_until: string | null
          status: string
          unread_count: number
          updated_at: string
          waiting_response: boolean | null
          waiting_response_timeout: string | null
          win_reason: string | null
        }
        Insert: {
          active_flow_id?: string | null
          ai_agent_id?: string | null
          ai_enabled?: boolean
          assigned_to?: string | null
          automations_paused?: boolean
          birth_date?: string | null
          channel?: string
          closed_at?: string | null
          created_at?: string
          current_node_id?: string | null
          deal_notes?: string | null
          deal_value?: number | null
          email?: string | null
          flow_context?: Json | null
          flow_paused_until?: string | null
          funnel_stage?: string
          id?: string
          is_archived?: boolean
          kanban_column_id?: string | null
          last_message_at?: string | null
          loss_reason?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone: string
          pipeline_id?: string | null
          profile_picture_url?: string | null
          resume_at?: string | null
          sale_result?: string | null
          sla_alert_sent?: boolean
          snoozed_until?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          waiting_response?: boolean | null
          waiting_response_timeout?: string | null
          win_reason?: string | null
        }
        Update: {
          active_flow_id?: string | null
          ai_agent_id?: string | null
          ai_enabled?: boolean
          assigned_to?: string | null
          automations_paused?: boolean
          birth_date?: string | null
          channel?: string
          closed_at?: string | null
          created_at?: string
          current_node_id?: string | null
          deal_notes?: string | null
          deal_value?: number | null
          email?: string | null
          flow_context?: Json | null
          flow_paused_until?: string | null
          funnel_stage?: string
          id?: string
          is_archived?: boolean
          kanban_column_id?: string | null
          last_message_at?: string | null
          loss_reason?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string
          pipeline_id?: string | null
          profile_picture_url?: string | null
          resume_at?: string | null
          sale_result?: string | null
          sla_alert_sent?: boolean
          snoozed_until?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          waiting_response?: boolean | null
          waiting_response_timeout?: string | null
          win_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_active_flow_id_fkey"
            columns: ["active_flow_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_kanban_column_id_fkey"
            columns: ["kanban_column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "kanban_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_analyses: {
        Row: {
          analysis_date: string
          contact_id: string | null
          corrected_at: string | null
          corrected_by: string | null
          correction_note: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          id: string
          is_corrected: boolean
          lead_source: string | null
          organization_id: string
          original_values: Json | null
          part_searched: string | null
          phone: string | null
          product_line: string | null
          quantity: number | null
          sale_status: string | null
          sale_value: number | null
        }
        Insert: {
          analysis_date?: string
          contact_id?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_note?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          id?: string
          is_corrected?: boolean
          lead_source?: string | null
          organization_id: string
          original_values?: Json | null
          part_searched?: string | null
          phone?: string | null
          product_line?: string | null
          quantity?: number | null
          sale_status?: string | null
          sale_value?: number | null
        }
        Update: {
          analysis_date?: string
          contact_id?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_note?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          id?: string
          is_corrected?: boolean
          lead_source?: string | null
          organization_id?: string
          original_values?: Json | null
          part_searched?: string | null
          phone?: string | null
          product_line?: string | null
          quantity?: number | null
          sale_status?: string | null
          sale_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_analyses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          field_type: string
          id: string
          is_required: boolean
          name: string
          options: Json | null
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          is_required?: boolean
          name: string
          options?: Json | null
          organization_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          is_required?: boolean
          name?: string
          options?: Json | null
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_history: {
        Row: {
          automation_id: string | null
          contact_id: string | null
          created_at: string
          error_message: string | null
          from_email: string | null
          id: string
          organization_id: string
          resend_message_id: string | null
          source: string
          status: string
          subject: string | null
          to_email: string
          triggered_by: string | null
        }
        Insert: {
          automation_id?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          from_email?: string | null
          id?: string
          organization_id: string
          resend_message_id?: string | null
          source?: string
          status: string
          subject?: string | null
          to_email: string
          triggered_by?: string | null
        }
        Update: {
          automation_id?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          from_email?: string | null
          id?: string
          organization_id?: string
          resend_message_id?: string | null
          source?: string
          status?: string
          subject?: string | null
          to_email?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_send_history_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          calendar_id: string
          cancellation_message_whatsapp: string | null
          confirmation_message_whatsapp: string | null
          confirmation_subject_email: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          google_review_url: string | null
          id: string
          is_active: boolean
          max_advance_days: number
          min_notice_hours: number
          name: string
          organization_id: string
          position: number
          reminder_1h_message_whatsapp: string | null
          reminder_1h_subject_email: string | null
          reminder_24h_message_whatsapp: string | null
          reminder_24h_subject_email: string | null
          reminders_enabled: boolean
          requires_confirmation: boolean
          reschedule_message_whatsapp: string | null
          review_message_whatsapp: string | null
          review_subject_email: string | null
          slot_interval_minutes: number
          updated_at: string
        }
        Insert: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          calendar_id: string
          cancellation_message_whatsapp?: string | null
          confirmation_message_whatsapp?: string | null
          confirmation_subject_email?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          google_review_url?: string | null
          id?: string
          is_active?: boolean
          max_advance_days?: number
          min_notice_hours?: number
          name: string
          organization_id: string
          position?: number
          reminder_1h_message_whatsapp?: string | null
          reminder_1h_subject_email?: string | null
          reminder_24h_message_whatsapp?: string | null
          reminder_24h_subject_email?: string | null
          reminders_enabled?: boolean
          requires_confirmation?: boolean
          reschedule_message_whatsapp?: string | null
          review_message_whatsapp?: string | null
          review_subject_email?: string | null
          slot_interval_minutes?: number
          updated_at?: string
        }
        Update: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          calendar_id?: string
          cancellation_message_whatsapp?: string | null
          confirmation_message_whatsapp?: string | null
          confirmation_subject_email?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          google_review_url?: string | null
          id?: string
          is_active?: boolean
          max_advance_days?: number
          min_notice_hours?: number
          name?: string
          organization_id?: string
          position?: number
          reminder_1h_message_whatsapp?: string | null
          reminder_1h_subject_email?: string | null
          reminder_24h_message_whatsapp?: string | null
          reminder_24h_subject_email?: string | null
          reminders_enabled?: boolean
          requires_confirmation?: boolean
          reschedule_message_whatsapp?: string | null
          review_message_whatsapp?: string | null
          review_subject_email?: string | null
          slot_interval_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_types_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_type: string
          color: string
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          initial_balance: number
          is_active: boolean
          name: string
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          account_type?: string
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          name: string
          organization_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          account_type?: string
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          category_type: string
          color: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string
          parent_id: string | null
          position: number
          updated_at: string
        }
        Insert: {
          category_type: string
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id: string
          parent_id?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          category_type?: string
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string
          parent_id?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_recurrences: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          end_date: string | null
          frequency: string
          id: string
          interval_count: number
          is_active: boolean
          last_run_date: string | null
          next_run_date: string
          notes: string | null
          occurrences_done: number
          organization_id: string
          start_date: string
          total_occurrences: number | null
          transaction_type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          end_date?: string | null
          frequency: string
          id?: string
          interval_count?: number
          is_active?: boolean
          last_run_date?: string | null
          next_run_date: string
          notes?: string | null
          occurrences_done?: number
          organization_id: string
          start_date: string
          total_occurrences?: number | null
          transaction_type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          end_date?: string | null
          frequency?: string
          id?: string
          interval_count?: number
          is_active?: boolean
          last_run_date?: string | null
          next_run_date?: string
          notes?: string | null
          occurrences_done?: number
          organization_id?: string
          start_date?: string
          total_occurrences?: number | null
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_recurrences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_recurrences_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_recurrences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_recurrences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          account_id: string
          amount: number
          attachment_url: string | null
          category_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          notes: string | null
          organization_id: string
          paid_date: string | null
          payment_method: string | null
          recurrence_id: string | null
          source: string
          source_ref: string | null
          status: string
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          attachment_url?: string | null
          category_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          paid_date?: string | null
          payment_method?: string | null
          recurrence_id?: string | null
          source?: string
          source_ref?: string | null
          status?: string
          transaction_date?: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          attachment_url?: string | null
          category_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          paid_date?: string | null
          payment_method?: string | null
          recurrence_id?: string | null
          source?: string
          source_ref?: string | null
          status?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "financial_recurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stage_transitions: {
        Row: {
          created_at: string
          from_stage_id: string
          id: string
          organization_id: string
          to_stage_id: string
        }
        Insert: {
          created_at?: string
          from_stage_id: string
          id?: string
          organization_id: string
          to_stage_id: string
        }
        Update: {
          created_at?: string
          from_stage_id?: string
          id?: string
          organization_id?: string
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stage_transitions_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_stage_transitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_stage_transitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_stage_transitions_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          auto_close_conversation: boolean
          canvas_x: number | null
          canvas_y: number | null
          color: string
          created_at: string
          cta_text: string | null
          id: string
          is_final: boolean
          name: string
          organization_id: string
          pipeline_id: string
          position: number
          sla_threshold_minutes: number | null
          slug: string
          stage_type: string
          updated_at: string
        }
        Insert: {
          auto_close_conversation?: boolean
          canvas_x?: number | null
          canvas_y?: number | null
          color?: string
          created_at?: string
          cta_text?: string | null
          id?: string
          is_final?: boolean
          name: string
          organization_id: string
          pipeline_id: string
          position?: number
          sla_threshold_minutes?: number | null
          slug: string
          stage_type?: string
          updated_at?: string
        }
        Update: {
          auto_close_conversation?: boolean
          canvas_x?: number | null
          canvas_y?: number | null
          color?: string
          created_at?: string
          cta_text?: string | null
          id?: string
          is_final?: boolean
          name?: string
          organization_id?: string
          pipeline_id?: string
          position?: number
          sla_threshold_minutes?: number | null
          slug?: string
          stage_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "kanban_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_participants: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_participants_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_progress: {
        Row: {
          current_value: number
          deals_count: number
          goal_id: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          current_value?: number
          deals_count?: number
          goal_id: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          current_value?: number
          deals_count?: number
          goal_id?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          goal_type: string
          id: string
          notified_100: boolean
          notified_50: boolean
          notified_80: boolean
          organization_id: string
          period_end: string
          period_start: string
          period_type: string
          pipeline_id: string | null
          scope: string
          status: string
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          goal_type: string
          id?: string
          notified_100?: boolean
          notified_50?: boolean
          notified_80?: boolean
          organization_id: string
          period_end: string
          period_start: string
          period_type: string
          pipeline_id?: string | null
          scope: string
          status?: string
          target_value: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          goal_type?: string
          id?: string
          notified_100?: boolean
          notified_50?: boolean
          notified_80?: boolean
          organization_id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          pipeline_id?: string | null
          scope?: string
          status?: string
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "kanban_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          completed_at: string | null
          created_at: string
          duplicates_count: number
          error_message: string | null
          failed_count: number
          file_name: string | null
          id: string
          imported_by: string
          imported_count: number
          organization_id: string
          started_at: string
          status: string
          tags_applied: number
          total_contacts: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duplicates_count?: number
          error_message?: string | null
          failed_count?: number
          file_name?: string | null
          id?: string
          imported_by: string
          imported_count?: number
          organization_id: string
          started_at?: string
          status?: string
          tags_applied?: number
          total_contacts?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duplicates_count?: number
          error_message?: string | null
          failed_count?: number
          file_name?: string | null
          id?: string
          imported_by?: string
          imported_count?: number
          organization_id?: string
          started_at?: string
          status?: string
          tags_applied?: number
          total_contacts?: number
        }
        Relationships: []
      }
      instagram_comments: {
        Row: {
          created_at: string
          from_ig_user_id: string | null
          from_username: string | null
          id: string
          ig_comment_id: string
          ig_media_id: string | null
          ig_reply_id: string | null
          organization_id: string
          parent_comment_id: string | null
          permalink: string | null
          received_at: string
          replied_at: string | null
          replied_by_user_id: string | null
          reply_text: string | null
          text: string | null
        }
        Insert: {
          created_at?: string
          from_ig_user_id?: string | null
          from_username?: string | null
          id?: string
          ig_comment_id: string
          ig_media_id?: string | null
          ig_reply_id?: string | null
          organization_id: string
          parent_comment_id?: string | null
          permalink?: string | null
          received_at?: string
          replied_at?: string | null
          replied_by_user_id?: string | null
          reply_text?: string | null
          text?: string | null
        }
        Update: {
          created_at?: string
          from_ig_user_id?: string | null
          from_username?: string | null
          id?: string
          ig_comment_id?: string
          ig_media_id?: string | null
          ig_reply_id?: string | null
          organization_id?: string
          parent_comment_id?: string | null
          permalink?: string | null
          received_at?: string
          replied_at?: string | null
          replied_by_user_id?: string | null
          reply_text?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_instances: {
        Row: {
          account_name: string | null
          auth_type: string
          created_at: string
          id: string
          ig_user_id: string
          organization_id: string
          page_access_token: string
          page_id: string | null
          profile_picture_url: string | null
          token_expires_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          account_name?: string | null
          auth_type?: string
          created_at?: string
          id?: string
          ig_user_id: string
          organization_id: string
          page_access_token: string
          page_id?: string | null
          profile_picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_name?: string | null
          auth_type?: string
          created_at?: string
          id?: string
          ig_user_id?: string
          organization_id?: string
          page_access_token?: string
          page_id?: string | null
          profile_picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_posts: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          ig_media_id: string
          media_type: string | null
          media_url: string | null
          organization_id: string
          permalink: string | null
          published_at: string
          published_by_user_id: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          ig_media_id: string
          media_type?: string | null
          media_url?: string | null
          organization_id: string
          permalink?: string | null
          published_at?: string
          published_by_user_id?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          ig_media_id?: string
          media_type?: string | null
          media_url?: string | null
          organization_id?: string
          permalink?: string | null
          published_at?: string
          published_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_admin: boolean
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          last_message_at: string | null
          name: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          last_message_at?: string | null
          name?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          last_message_at?: string | null
          name?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          forwarded_from: string | null
          id: string
          is_forwarded: boolean
          media_url: string | null
          mentioned_user_ids: string[] | null
          message_type: string
          quoted_message_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          forwarded_from?: string | null
          id?: string
          is_forwarded?: boolean
          media_url?: string | null
          mentioned_user_ids?: string[] | null
          message_type?: string
          quoted_message_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          forwarded_from?: string | null
          id?: string
          is_forwarded?: boolean
          media_url?: string | null
          mentioned_user_ids?: string[] | null
          message_type?: string
          quoted_message_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_quoted_message_id_fkey"
            columns: ["quoted_message_id"]
            isOneToOne: false
            referencedRelation: "internal_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "internal_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_polls: {
        Row: {
          closes_at: string | null
          conversation_id: string
          created_at: string
          created_by: string
          id: string
          is_anonymous: boolean
          is_closed: boolean
          is_multiple_choice: boolean
          options: Json
          question: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          conversation_id: string
          created_at?: string
          created_by: string
          id?: string
          is_anonymous?: boolean
          is_closed?: boolean
          is_multiple_choice?: boolean
          options?: Json
          question: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          conversation_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_anonymous?: boolean
          is_closed?: boolean
          is_multiple_choice?: boolean
          options?: Json
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_polls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          pipeline_id: string | null
          position: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          pipeline_id?: string | null
          position?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          pipeline_id?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_columns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_columns_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "kanban_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_pipelines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_pipelines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_pipelines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loss_reasons: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          organization_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loss_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loss_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_agent_id: string | null
          channel: string
          contact_id: string
          content: string | null
          created_at: string
          direction: string
          forwarded_from: string | null
          id: string
          is_forwarded: boolean
          media_url: string | null
          message_type: string
          organization_id: string
          quoted_content: string | null
          quoted_message_id: string | null
          quoted_type: string | null
          sent_by_user_id: string | null
          sequence_id: number
          status: string
          transcription: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          ai_agent_id?: string | null
          channel?: string
          contact_id: string
          content?: string | null
          created_at?: string
          direction: string
          forwarded_from?: string | null
          id?: string
          is_forwarded?: boolean
          media_url?: string | null
          message_type?: string
          organization_id: string
          quoted_content?: string | null
          quoted_message_id?: string | null
          quoted_type?: string | null
          sent_by_user_id?: string | null
          sequence_id?: number
          status?: string
          transcription?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          ai_agent_id?: string | null
          channel?: string
          contact_id?: string
          content?: string | null
          created_at?: string
          direction?: string
          forwarded_from?: string | null
          id?: string
          is_forwarded?: boolean
          media_url?: string | null
          message_type?: string
          organization_id?: string
          quoted_content?: string | null
          quoted_message_id?: string | null
          quoted_type?: string | null
          sent_by_user_id?: string | null
          sequence_id?: number
          status?: string
          transcription?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_quoted_message_id_fkey"
            columns: ["quoted_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_features: {
        Row: {
          created_at: string
          enabled_at: string | null
          enabled_by: string | null
          feature_key: string
          id: string
          is_enabled: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled_at?: string | null
          enabled_by?: string | null
          feature_key: string
          id?: string
          is_enabled?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled_at?: string | null
          enabled_by?: string | null
          feature_key?: string
          id?: string
          is_enabled?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_features_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_features_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_holidays: {
        Row: {
          created_at: string
          custom_hours_end: string | null
          custom_hours_start: string | null
          holiday_date: string
          id: string
          is_closed: boolean
          name: string
          organization_id: string
          return_date: string | null
        }
        Insert: {
          created_at?: string
          custom_hours_end?: string | null
          custom_hours_start?: string | null
          holiday_date: string
          id?: string
          is_closed?: boolean
          name: string
          organization_id: string
          return_date?: string | null
        }
        Update: {
          created_at?: string
          custom_hours_end?: string | null
          custom_hours_start?: string | null
          holiday_date?: string
          id?: string
          is_closed?: boolean
          name?: string
          organization_id?: string
          return_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_holidays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_holidays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          invite_code: string
          invite_type: string
          is_active: boolean
          max_uses: number | null
          member_role: Database["public"]["Enums"]["member_role"]
          organization_id: string | null
          use_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          invite_code: string
          invite_type?: string
          is_active?: boolean
          max_uses?: number | null
          member_role?: Database["public"]["Enums"]["member_role"]
          organization_id?: string | null
          use_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          invite_code?: string
          invite_type?: string
          is_active?: boolean
          max_uses?: number | null
          member_role?: Database["public"]["Enums"]["member_role"]
          organization_id?: string | null
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          member_role: Database["public"]["Enums"]["member_role"] | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          member_role?: Database["public"]["Enums"]["member_role"] | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          member_role?: Database["public"]["Enums"]["member_role"] | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          bookings_email_enabled: boolean
          business_hours_end: string | null
          business_hours_start: string | null
          closed_hours_message: string | null
          created_at: string
          funnel_transitions_initialized: boolean
          google_reviews_url: string | null
          id: string
          loss_reason_question: string | null
          lunch_break_days: number[] | null
          lunch_break_enabled: boolean | null
          lunch_break_end: string | null
          lunch_break_start: string | null
          name: string
          openai_api_key: string | null
          resend_api_key: string | null
          resend_from_email: string | null
          resend_from_name: string | null
          resend_reply_to: string | null
          sla_alert_destinations: Json
          sla_alert_phone: string | null
          sla_alert_phones: string[]
          sla_alert_template: string
          sla_enabled: boolean
          sla_excluded_tag_ids: string[] | null
          sla_threshold_minutes: number
          snooze_reactivation_message: string | null
          ticket_farewell_message: string | null
          updated_at: string
          weekend_hours_enabled: boolean | null
          weekend_hours_end: string | null
          weekend_hours_start: string | null
          win_reason_question: string | null
          working_days: number[] | null
        }
        Insert: {
          bookings_email_enabled?: boolean
          business_hours_end?: string | null
          business_hours_start?: string | null
          closed_hours_message?: string | null
          created_at?: string
          funnel_transitions_initialized?: boolean
          google_reviews_url?: string | null
          id?: string
          loss_reason_question?: string | null
          lunch_break_days?: number[] | null
          lunch_break_enabled?: boolean | null
          lunch_break_end?: string | null
          lunch_break_start?: string | null
          name: string
          openai_api_key?: string | null
          resend_api_key?: string | null
          resend_from_email?: string | null
          resend_from_name?: string | null
          resend_reply_to?: string | null
          sla_alert_destinations?: Json
          sla_alert_phone?: string | null
          sla_alert_phones?: string[]
          sla_alert_template?: string
          sla_enabled?: boolean
          sla_excluded_tag_ids?: string[] | null
          sla_threshold_minutes?: number
          snooze_reactivation_message?: string | null
          ticket_farewell_message?: string | null
          updated_at?: string
          weekend_hours_enabled?: boolean | null
          weekend_hours_end?: string | null
          weekend_hours_start?: string | null
          win_reason_question?: string | null
          working_days?: number[] | null
        }
        Update: {
          bookings_email_enabled?: boolean
          business_hours_end?: string | null
          business_hours_start?: string | null
          closed_hours_message?: string | null
          created_at?: string
          funnel_transitions_initialized?: boolean
          google_reviews_url?: string | null
          id?: string
          loss_reason_question?: string | null
          lunch_break_days?: number[] | null
          lunch_break_enabled?: boolean | null
          lunch_break_end?: string | null
          lunch_break_start?: string | null
          name?: string
          openai_api_key?: string | null
          resend_api_key?: string | null
          resend_from_email?: string | null
          resend_from_name?: string | null
          resend_reply_to?: string | null
          sla_alert_destinations?: Json
          sla_alert_phone?: string | null
          sla_alert_phones?: string[]
          sla_alert_template?: string
          sla_enabled?: boolean
          sla_excluded_tag_ids?: string[] | null
          sla_threshold_minutes?: number
          snooze_reactivation_message?: string | null
          ticket_farewell_message?: string | null
          updated_at?: string
          weekend_hours_enabled?: boolean | null
          weekend_hours_end?: string | null
          weekend_hours_start?: string | null
          win_reason_question?: string | null
          working_days?: number[] | null
        }
        Relationships: []
      }
      payment_integration_events: {
        Row: {
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          integration_id: string | null
          organization_id: string
          platform: string
          product_name: string | null
          purchase_event: string | null
          raw_payload: Json | null
          status: string
          value: number | null
        }
        Insert: {
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_id?: string | null
          organization_id: string
          platform: string
          product_name?: string | null
          purchase_event?: string | null
          raw_payload?: Json | null
          status?: string
          value?: number | null
        }
        Update: {
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_id?: string | null
          organization_id?: string
          platform?: string
          product_name?: string | null
          purchase_event?: string | null
          raw_payload?: Json | null
          status?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_integration_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_integration_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "payment_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_integrations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          platform: string
          secret: string | null
          updated_at: string
          webhook_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          platform?: string
          secret?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          platform?: string
          secret?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_access: {
        Row: {
          created_at: string
          granted_by: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: []
      }
      pipeline_saved_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_default: boolean
          name: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          compare_at_price: number | null
          created_at: string
          id: string
          is_available: boolean
          name: string
          organization_id: string
          position: number
          price: number
          product_id: string
          sku: string | null
          updated_at: string
        }
        Insert: {
          attributes?: Json
          compare_at_price?: number | null
          created_at?: string
          id?: string
          is_available?: boolean
          name: string
          organization_id: string
          position?: number
          price?: number
          product_id: string
          sku?: string | null
          updated_at?: string
        }
        Update: {
          attributes?: Json
          compare_at_price?: number | null
          created_at?: string
          id?: string
          is_available?: boolean
          name?: string
          organization_id?: string
          position?: number
          price?: number
          product_id?: string
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          base_price: number
          category_id: string | null
          compare_at_price: number | null
          created_at: string
          description: string | null
          has_variants: boolean
          id: string
          images: Json
          is_available: boolean
          kind: string
          metadata: Json
          name: string
          organization_id: string
          position: number
          sku: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          base_price?: number
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          has_variants?: boolean
          id?: string
          images?: Json
          is_available?: boolean
          kind?: string
          metadata?: Json
          name: string
          organization_id: string
          position?: number
          sku?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          has_variants?: boolean
          id?: string
          images?: Json
          is_available?: boolean
          kind?: string
          metadata?: Json
          name?: string
          organization_id?: string
          position?: number
          sku?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          organization_id: string
          shortcut: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          organization_id: string
          shortcut: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          organization_id?: string
          shortcut?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          conversation_history: string | null
          created_at: string
          defect_type: string
          evidence_urls: string[] | null
          id: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          response_time_minutes: number
          review_date: string
          salesperson_id: string
        }
        Insert: {
          conversation_history?: string | null
          created_at?: string
          defect_type: string
          evidence_urls?: string[] | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          response_time_minutes: number
          review_date?: string
          salesperson_id: string
        }
        Update: {
          conversation_history?: string | null
          created_at?: string
          defect_type?: string
          evidence_urls?: string[] | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          response_time_minutes?: number
          review_date?: string
          salesperson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          id: string
          organization_id: string | null
          permission: string
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          organization_id?: string | null
          permission: string
          role: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          organization_id?: string | null
          permission?: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: []
      }
      salespeople: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salespeople_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salespeople_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_responses: {
        Row: {
          answers: Json | null
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          id: string
          organization_id: string
          rating: number | null
          submitted_at: string | null
          survey_id: string
          token: string
        }
        Insert: {
          answers?: Json | null
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          rating?: number | null
          submitted_at?: string | null
          survey_id: string
          token: string
        }
        Update: {
          answers?: Json | null
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          rating?: number | null
          submitted_at?: string | null
          survey_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_responses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "satisfaction_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_surveys: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          organization_id: string
          primary_color: string
          questions: Json
          thank_you_message: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          organization_id: string
          primary_color?: string
          questions?: Json
          thank_you_message?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          organization_id?: string
          primary_color?: string
          questions?: Json
          thank_you_message?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_surveys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_surveys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          contact_id: string
          created_at: string
          error_message: string | null
          id: string
          message_content: string
          organization_id: string
          parent_schedule_id: string | null
          recurrence_end_at: string | null
          recurrence_interval: number
          recurrence_rule: string | null
          scheduled_at: string
          scheduled_by: string
          sent_at: string | null
          status: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_content: string
          organization_id: string
          parent_schedule_id?: string | null
          recurrence_end_at?: string | null
          recurrence_interval?: number
          recurrence_rule?: string | null
          scheduled_at: string
          scheduled_by: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_content?: string
          organization_id?: string
          parent_schedule_id?: string | null
          recurrence_end_at?: string | null
          recurrence_interval?: number
          recurrence_rule?: string | null
          scheduled_at?: string
          scheduled_by?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_parent_schedule_id_fkey"
            columns: ["parent_schedule_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_analysis_views: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          organization_id: string
          share_token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          organization_id: string
          share_token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_analysis_views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_analysis_views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_notifications: {
        Row: {
          agent_name: string | null
          assigned_to: string | null
          contact_id: string
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          organization_id: string
          wait_time_minutes: number
        }
        Insert: {
          agent_name?: string | null
          assigned_to?: string | null
          contact_id: string
          contact_name: string
          contact_phone: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          organization_id: string
          wait_time_minutes: number
        }
        Update: {
          agent_name?: string | null
          assigned_to?: string | null
          contact_id?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          organization_id?: string
          wait_time_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "sla_notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          media_url: string | null
          message_type: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
          message_type?: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
          message_type?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          created_by: string
          id: string
          organization_id: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: []
      }
      user_pipeline_preferences: {
        Row: {
          created_at: string
          default_pipeline_id: string
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_pipeline_id: string
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_pipeline_id?: string
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pipeline_preferences_default_pipeline_id_fkey"
            columns: ["default_pipeline_id"]
            isOneToOne: false
            referencedRelation: "kanban_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pipeline_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pipeline_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      user_stickers: {
        Row: {
          created_at: string
          id: string
          name: string | null
          organization_id: string
          sticker_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          organization_id: string
          sticker_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          organization_id?: string
          sticker_url?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          api_key: string
          base_url: string
          created_at: string
          id: string
          instance_name: string
          organization_id: string
          owner_jid: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          base_url?: string
          created_at?: string
          id?: string
          instance_name: string
          organization_id: string
          owner_jid?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          base_url?: string
          created_at?: string
          id?: string
          instance_name?: string
          organization_id?: string
          owner_jid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_instances: {
        Row: {
          access_token: string | null
          business_name: string | null
          created_at: string
          display_phone_number: string | null
          id: string
          is_active: boolean
          last_event_at: string | null
          organization_id: string
          phone_number_id: string
          updated_at: string
          waba_id: string | null
        }
        Insert: {
          access_token?: string | null
          business_name?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          is_active?: boolean
          last_event_at?: string | null
          organization_id: string
          phone_number_id: string
          updated_at?: string
          waba_id?: string | null
        }
        Update: {
          access_token?: string | null
          business_name?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          is_active?: boolean
          last_event_at?: string | null
          organization_id?: string
          phone_number_id?: string
          updated_at?: string
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_meta_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      win_reasons: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          organization_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "win_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "win_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      organization_stats: {
        Row: {
          automation_count: number | null
          contact_count: number | null
          created_at: string | null
          has_whatsapp: number | null
          id: string | null
          last_message_at: string | null
          member_count: number | null
          message_count: number | null
          name: string | null
        }
        Insert: {
          automation_count?: never
          contact_count?: never
          created_at?: string | null
          has_whatsapp?: never
          id?: string | null
          last_message_at?: never
          member_count?: never
          message_count?: never
          name?: string | null
        }
        Update: {
          automation_count?: never
          contact_count?: never
          created_at?: string | null
          has_whatsapp?: never
          id?: string | null
          last_message_at?: never
          member_count?: never
          message_count?: never
          name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_calendar_template: {
        Args: {
          p_calendar_name: string
          p_owner_user_id?: string
          p_slug: string
          p_template_id: string
        }
        Returns: string
      }
      can_manage_internal_conversation_participants: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      can_view_pipeline: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      cancel_booking_by_token: {
        Args: { p_reason?: string; p_token: string }
        Returns: {
          booking_id: string
          calendar_name: string
          customer_name: string
          ends_at: string
          starts_at: string
          was_cancelled: boolean
        }[]
      }
      consume_owner_invite: {
        Args: { p_invite_code: string }
        Returns: boolean
      }
      create_catalog_order: {
        Args: {
          p_customer_name: string
          p_customer_phone: string
          p_items: Json
          p_notes?: string
          p_slug: string
        }
        Returns: Json
      }
      create_internal_booking: {
        Args: {
          p_calendar_id: string
          p_contact_id: string
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_event_type_id: string
          p_notes: string
          p_skip_reminders?: boolean
          p_starts_at: string
        }
        Returns: string
      }
      create_internal_conversation: {
        Args: {
          p_is_group?: boolean
          p_name?: string
          p_participant_ids: string[]
        }
        Returns: string
      }
      create_organization_with_owner: {
        Args: { p_name: string }
        Returns: {
          organization_id: string
          organization_name: string
        }[]
      }
      get_available_slots: {
        Args: {
          p_calendar_id: string
          p_event_type_id: string
          p_from: string
          p_to: string
        }
        Returns: {
          slot: string
        }[]
      }
      get_invite_organization: {
        Args: { invite_code: string }
        Returns: {
          invite_type: string
          organization_id: string
          organization_name: string
        }[]
      }
      get_last_messages_for_contacts: {
        Args: { p_contact_ids: string[] }
        Returns: {
          contact_id: string
          content: string
          created_at: string
          direction: string
          message_type: string
        }[]
      }
      get_next_open_slot:
        | { Args: { p_organization_id: string }; Returns: string }
        | {
            Args: { p_offset_days?: number; p_organization_id: string }
            Returns: string
          }
      get_org_email_settings: {
        Args: { p_org: string }
        Returns: {
          resend_api_key: string
          resend_from_email: string
          resend_from_name: string
          resend_reply_to: string
        }[]
      }
      get_org_openai_api_key: { Args: { p_org: string }; Returns: string }
      get_public_calendar: {
        Args: { p_slug: string }
        Returns: {
          bookings_email_enabled: boolean
          calendar_avatar_url: string
          calendar_color: string
          calendar_description: string
          calendar_id: string
          calendar_name: string
          calendar_reminders_enabled: boolean
          calendar_timezone: string
          event_types: Json
          organization_id: string
          organization_name: string
        }[]
      }
      get_public_catalog: { Args: { p_slug: string }; Returns: Json }
      get_public_catalog_whatsapp: { Args: { p_slug: string }; Returns: string }
      get_public_satisfaction_survey: {
        Args: { p_token: string }
        Returns: {
          response_id: string
          response_submitted_at: string
          survey_description: string
          survey_id: string
          survey_logo_url: string
          survey_primary_color: string
          survey_questions: Json
          survey_thank_you_message: string
          survey_title: string
        }[]
      }
      get_shared_analyses: {
        Args: { p_token: string }
        Returns: {
          analysis_date: string
          created_at: string
          created_by: string
          customer_name: string
          id: string
          lead_source: string
          part_searched: string
          phone: string
          product_line: string
          quantity: number
          sale_status: string
          sale_value: number
        }[]
      }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      get_whatsapp_api_key: { Args: { p_instance_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_internal_conversation_participant: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      is_org_admin_or_owner: { Args: { p_org: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      join_organization_via_invite: {
        Args: { p_invite_code: string; p_user_id: string }
        Returns: boolean
      }
      org_has_feature: {
        Args: { _feature: string; _org_id: string }
        Returns: boolean
      }
      recalculate_goal_progress: {
        Args: { p_goal_id: string }
        Returns: undefined
      }
      save_calendar_as_template: {
        Args: {
          p_calendar_id: string
          p_category?: string
          p_description?: string
          p_icon?: string
          p_scope: string
          p_template_name: string
        }
        Returns: string
      }
      search_contacts_with_filters: {
        Args: {
          p_assignee_id?: string
          p_channel?: string
          p_include_archived?: boolean
          p_limit?: number
          p_organization_id: string
          p_search?: string
          p_status?: string
          p_tag_ids?: string[]
          p_viewer_user_id?: string
        }
        Returns: {
          active_flow_id: string | null
          ai_agent_id: string | null
          ai_enabled: boolean
          assigned_to: string | null
          automations_paused: boolean
          birth_date: string | null
          channel: string
          closed_at: string | null
          created_at: string
          current_node_id: string | null
          deal_notes: string | null
          deal_value: number | null
          email: string | null
          flow_context: Json | null
          flow_paused_until: string | null
          funnel_stage: string
          id: string
          is_archived: boolean
          kanban_column_id: string | null
          last_message_at: string | null
          loss_reason: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string
          pipeline_id: string | null
          profile_picture_url: string | null
          resume_at: string | null
          sale_result: string | null
          sla_alert_sent: boolean
          snoozed_until: string | null
          status: string
          unread_count: number
          updated_at: string
          waiting_response: boolean | null
          waiting_response_timeout: string | null
          win_reason: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "contacts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      seed_financial_defaults: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      sla_is_human_response: {
        Args: {
          m_ai_agent_id: string
          m_direction: string
          m_sent_by_user_id: string
          m_whatsapp_message_id: string
        }
        Returns: boolean
      }
      submit_public_satisfaction_survey: {
        Args: { p_answers: Json; p_rating: number; p_token: string }
        Returns: boolean
      }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      validate_api_key: { Args: { p_key_hash: string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin"
      member_role: "admin" | "analyst" | "viewer"
      org_role: "owner" | "admin" | "member"
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
      app_role: ["super_admin"],
      member_role: ["admin", "analyst", "viewer"],
      org_role: ["owner", "admin", "member"],
    },
  },
} as const
