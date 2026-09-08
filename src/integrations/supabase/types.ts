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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_activities: {
        Row: {
          activity_data: Json | null
          activity_type: string
          agent_id: string
          created_at: string
          id: string
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          activity_data?: Json | null
          activity_type: string
          agent_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          activity_data?: Json | null
          activity_type?: string
          agent_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_activities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_commissions: {
        Row: {
          agent_id: string
          approved_at: string | null
          approved_by: string | null
          base_rate: number
          calculated_at: string
          commission_amount: number
          commission_status: string | null
          final_rate: number
          id: string
          notes: string | null
          override_rate: number | null
          paid_at: string | null
          proposal_id: string | null
        }
        Insert: {
          agent_id: string
          approved_at?: string | null
          approved_by?: string | null
          base_rate?: number
          calculated_at?: string
          commission_amount?: number
          commission_status?: string | null
          final_rate: number
          id?: string
          notes?: string | null
          override_rate?: number | null
          paid_at?: string | null
          proposal_id?: string | null
        }
        Update: {
          agent_id?: string
          approved_at?: string | null
          approved_by?: string | null
          base_rate?: number
          calculated_at?: string
          commission_amount?: number
          commission_status?: string | null
          final_rate?: number
          id?: string
          notes?: string | null
          override_rate?: number | null
          paid_at?: string | null
          proposal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_commissions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_commissions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposal_engagement_buckets"
            referencedColumns: ["proposal_id"]
          },
          {
            foreignKeyName: "agent_commissions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string | null
          company_name: string | null
          created_at: string | null
          email: string
          expires_at: string
          first_name: string | null
          id: string
          invitation_token: string
          invited_by: string | null
          last_name: string | null
          status: string
          super_partner_id: string | null
          target_company_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          first_name?: string | null
          id?: string
          invitation_token: string
          invited_by?: string | null
          last_name?: string | null
          status?: string
          super_partner_id?: string | null
          target_company_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invitation_token?: string
          invited_by?: string | null
          last_name?: string | null
          status?: string
          super_partner_id?: string | null
          target_company_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_invitations_super_partner_id_fkey"
            columns: ["super_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_invitations_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_leads: {
        Row: {
          company_name: string
          contact_name: string | null
          converted_at: string | null
          converted_invitation_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          last_outreach_at: string | null
          location: string | null
          notes: string | null
          outreach_count: number
          phone: string | null
          source: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          company_name: string
          contact_name?: string | null
          converted_at?: string | null
          converted_invitation_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          last_outreach_at?: string | null
          location?: string | null
          notes?: string | null
          outreach_count?: number
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          company_name?: string
          contact_name?: string | null
          converted_at?: string | null
          converted_invitation_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          last_outreach_at?: string | null
          location?: string | null
          notes?: string | null
          outreach_count?: number
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_leads_converted_invitation_id_fkey"
            columns: ["converted_invitation_id"]
            isOneToOne: false
            referencedRelation: "agent_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_weekly_snapshots: {
        Row: {
          agent_id: string
          audit_ready_mwp: number
          created_at: string
          estimated_commission_2025_2030: number
          estimated_commission_2026: number
          id: string
          new_proposals_count: number
          onboarding_mwp: number
          pending_signature_mwp: number
          signed_this_week_mwp: number
          snapshot_date: string
        }
        Insert: {
          agent_id: string
          audit_ready_mwp?: number
          created_at?: string
          estimated_commission_2025_2030?: number
          estimated_commission_2026?: number
          id?: string
          new_proposals_count?: number
          onboarding_mwp?: number
          pending_signature_mwp?: number
          signed_this_week_mwp?: number
          snapshot_date: string
        }
        Update: {
          agent_id?: string
          audit_ready_mwp?: number
          created_at?: string
          estimated_commission_2025_2030?: number
          estimated_commission_2026?: number
          id?: string
          new_proposals_count?: number
          onboarding_mwp?: number
          pending_signature_mwp?: number
          signed_this_week_mwp?: number
          snapshot_date?: string
        }
        Relationships: []
      }
      broadcast_campaigns: {
        Row: {
          attachments: Json
          audience: Json
          body_html: string
          cancelled_at: string | null
          category: Database["public"]["Enums"]["broadcast_category"]
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          from_email: string
          from_name: string
          id: string
          last_error: string | null
          name: string
          preheader: string | null
          reply_to: string
          sent_count: number
          skipped_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["broadcast_status"]
          subject: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          attachments?: Json
          audience?: Json
          body_html?: string
          cancelled_at?: string | null
          category: Database["public"]["Enums"]["broadcast_category"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          from_email?: string
          from_name?: string
          id?: string
          last_error?: string | null
          name: string
          preheader?: string | null
          reply_to?: string
          sent_count?: number
          skipped_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["broadcast_status"]
          subject: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          attachments?: Json
          audience?: Json
          body_html?: string
          cancelled_at?: string | null
          category?: Database["public"]["Enums"]["broadcast_category"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          from_email?: string
          from_name?: string
          id?: string
          last_error?: string | null
          name?: string
          preheader?: string | null
          reply_to?: string
          sent_count?: number
          skipped_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["broadcast_status"]
          subject?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_excluded_addresses: {
        Row: {
          added_at: string
          added_by: string | null
          email: string
          id: string
          reason: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          email: string
          id?: string
          reason?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          email?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_excluded_addresses_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_preferences: {
        Row: {
          campaign_id: string | null
          category: Database["public"]["Enums"]["broadcast_category"]
          created_at: string
          email: string
          id: string
          opted_out_at: string
          source: string | null
        }
        Insert: {
          campaign_id?: string | null
          category: Database["public"]["Enums"]["broadcast_category"]
          created_at?: string
          email: string
          id?: string
          opted_out_at?: string
          source?: string | null
        }
        Update: {
          campaign_id?: string | null
          category?: Database["public"]["Enums"]["broadcast_category"]
          created_at?: string
          email?: string
          id?: string
          opted_out_at?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_preferences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "broadcast_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_recipients: {
        Row: {
          campaign_id: string
          client_id: string | null
          context: Json
          created_at: string
          email: string
          error: string | null
          id: string
          message_id: string | null
          recipient_name: string | null
          sent_at: string | null
          skip_reason: string | null
          status: Database["public"]["Enums"]["broadcast_recipient_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          client_id?: string | null
          context?: Json
          created_at?: string
          email: string
          error?: string | null
          id?: string
          message_id?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          skip_reason?: string | null
          status?: Database["public"]["Enums"]["broadcast_recipient_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          client_id?: string | null
          context?: Json
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          message_id?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          skip_reason?: string | null
          status?: Database["public"]["Enums"]["broadcast_recipient_status"]
          updated_at?: string
          user_id?: string | null
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
      candidate_notes: {
        Row: {
          author_id: string | null
          author_role: string
          body: string
          candidate_id: string | null
          created_at: string
          id: string
          kind: string
          lead_id: string | null
          mentioned_users: string[] | null
          meta: Json | null
        }
        Insert: {
          author_id?: string | null
          author_role?: string
          body: string
          candidate_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          mentioned_users?: string[] | null
          meta?: Json | null
        }
        Update: {
          author_id?: string | null
          author_role?: string
          body?: string
          candidate_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          mentioned_users?: string[] | null
          meta?: Json | null
        }
        Relationships: []
      }
      carbon_rate_sets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          prices: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          prices?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          prices?: Json
          updated_at?: string
        }
        Relationships: []
      }
      client_access_audit: {
        Row: {
          accessed_at: string
          accessed_by: string
          action: string
          client_ids: string[]
          id: string
          ip_address: unknown
          modified_fields: Json | null
          new_values: Json | null
          old_values: Json | null
          result_count: number
          search_term: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          accessed_by: string
          action: string
          client_ids: string[]
          id?: string
          ip_address?: unknown
          modified_fields?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          result_count?: number
          search_term?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          accessed_by?: string
          action?: string
          client_ids?: string[]
          id?: string
          ip_address?: unknown
          modified_fields?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          result_count?: number
          search_term?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      client_cession_signatures: {
        Row: {
          client_id: string
          created_at: string
          id: string
          ip_address: unknown
          legal_document_file_path: string | null
          legal_document_id: string | null
          legal_document_title: string | null
          legal_document_version: number | null
          metadata: Json
          origin_proposal_id: string | null
          revoked_at: string | null
          signature_image_url: string | null
          signature_type: string
          signed_at: string
          signed_by: string | null
          typed_name: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          legal_document_file_path?: string | null
          legal_document_id?: string | null
          legal_document_title?: string | null
          legal_document_version?: number | null
          metadata?: Json
          origin_proposal_id?: string | null
          revoked_at?: string | null
          signature_image_url?: string | null
          signature_type?: string
          signed_at?: string
          signed_by?: string | null
          typed_name?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          legal_document_file_path?: string | null
          legal_document_id?: string | null
          legal_document_title?: string | null
          legal_document_version?: number | null
          metadata?: Json
          origin_proposal_id?: string | null
          revoked_at?: string | null
          signature_image_url?: string | null
          signature_type?: string
          signed_at?: string
          signed_by?: string | null
          typed_name?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_cession_signatures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_cession_signatures_legal_document_id_fkey"
            columns: ["legal_document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      client_companies: {
        Row: {
          company_name: string
          created_at: string
          created_by: string | null
          email_domain: string | null
          id: string
          registration_number: string | null
          updated_at: string
        }
        Insert: {
          company_name: string
          created_at?: string
          created_by?: string | null
          email_domain?: string | null
          id?: string
          registration_number?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          created_by?: string | null
          email_domain?: string | null
          id?: string
          registration_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_company_members: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          can_sign_agreements: boolean
          client_company_id: string
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          can_sign_agreements?: boolean
          client_company_id: string
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          can_sign_agreements?: boolean
          client_company_id?: string
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_company_members_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "client_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_email_suppressions: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          notes: string | null
          reason: Database["public"]["Enums"]["client_suppression_reason"]
          source: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          notes?: string | null
          reason: Database["public"]["Enums"]["client_suppression_reason"]
          source?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          notes?: string | null
          reason?: Database["public"]["Enums"]["client_suppression_reason"]
          source?: string | null
        }
        Relationships: []
      }
      client_invitations: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          expires_at: string
          first_name: string | null
          id: string
          invitation_token: string
          invited_by: string
          last_name: string | null
          status: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          expires_at: string
          first_name?: string | null
          id?: string
          invitation_token: string
          invited_by: string
          last_name?: string | null
          status?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invitation_token?: string
          invited_by?: string
          last_name?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_referrals: {
        Row: {
          confirmed_at: string | null
          created_at: string
          id: string
          referred_client_id: string | null
          referred_email: string
          referrer_id: string
          status: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          referred_client_id?: string | null
          referred_email: string
          referrer_id: string
          status?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          referred_client_id?: string | null
          referred_email?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_referrals_referred_client_id_fkey"
            columns: ["referred_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_team_invitations: {
        Row: {
          accepted_at: string | null
          client_company_id: string
          created_at: string
          email: string
          expires_at: string
          first_name: string | null
          id: string
          invitation_token: string
          invited_by: string | null
          last_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          client_company_id: string
          created_at?: string
          email: string
          expires_at: string
          first_name?: string | null
          id?: string
          invitation_token: string
          invited_by?: string | null
          last_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          client_company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invitation_token?: string
          invited_by?: string | null
          last_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_team_invitations_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "client_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          carbon_rate_set_id: string | null
          cession_signed_at: string | null
          client_company_id: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          email: string
          first_agreement_id: string | null
          first_name: string | null
          id: string
          last_modified_by: string | null
          last_name: string | null
          notes: string | null
          phone: string | null
          portfolio_client_share_override: number | null
          portfolio_override_set_at: string | null
          portfolio_override_set_by: string | null
          registration_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          carbon_rate_set_id?: string | null
          cession_signed_at?: string | null
          client_company_id?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          first_agreement_id?: string | null
          first_name?: string | null
          id?: string
          last_modified_by?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          portfolio_client_share_override?: number | null
          portfolio_override_set_at?: string | null
          portfolio_override_set_by?: string | null
          registration_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          carbon_rate_set_id?: string | null
          cession_signed_at?: string | null
          client_company_id?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          first_agreement_id?: string | null
          first_name?: string | null
          id?: string
          last_modified_by?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          portfolio_client_share_override?: number | null
          portfolio_override_set_at?: string | null
          portfolio_override_set_by?: string | null
          registration_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_carbon_rate_set_id_fkey"
            columns: ["carbon_rate_set_id"]
            isOneToOne: false
            referencedRelation: "carbon_rate_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "client_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_first_agreement_id_fkey"
            columns: ["first_agreement_id"]
            isOneToOne: false
            referencedRelation: "proposal_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_last_modified_by_fkey"
            columns: ["last_modified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_portfolio_override_set_by_fkey"
            columns: ["portfolio_override_set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          commission_override: number | null
          company_name: string
          created_at: string
          created_by: string | null
          email_domain: string | null
          id: string
          super_partner_id: string | null
          super_partner_linked_at: string | null
          super_partner_linked_by: string | null
          updated_at: string
        }
        Insert: {
          commission_override?: number | null
          company_name: string
          created_at?: string
          created_by?: string | null
          email_domain?: string | null
          id?: string
          super_partner_id?: string | null
          super_partner_linked_at?: string | null
          super_partner_linked_by?: string | null
          updated_at?: string
        }
        Update: {
          commission_override?: number | null
          company_name?: string
          created_at?: string
          created_by?: string | null
          email_domain?: string | null
          id?: string
          super_partner_id?: string | null
          super_partner_linked_at?: string | null
          super_partner_linked_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_super_partner_id_fkey"
            columns: ["super_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_super_partner_linked_by_fkey"
            columns: ["super_partner_linked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          ip_address: unknown
          name: string
          phone: string | null
          question: string
          status: string
          subject: string
          submitted_at: string
          user_agent: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          ip_address?: unknown
          name: string
          phone?: string | null
          question: string
          status?: string
          subject: string
          submitted_at?: string
          user_agent?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          name?: string
          phone?: string | null
          question?: string
          status?: string
          subject?: string
          submitted_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      data_access_config: {
        Row: {
          api_key_encrypted: string | null
          configured_by: string | null
          created_at: string
          credential_method: string
          delegated_email: string | null
          first_data_ingested_at: string | null
          granted_by_email: string | null
          granted_by_role: string | null
          id: string
          last_test_at: string | null
          last_test_error: string | null
          last_test_status: string | null
          portal_url: string | null
          project_id: string
          provider: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string | null
          configured_by?: string | null
          created_at?: string
          credential_method: string
          delegated_email?: string | null
          first_data_ingested_at?: string | null
          granted_by_email?: string | null
          granted_by_role?: string | null
          id?: string
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_status?: string | null
          portal_url?: string | null
          project_id: string
          provider: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string | null
          configured_by?: string | null
          created_at?: string
          credential_method?: string
          delegated_email?: string | null
          first_data_ingested_at?: string | null
          granted_by_email?: string | null
          granted_by_role?: string | null
          id?: string
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_status?: string | null
          portal_url?: string | null
          project_id?: string
          provider?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_access_config_configured_by_fkey"
            columns: ["configured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_access_config_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      email_cta_events: {
        Row: {
          agent_id: string
          clicked_at: string | null
          created_at: string
          cta_type: string | null
          email_send_id: string | null
          email_type: string
          id: string
          ip_address: unknown
          message_id: string | null
          opened_at: string | null
          raw_payload: Json | null
          sent_at: string | null
          subject: string | null
          target_url: string | null
          user_agent: string | null
          variant: string | null
        }
        Insert: {
          agent_id: string
          clicked_at?: string | null
          created_at?: string
          cta_type?: string | null
          email_send_id?: string | null
          email_type?: string
          id?: string
          ip_address?: unknown
          message_id?: string | null
          opened_at?: string | null
          raw_payload?: Json | null
          sent_at?: string | null
          subject?: string | null
          target_url?: string | null
          user_agent?: string | null
          variant?: string | null
        }
        Update: {
          agent_id?: string
          clicked_at?: string | null
          created_at?: string
          cta_type?: string | null
          email_send_id?: string | null
          email_type?: string
          id?: string
          ip_address?: unknown
          message_id?: string | null
          opened_at?: string | null
          raw_payload?: Json | null
          sent_at?: string | null
          subject?: string | null
          target_url?: string | null
          user_agent?: string | null
          variant?: string | null
        }
        Relationships: []
      }
      email_events: {
        Row: {
          bounce_reason: string | null
          broadcast_recipient_id: string | null
          click_url: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: unknown
          message_id: string
          occurred_at: string
          processed_at: string | null
          proposal_id: string | null
          raw_payload: Json
          recipient_email: string
          status_update_triggered: boolean | null
          subject: string | null
          user_agent: string | null
        }
        Insert: {
          bounce_reason?: string | null
          broadcast_recipient_id?: string | null
          click_url?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: unknown
          message_id: string
          occurred_at: string
          processed_at?: string | null
          proposal_id?: string | null
          raw_payload?: Json
          recipient_email: string
          status_update_triggered?: boolean | null
          subject?: string | null
          user_agent?: string | null
        }
        Update: {
          bounce_reason?: string | null
          broadcast_recipient_id?: string | null
          click_url?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          message_id?: string
          occurred_at?: string
          processed_at?: string | null
          proposal_id?: string | null
          raw_payload?: Json
          recipient_email?: string
          status_update_triggered?: boolean | null
          subject?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_broadcast_recipient_id_fkey"
            columns: ["broadcast_recipient_id"]
            isOneToOne: false
            referencedRelation: "broadcast_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposal_engagement_buckets"
            referencedColumns: ["proposal_id"]
          },
          {
            foreignKeyName: "email_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          confidence: number | null
          conversation_id: string | null
          created_at: string
          enrollment_id: string | null
          from_email: string
          from_name: string | null
          graph_message_id: string
          headers: Json | null
          id: string
          intent: string | null
          lead_id: string | null
          processed_at: string | null
          received_at: string
          subject: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          from_email: string
          from_name?: string | null
          graph_message_id: string
          headers?: Json | null
          id?: string
          intent?: string | null
          lead_id?: string | null
          processed_at?: string | null
          received_at?: string
          subject?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          from_email?: string
          from_name?: string | null
          graph_message_id?: string
          headers?: Json | null
          id?: string
          intent?: string | null
          lead_id?: string | null
          processed_at?: string | null
          received_at?: string
          subject?: string | null
        }
        Relationships: []
      }
      inverter_portal_defaults: {
        Row: {
          brand: string
          created_at: string
          notes: string | null
          portal_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand: string
          created_at?: string
          notes?: string | null
          portal_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand?: string
          created_at?: string
          notes?: string | null
          portal_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      knowledge_hub_resources: {
        Row: {
          category: string
          created_at: string
          description: string | null
          download_count: number
          file_name: string
          file_size_bytes: number | null
          file_url: string
          id: string
          is_published: boolean
          mime_type: string | null
          tags: string[] | null
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          download_count?: number
          file_name: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          is_published?: boolean
          mime_type?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          download_count?: number
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          is_published?: boolean
          mime_type?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      legal_document_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          document_id: string
          id: string
          ip_address: unknown
          metadata: Json | null
          user_agent: string | null
          user_id: string
          version: number
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          document_id: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id: string
          version: number
        }
        Update: {
          accepted_at?: string
          created_at?: string
          document_id?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          current_version: number
          document_type: string
          effective_date: string
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          id: string
          is_active: boolean
          is_live: boolean
          metadata: Json | null
          set_live_at: string | null
          set_live_by: string | null
          source_file_path: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          document_type: string
          effective_date: string
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          is_active?: boolean
          is_live?: boolean
          metadata?: Json | null
          set_live_at?: string | null
          set_live_by?: string | null
          source_file_path?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          document_type?: string
          effective_date?: string
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          is_active?: boolean
          is_live?: boolean
          metadata?: Json | null
          set_live_at?: string | null
          set_live_by?: string | null
          source_file_path?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          candidate_id: string | null
          created_at: string
          created_by: string | null
          duration_min: number
          enrollment_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          raw_confirmation_message_id: string | null
          scheduled_at: string
          source: string
          status: string
          teams_join_url: string | null
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number
          enrollment_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          raw_confirmation_message_id?: string | null
          scheduled_at: string
          source?: string
          status?: string
          teams_join_url?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number
          enrollment_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          raw_confirmation_message_id?: string | null
          scheduled_at?: string
          source?: string
          status?: string
          teams_join_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_raw_confirmation_message_id_fkey"
            columns: ["raw_confirmation_message_id"]
            isOneToOne: false
            referencedRelation: "inbound_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_state: {
        Row: {
          event_key: string
          last_count: number | null
          last_sent_at: string | null
          meta: Json | null
          updated_at: string
        }
        Insert: {
          event_key: string
          last_count?: number | null
          last_sent_at?: string | null
          meta?: Json | null
          updated_at?: string
        }
        Update: {
          event_key?: string
          last_count?: number | null
          last_sent_at?: string | null
          meta?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          related_id?: string | null
          related_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_activity_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          mentioned_users: string[] | null
          new_value: string | null
          old_value: string | null
          project_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          mentioned_users?: string[] | null
          new_value?: string | null
          old_value?: string | null
          project_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          mentioned_users?: string[] | null
          new_value?: string | null
          old_value?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          edited_by: string | null
          id: string
          mentioned_users: string[] | null
          parent_comment_id: string | null
          project_id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          edited_by?: string | null
          id?: string
          mentioned_users?: string[] | null
          parent_comment_id?: string | null
          project_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          edited_by?: string | null
          id?: string
          mentioned_users?: string[] | null
          parent_comment_id?: string | null
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_comments_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "onboarding_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_documents: {
        Row: {
          category: string
          file_name: string
          file_size_bytes: number | null
          file_url: string
          id: string
          is_validated: boolean | null
          metadata: Json | null
          mime_type: string | null
          project_id: string
          replaces_doc_id: string | null
          uploaded_at: string
          uploaded_by: string
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          version: number
        }
        Insert: {
          category: string
          file_name: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          is_validated?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          project_id: string
          replaces_doc_id?: string | null
          uploaded_at?: string
          uploaded_by: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          version?: number
        }
        Update: {
          category?: string
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          is_validated?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          project_id?: string
          replaces_doc_id?: string | null
          uploaded_at?: string
          uploaded_by?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_onboarding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_documents_replaces_doc_id_fkey"
            columns: ["replaces_doc_id"]
            isOneToOne: false
            referencedRelation: "onboarding_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_documents_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_fields: {
        Row: {
          alternative_power_source: string | null
          battery_brand: string | null
          battery_capacity_kwh: number | null
          battery_cost: number | null
          battery_model: string | null
          battery_serial: string | null
          commissioning_date: string | null
          connection_type: string | null
          created_at: string
          data_collector_present: string | null
          data_collector_serial: string | null
          has_battery: boolean | null
          has_maintenance_agreement: boolean | null
          id: string
          installer_company_name: string | null
          installer_email: string | null
          installer_id: string | null
          inverter_brand: string | null
          inverter_capacity_kw: number | null
          inverter_cost: number | null
          inverter_model: string | null
          inverter_quantity: number | null
          inverter_serial: string | null
          labor_cost: number | null
          maintenance_agreement_term_years: number | null
          maintenance_cost_annual: number | null
          meter_serial: string | null
          meter_type: string | null
          ownership_type: string | null
          panel_brand: string | null
          panel_cost: number | null
          panel_quantity: number | null
          panel_size_wp: number | null
          panel_total_kwp: number | null
          phases_json: Json | null
          project_id: string
          system_address: string | null
          system_gps_lat: number | null
          system_gps_lng: number | null
          system_name: string | null
          total_capex: number | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          alternative_power_source?: string | null
          battery_brand?: string | null
          battery_capacity_kwh?: number | null
          battery_cost?: number | null
          battery_model?: string | null
          battery_serial?: string | null
          commissioning_date?: string | null
          connection_type?: string | null
          created_at?: string
          data_collector_present?: string | null
          data_collector_serial?: string | null
          has_battery?: boolean | null
          has_maintenance_agreement?: boolean | null
          id?: string
          installer_company_name?: string | null
          installer_email?: string | null
          installer_id?: string | null
          inverter_brand?: string | null
          inverter_capacity_kw?: number | null
          inverter_cost?: number | null
          inverter_model?: string | null
          inverter_quantity?: number | null
          inverter_serial?: string | null
          labor_cost?: number | null
          maintenance_agreement_term_years?: number | null
          maintenance_cost_annual?: number | null
          meter_serial?: string | null
          meter_type?: string | null
          ownership_type?: string | null
          panel_brand?: string | null
          panel_cost?: number | null
          panel_quantity?: number | null
          panel_size_wp?: number | null
          panel_total_kwp?: number | null
          phases_json?: Json | null
          project_id: string
          system_address?: string | null
          system_gps_lat?: number | null
          system_gps_lng?: number | null
          system_name?: string | null
          total_capex?: number | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          alternative_power_source?: string | null
          battery_brand?: string | null
          battery_capacity_kwh?: number | null
          battery_cost?: number | null
          battery_model?: string | null
          battery_serial?: string | null
          commissioning_date?: string | null
          connection_type?: string | null
          created_at?: string
          data_collector_present?: string | null
          data_collector_serial?: string | null
          has_battery?: boolean | null
          has_maintenance_agreement?: boolean | null
          id?: string
          installer_company_name?: string | null
          installer_email?: string | null
          installer_id?: string | null
          inverter_brand?: string | null
          inverter_capacity_kw?: number | null
          inverter_cost?: number | null
          inverter_model?: string | null
          inverter_quantity?: number | null
          inverter_serial?: string | null
          labor_cost?: number | null
          maintenance_agreement_term_years?: number | null
          maintenance_cost_annual?: number | null
          meter_serial?: string | null
          meter_type?: string | null
          ownership_type?: string | null
          panel_brand?: string | null
          panel_cost?: number | null
          panel_quantity?: number | null
          panel_size_wp?: number | null
          panel_total_kwp?: number | null
          phases_json?: Json | null
          project_id?: string
          system_address?: string | null
          system_gps_lat?: number | null
          system_gps_lng?: number | null
          system_name?: string | null
          total_capex?: number | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_fields_installer_id_fkey"
            columns: ["installer_id"]
            isOneToOne: false
            referencedRelation: "solar_installers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_fields_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_onboarding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_fields_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          category: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          related_doc_category: string | null
          related_field: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          related_doc_category?: string | null
          related_field?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          related_doc_category?: string | null
          related_field?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_api_keys: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string | null
          environment: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          partner_id: string
          rate_limit_per_day: number | null
          rate_limit_per_minute: number | null
          request_count: number | null
          scopes: Json
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          partner_id: string
          rate_limit_per_day?: number | null
          rate_limit_per_minute?: number | null
          request_count?: number | null
          scopes?: Json
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          partner_id?: string
          rate_limit_per_day?: number | null
          rate_limit_per_minute?: number | null
          request_count?: number | null
          scopes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "partner_api_keys_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_api_logs: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          duration_ms: number | null
          id: string
          ip_address: unknown
          method: string
          partner_id: string | null
          path: string
          request_body_sanitized: Json | null
          request_id: string
          response_body: Json | null
          status_code: number
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          ip_address?: unknown
          method: string
          partner_id?: string | null
          path: string
          request_body_sanitized?: Json | null
          request_id: string
          response_body?: Json | null
          status_code: number
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          ip_address?: unknown
          method?: string
          partner_id?: string | null
          path?: string
          request_body_sanitized?: Json | null
          request_id?: string
          response_body?: Json | null
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "partner_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_api_logs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_invitations: {
        Row: {
          accepted_at: string | null
          company_name: string
          contact_name: string | null
          created_at: string | null
          email: string
          environment: string
          expires_at: string
          id: string
          invitation_token: string
          invited_by: string | null
          notes: string | null
          partner_id: string | null
          requested_scopes: Json | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          email: string
          environment?: string
          expires_at: string
          id?: string
          invitation_token: string
          invited_by?: string | null
          notes?: string | null
          partner_id?: string | null
          requested_scopes?: Json | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string
          environment?: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by?: string | null
          notes?: string | null
          partner_id?: string | null
          requested_scopes?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_invitations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_webhook_deliveries: {
        Row: {
          attempt: number | null
          created_at: string | null
          event: string
          id: string
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          response_time_ms: number | null
          sent_at: string | null
          status: string
          webhook_id: string
        }
        Insert: {
          attempt?: number | null
          created_at?: string | null
          event: string
          id?: string
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          response_status?: number | null
          response_time_ms?: number | null
          sent_at?: string | null
          status?: string
          webhook_id: string
        }
        Update: {
          attempt?: number | null
          created_at?: string | null
          event?: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          response_time_ms?: number | null
          sent_at?: string | null
          status?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "partner_webhook_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_webhook_subscriptions: {
        Row: {
          consecutive_failures: number | null
          created_at: string | null
          disabled_at: string | null
          disabled_reason: string | null
          events: string[]
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          last_triggered_at: string | null
          partner_id: string
          signing_secret_encrypted: string
          url: string
          verified_at: string | null
        }
        Insert: {
          consecutive_failures?: number | null
          created_at?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          events: string[]
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_triggered_at?: string | null
          partner_id: string
          signing_secret_encrypted: string
          url: string
          verified_at?: string | null
        }
        Update: {
          consecutive_failures?: number | null
          created_at?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          events?: string[]
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_triggered_at?: string | null
          partner_id?: string
          signing_secret_encrypted?: string
          url?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_webhook_subscriptions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          contact_email: string
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          support_email: string | null
          updated_at: string | null
        }
        Insert: {
          contact_email: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          support_email?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_email?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          support_email?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_level: string | null
          agent_status: string | null
          avatar_url: string | null
          can_create_proposals: boolean
          commission_override: number | null
          company_logo_url: string | null
          company_name: string | null
          created_at: string
          deleted_at: string | null
          email: string
          first_name: string | null
          id: string
          intro_video_viewed: boolean | null
          intro_video_viewed_at: string | null
          join_date: string | null
          last_active_at: string | null
          last_name: string | null
          license_number: string | null
          notes: string | null
          onboarding_completed: boolean | null
          phone: string | null
          recruit_default_commission: number | null
          referral_bio: string | null
          referred_by_agent_id: string | null
          referred_by_link_id: string | null
          role: string
          sp_commission_override: number | null
          status_changed_at: string | null
          status_changed_by: string | null
          super_partner_commission_rate: number | null
          super_partner_status: string | null
          terms_accepted_at: string | null
          territory: string | null
          updated_at: string | null
        }
        Insert: {
          access_level?: string | null
          agent_status?: string | null
          avatar_url?: string | null
          can_create_proposals?: boolean
          commission_override?: number | null
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          first_name?: string | null
          id: string
          intro_video_viewed?: boolean | null
          intro_video_viewed_at?: string | null
          join_date?: string | null
          last_active_at?: string | null
          last_name?: string | null
          license_number?: string | null
          notes?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          recruit_default_commission?: number | null
          referral_bio?: string | null
          referred_by_agent_id?: string | null
          referred_by_link_id?: string | null
          role: string
          sp_commission_override?: number | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          super_partner_commission_rate?: number | null
          super_partner_status?: string | null
          terms_accepted_at?: string | null
          territory?: string | null
          updated_at?: string | null
        }
        Update: {
          access_level?: string | null
          agent_status?: string | null
          avatar_url?: string | null
          can_create_proposals?: boolean
          commission_override?: number | null
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          intro_video_viewed?: boolean | null
          intro_video_viewed_at?: string | null
          join_date?: string | null
          last_active_at?: string | null
          last_name?: string | null
          license_number?: string | null
          notes?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          recruit_default_commission?: number | null
          referral_bio?: string | null
          referred_by_agent_id?: string | null
          referred_by_link_id?: string | null
          role?: string
          sp_commission_override?: number | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          super_partner_commission_rate?: number | null
          super_partner_status?: string | null
          terms_accepted_at?: string | null
          territory?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_agent_id_fkey"
            columns: ["referred_by_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_link_id_fkey"
            columns: ["referred_by_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_status_changed_by_fkey"
            columns: ["status_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_onboarding: {
        Row: {
          admin_validated: boolean | null
          admin_validated_at: string | null
          admin_validated_by: string | null
          assigned_epc_id: string | null
          audit_ready: boolean
          audit_ready_marked_at: string | null
          audit_ready_marked_by: string | null
          created_at: string
          data_access_verified: boolean
          data_access_verified_at: string | null
          id: string
          last_activity_at: string | null
          last_followup_at: string | null
          last_followup_by: string | null
          last_followup_recipients: string[] | null
          last_modified_by: string | null
          onboarding_complete: boolean
          onboarding_completed_at: string | null
          proposal_id: string
          submitted_by: string | null
          submitted_for_review: boolean | null
          submitted_for_review_at: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          admin_validated?: boolean | null
          admin_validated_at?: string | null
          admin_validated_by?: string | null
          assigned_epc_id?: string | null
          audit_ready?: boolean
          audit_ready_marked_at?: string | null
          audit_ready_marked_by?: string | null
          created_at?: string
          data_access_verified?: boolean
          data_access_verified_at?: string | null
          id?: string
          last_activity_at?: string | null
          last_followup_at?: string | null
          last_followup_by?: string | null
          last_followup_recipients?: string[] | null
          last_modified_by?: string | null
          onboarding_complete?: boolean
          onboarding_completed_at?: string | null
          proposal_id: string
          submitted_by?: string | null
          submitted_for_review?: boolean | null
          submitted_for_review_at?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          admin_validated?: boolean | null
          admin_validated_at?: string | null
          admin_validated_by?: string | null
          assigned_epc_id?: string | null
          audit_ready?: boolean
          audit_ready_marked_at?: string | null
          audit_ready_marked_by?: string | null
          created_at?: string
          data_access_verified?: boolean
          data_access_verified_at?: string | null
          id?: string
          last_activity_at?: string | null
          last_followup_at?: string | null
          last_followup_by?: string | null
          last_followup_recipients?: string[] | null
          last_modified_by?: string | null
          onboarding_complete?: boolean
          onboarding_completed_at?: string | null
          proposal_id?: string
          submitted_by?: string | null
          submitted_for_review?: boolean | null
          submitted_for_review_at?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_onboarding_assigned_epc_id_fkey"
            columns: ["assigned_epc_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_onboarding_audit_ready_marked_by_fkey"
            columns: ["audit_ready_marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_onboarding_last_modified_by_fkey"
            columns: ["last_modified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_onboarding_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposal_engagement_buckets"
            referencedColumns: ["proposal_id"]
          },
          {
            foreignKeyName: "project_onboarding_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_agreements: {
        Row: {
          accepted_terms_version: string
          client_cession_signature_id: string | null
          created_at: string
          generated_at: string | null
          id: string
          ip_address: unknown
          legal_document_id: string | null
          legal_document_version: number | null
          metadata: Json | null
          pdf_path: string | null
          proposal_id: string
          signature_image_url: string | null
          signature_type: Database["public"]["Enums"]["signature_type"]
          signature_type_used: string | null
          signed_at: string
          signed_by: string
          signed_pdf_url: string | null
          typed_name: string | null
          user_agent: string | null
          witness_1_ip_address: unknown
          witness_1_name: string | null
          witness_1_verified_at: string | null
          witness_2_ip_address: unknown
          witness_2_name: string | null
          witness_2_verified_at: string | null
          witness_method: string | null
        }
        Insert: {
          accepted_terms_version?: string
          client_cession_signature_id?: string | null
          created_at?: string
          generated_at?: string | null
          id?: string
          ip_address?: unknown
          legal_document_id?: string | null
          legal_document_version?: number | null
          metadata?: Json | null
          pdf_path?: string | null
          proposal_id: string
          signature_image_url?: string | null
          signature_type?: Database["public"]["Enums"]["signature_type"]
          signature_type_used?: string | null
          signed_at?: string
          signed_by: string
          signed_pdf_url?: string | null
          typed_name?: string | null
          user_agent?: string | null
          witness_1_ip_address?: unknown
          witness_1_name?: string | null
          witness_1_verified_at?: string | null
          witness_2_ip_address?: unknown
          witness_2_name?: string | null
          witness_2_verified_at?: string | null
          witness_method?: string | null
        }
        Update: {
          accepted_terms_version?: string
          client_cession_signature_id?: string | null
          created_at?: string
          generated_at?: string | null
          id?: string
          ip_address?: unknown
          legal_document_id?: string | null
          legal_document_version?: number | null
          metadata?: Json | null
          pdf_path?: string | null
          proposal_id?: string
          signature_image_url?: string | null
          signature_type?: Database["public"]["Enums"]["signature_type"]
          signature_type_used?: string | null
          signed_at?: string
          signed_by?: string
          signed_pdf_url?: string | null
          typed_name?: string | null
          user_agent?: string | null
          witness_1_ip_address?: unknown
          witness_1_name?: string | null
          witness_1_verified_at?: string | null
          witness_2_ip_address?: unknown
          witness_2_name?: string | null
          witness_2_verified_at?: string | null
          witness_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_agreements_client_cession_signature_id_fkey"
            columns: ["client_cession_signature_id"]
            isOneToOne: false
            referencedRelation: "client_cession_signatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_agreements_legal_document_id_fkey"
            columns: ["legal_document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_agreements_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposal_engagement_buckets"
            referencedColumns: ["proposal_id"]
          },
          {
            foreignKeyName: "proposal_agreements_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_automation_log: {
        Row: {
          automation_type: string
          created_at: string
          created_by: string | null
          details: Json | null
          email_message_id: string | null
          email_type: string | null
          id: string
          new_status: string | null
          old_status: string | null
          proposal_id: string
          trigger_event: string | null
        }
        Insert: {
          automation_type: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          email_message_id?: string | null
          email_type?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          proposal_id: string
          trigger_event?: string | null
        }
        Update: {
          automation_type?: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          email_message_id?: string | null
          email_type?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          proposal_id?: string
          trigger_event?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_automation_log_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposal_engagement_buckets"
            referencedColumns: ["proposal_id"]
          },
          {
            foreignKeyName: "proposal_automation_log_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_clients: {
        Row: {
          added_at: string
          added_by: string
          client_id: string
          id: string
          invitation_expires_at: string | null
          invitation_sent_at: string | null
          invitation_token: string | null
          invitation_viewed_at: string | null
          proposal_id: string
          signed_at: string | null
        }
        Insert: {
          added_at?: string
          added_by: string
          client_id: string
          id?: string
          invitation_expires_at?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          invitation_viewed_at?: string | null
          proposal_id: string
          signed_at?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string
          client_id?: string
          id?: string
          invitation_expires_at?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          invitation_viewed_at?: string | null
          proposal_id?: string
          signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_clients_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposal_engagement_buckets"
            referencedColumns: ["proposal_id"]
          },
          {
            foreignKeyName: "proposal_clients_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_duplicate_reviews: {
        Row: {
          created_at: string
          decision_reason: string | null
          id: string
          match_reasons: string[]
          match_score: number
          matched_proposal_id: string
          proposed_address: string | null
          proposed_client_id: string | null
          proposed_commissioning_date: string | null
          proposed_payload: Json
          proposed_system_size_kwp: number | null
          proposed_title: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          submitting_agent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision_reason?: string | null
          id?: string
          match_reasons?: string[]
          match_score?: number
          matched_proposal_id: string
          proposed_address?: string | null
          proposed_client_id?: string | null
          proposed_commissioning_date?: string | null
          proposed_payload?: Json
          proposed_system_size_kwp?: number | null
          proposed_title: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          submitting_agent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision_reason?: string | null
          id?: string
          match_reasons?: string[]
          match_score?: number
          matched_proposal_id?: string
          proposed_address?: string | null
          proposed_client_id?: string | null
          proposed_commissioning_date?: string | null
          proposed_payload?: Json
          proposed_system_size_kwp?: number | null
          proposed_title?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          submitting_agent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_duplicate_reviews_matched_proposal_id_fkey"
            columns: ["matched_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposal_engagement_buckets"
            referencedColumns: ["proposal_id"]
          },
          {
            foreignKeyName: "proposal_duplicate_reviews_matched_proposal_id_fkey"
            columns: ["matched_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          agent_commission_percentage: number | null
          agent_id: string | null
          agent_portfolio_kwp: number | null
          annual_energy: number | null
          archived_at: string | null
          archived_by: string | null
          audit_ready: boolean
          automation_pause_reason: string | null
          automation_paused: boolean | null
          carbon_credits: number | null
          client_id: string | null
          client_portfolio_kwp: number | null
          client_reference_id: string | null
          client_share_override_enabled: boolean | null
          client_share_override_set_at: string | null
          client_share_override_set_by: string | null
          client_share_percentage: number | null
          company_id: string | null
          consent_obtained_at: string | null
          consent_source: string | null
          content: Json
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          duplicate_review_id: string | null
          eligibility_criteria: Json
          engagement_count: number | null
          id: string
          invitation_expires_at: string | null
          invitation_sent_at: string | null
          invitation_token: string | null
          invitation_viewed_at: string | null
          last_email_event_type: string | null
          last_email_sent_at: string | null
          last_engagement_at: string | null
          last_modified_by: string | null
          lead_id: string | null
          partner_id: string | null
          partner_reference_id: string | null
          pdf_generated_at: string | null
          pdf_url: string | null
          pdf_version: number | null
          platform_fee_override: boolean | null
          platform_fee_percentage: number | null
          project_info: Json
          review_later_until: string | null
          signed_at: string | null
          source: string
          status: string
          super_partner_commission_percentage: number | null
          super_partner_id: string | null
          system_size_kwp: number | null
          title: string
          unit_standard: string | null
          updated_at: string | null
        }
        Insert: {
          agent_commission_percentage?: number | null
          agent_id?: string | null
          agent_portfolio_kwp?: number | null
          annual_energy?: number | null
          archived_at?: string | null
          archived_by?: string | null
          audit_ready?: boolean
          automation_pause_reason?: string | null
          automation_paused?: boolean | null
          carbon_credits?: number | null
          client_id?: string | null
          client_portfolio_kwp?: number | null
          client_reference_id?: string | null
          client_share_override_enabled?: boolean | null
          client_share_override_set_at?: string | null
          client_share_override_set_by?: string | null
          client_share_percentage?: number | null
          company_id?: string | null
          consent_obtained_at?: string | null
          consent_source?: string | null
          content?: Json
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          duplicate_review_id?: string | null
          eligibility_criteria?: Json
          engagement_count?: number | null
          id?: string
          invitation_expires_at?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          invitation_viewed_at?: string | null
          last_email_event_type?: string | null
          last_email_sent_at?: string | null
          last_engagement_at?: string | null
          last_modified_by?: string | null
          lead_id?: string | null
          partner_id?: string | null
          partner_reference_id?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          pdf_version?: number | null
          platform_fee_override?: boolean | null
          platform_fee_percentage?: number | null
          project_info?: Json
          review_later_until?: string | null
          signed_at?: string | null
          source?: string
          status?: string
          super_partner_commission_percentage?: number | null
          super_partner_id?: string | null
          system_size_kwp?: number | null
          title?: string
          unit_standard?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_commission_percentage?: number | null
          agent_id?: string | null
          agent_portfolio_kwp?: number | null
          annual_energy?: number | null
          archived_at?: string | null
          archived_by?: string | null
          audit_ready?: boolean
          automation_pause_reason?: string | null
          automation_paused?: boolean | null
          carbon_credits?: number | null
          client_id?: string | null
          client_portfolio_kwp?: number | null
          client_reference_id?: string | null
          client_share_override_enabled?: boolean | null
          client_share_override_set_at?: string | null
          client_share_override_set_by?: string | null
          client_share_percentage?: number | null
          company_id?: string | null
          consent_obtained_at?: string | null
          consent_source?: string | null
          content?: Json
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          duplicate_review_id?: string | null
          eligibility_criteria?: Json
          engagement_count?: number | null
          id?: string
          invitation_expires_at?: string | null
          invitation_sent_at?: string | null
          invitation_token?: string | null
          invitation_viewed_at?: string | null
          last_email_event_type?: string | null
          last_email_sent_at?: string | null
          last_engagement_at?: string | null
          last_modified_by?: string | null
          lead_id?: string | null
          partner_id?: string | null
          partner_reference_id?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          pdf_version?: number | null
          platform_fee_override?: boolean | null
          platform_fee_percentage?: number | null
          project_info?: Json
          review_later_until?: string | null
          signed_at?: string | null
          source?: string
          status?: string
          super_partner_commission_percentage?: number | null
          super_partner_id?: string | null
          system_size_kwp?: number | null
          title?: string
          unit_standard?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_client_reference_id_fkey"
            columns: ["client_reference_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_client_share_override_set_by_fkey"
            columns: ["client_share_override_set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_duplicate_review_id_fkey"
            columns: ["duplicate_review_id"]
            isOneToOne: false
            referencedRelation: "proposal_duplicate_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_last_modified_by_fkey"
            columns: ["last_modified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "agent_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_super_partner_id_fkey"
            columns: ["super_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          referral_link_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          referral_link_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          referral_link_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          clicks: number
          conversions: number
          created_at: string
          id: string
          is_active: boolean
          link_type: string
          owner_id: string
          signups: number
          token: string
        }
        Insert: {
          clicks?: number
          conversions?: number
          created_at?: string
          id?: string
          is_active?: boolean
          link_type: string
          owner_id: string
          signups?: number
          token?: string
        }
        Update: {
          clicks?: number
          conversions?: number
          created_at?: string
          id?: string
          is_active?: boolean
          link_type?: string
          owner_id?: string
          signups?: number
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_solar_yields: {
        Row: {
          id: string
          province: string
          source: string | null
          updated_at: string
          updated_by: string | null
          yield_kwh_per_kwp: number
        }
        Insert: {
          id?: string
          province: string
          source?: string | null
          updated_at?: string
          updated_by?: string | null
          yield_kwh_per_kwp: number
        }
        Update: {
          id?: string
          province?: string
          source?: string | null
          updated_at?: string
          updated_by?: string | null
          yield_kwh_per_kwp?: number
        }
        Relationships: []
      }
      solar_installers: {
        Row: {
          address: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      super_partner_commissions: {
        Row: {
          agent_id: string
          approved_at: string | null
          approved_by: string | null
          calculated_at: string
          commission_amount: number
          commission_rate: number
          commission_status: string | null
          id: string
          notes: string | null
          paid_at: string | null
          proposal_id: string | null
          super_partner_id: string
        }
        Insert: {
          agent_id: string
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string
          commission_amount?: number
          commission_rate?: number
          commission_status?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          proposal_id?: string | null
          super_partner_id: string
        }
        Update: {
          agent_id?: string
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string
          commission_amount?: number
          commission_rate?: number
          commission_status?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          proposal_id?: string | null
          super_partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_partner_commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_partner_commissions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_partner_commissions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposal_engagement_buckets"
            referencedColumns: ["proposal_id"]
          },
          {
            foreignKeyName: "super_partner_commissions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_partner_commissions_super_partner_id_fkey"
            columns: ["super_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      super_partner_link_requests: {
        Row: {
          company_id: string
          id: string
          notes: string | null
          request_type: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          super_partner_id: string
        }
        Insert: {
          company_id: string
          id?: string
          notes?: string | null
          request_type: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          super_partner_id: string
        }
        Update: {
          company_id?: string
          id?: string
          notes?: string | null
          request_type?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          super_partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_partner_link_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_partner_link_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_partner_link_requests_super_partner_id_fkey"
            columns: ["super_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          first_name: string | null
          id: string
          invitation_token: string
          invited_by: string | null
          last_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at: string
          first_name?: string | null
          id?: string
          invitation_token: string
          invited_by?: string | null
          last_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invitation_token?: string
          invited_by?: string | null
          last_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_audit: {
        Row: {
          action: string
          created_at: string | null
          id: string
          performed_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          performed_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          performed_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vintage_audit_status: {
        Row: {
          id: string
          stage_id: string
          status: string
          updated_at: string | null
          updated_by: string | null
          vintage_year: string
        }
        Insert: {
          id?: string
          stage_id: string
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          vintage_year: string
        }
        Update: {
          id?: string
          stage_id?: string
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          vintage_year?: string
        }
        Relationships: []
      }
      vintage_progress_notes: {
        Row: {
          id: string
          notes: string | null
          updated_at: string | null
          updated_by: string | null
          vintage_year: string
        }
        Insert: {
          id?: string
          notes?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vintage_year: string
        }
        Update: {
          id?: string
          notes?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vintage_year?: string
        }
        Relationships: []
      }
    }
    Views: {
      learning_metrics: {
        Row: {
          agent_touch_to_sign_pct: number | null
          archived_count: number | null
          avg_days_to_sign: number | null
          cold_count: number | null
          cold_revenue: number | null
          dead_count: number | null
          dead_revenue: number | null
          hot_count: number | null
          hot_revenue: number | null
          inactive_count: number | null
          median_days_to_sign: number | null
          signed_count: number | null
          signed_last_30d: number | null
          signed_last_90d: number | null
          signed_revenue: number | null
          stale_rate_pct: number | null
          total_active: number | null
          total_signed: number | null
          viewed_unsigned_avg_age_days: number | null
          viewed_unsigned_count: number | null
          warm_count: number | null
          warm_revenue: number | null
        }
        Relationships: []
      }
      portfolio_reminder_candidates: {
        Row: {
          agent_id: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          combined_revenue: number | null
          company_id: string | null
          eligible_for_email: boolean | null
          hot_count: number | null
          last_engagement_at: string | null
          last_portfolio_reminder_at: string | null
          proposal_ids: string[] | null
          route_to_agent: boolean | null
          unsigned_count: number | null
          warm_count: number | null
        }
        Relationships: []
      }
      proposal_engagement_buckets: {
        Row: {
          agent_id: string | null
          archived_at: string | null
          automation_paused: boolean | null
          bucket: string | null
          client_id: string | null
          client_reference_id: string | null
          company_id: string | null
          days_since_engagement: number | null
          days_since_sent: number | null
          engagement_count: number | null
          estimated_client_revenue: number | null
          invitation_sent_at: string | null
          invitation_viewed_at: string | null
          last_email_event_type: string | null
          last_email_sent_at: string | null
          last_engagement_at: string | null
          proposal_id: string | null
          signed_at: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          agent_id?: string | null
          archived_at?: string | null
          automation_paused?: boolean | null
          bucket?: never
          client_id?: string | null
          client_reference_id?: string | null
          company_id?: string | null
          days_since_engagement?: never
          days_since_sent?: never
          engagement_count?: number | null
          estimated_client_revenue?: never
          invitation_sent_at?: string | null
          invitation_viewed_at?: string | null
          last_email_event_type?: string | null
          last_email_sent_at?: string | null
          last_engagement_at?: string | null
          proposal_id?: string | null
          signed_at?: string | null
          status?: string | null
          title?: string | null
        }
        Update: {
          agent_id?: string | null
          archived_at?: string | null
          automation_paused?: boolean | null
          bucket?: never
          client_id?: string | null
          client_reference_id?: string | null
          company_id?: string | null
          days_since_engagement?: never
          days_since_sent?: never
          engagement_count?: number | null
          estimated_client_revenue?: never
          invitation_sent_at?: string | null
          invitation_viewed_at?: string | null
          last_email_event_type?: string | null
          last_email_sent_at?: string | null
          last_engagement_at?: string | null
          proposal_id?: string | null
          signed_at?: string | null
          status?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_client_reference_id_fkey"
            columns: ["client_reference_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_link_person_to_company: {
        Args: {
          _company_id: string
          _company_kind: string
          _is_client_record?: boolean
          _person_id: string
          _role?: string
        }
        Returns: Json
      }
      admin_unlink_person_from_company: {
        Args: { _is_client_record?: boolean; _person_id: string }
        Returns: Json
      }
      agent_has_proposals_with_client: {
        Args: { client_id_param: string }
        Returns: boolean
      }
      apply_referral_on_signup: {
        Args: { p_new_user_id: string; p_token: string }
        Returns: undefined
      }
      apply_sp_default_to_recruits: {
        Args: { p_super_partner_id: string }
        Returns: number
      }
      archive_proposal: {
        Args: { proposal_id: string; user_id: string }
        Returns: boolean
      }
      auth_user_id: { Args: never; Returns: string }
      auth_user_role: { Args: never; Returns: string }
      backfill_super_partner_commissions: {
        Args: { p_super_partner_id: string }
        Returns: number
      }
      broadcast_project_stage: {
        Args: {
          p_admin_validated: boolean
          p_audit_ready: boolean
          p_data_access_verified: boolean
          p_onboarding_complete: boolean
          p_submitted_for_review: boolean
        }
        Returns: string
      }
      can_send_client_email: {
        Args: { p_cooldown_days?: number; p_email: string }
        Returns: boolean
      }
      can_transition_proposal_status: {
        Args: {
          current_status: string
          is_automated?: boolean
          new_status: string
        }
        Returns: boolean
      }
      can_view_proposal: {
        Args: {
          proposal_agent_id: string
          proposal_client_id: string
          proposal_client_reference_id: string
          proposal_deleted_at: string
          proposal_invitation_expires_at: string
          proposal_invitation_token: string
        }
        Returns: boolean
      }
      check_proposal_duplicates: {
        Args: {
          p_address: string
          p_client_email: string
          p_commissioning_date: string
          p_partner_id: string
        }
        Returns: {
          created_at: string
          partner_reference_id: string
          proposal_id: string
          status: string
        }[]
      }
      classify_proposal_engagement: {
        Args: { _proposal_id: string }
        Returns: string
      }
      create_agent_user: {
        Args: {
          access_level_param?: string
          agent_status_param?: string
          commission_override_param?: number
          company_name_param?: string
          email_param: string
          first_name_param: string
          last_name_param: string
          license_number_param?: string
          phone_param?: string
          territory_param?: string
        }
        Returns: string
      }
      create_test_user_profile: {
        Args: {
          email_param: string
          first_name_param?: string
          last_name_param?: string
          role_param: string
          user_id_param: string
        }
        Returns: string
      }
      decide_proposal_duplicate_review: {
        Args: { p_decision: string; p_reason: string; p_review_id: string }
        Returns: undefined
      }
      delete_proposal: {
        Args: { proposal_id: string; user_id: string }
        Returns: boolean
      }
      email_domain_of: { Args: { email_addr: string }; Returns: string }
      ensure_agent_has_company: {
        Args: { p_agent_id: string }
        Returns: string
      }
      extract_corporate_domain: {
        Args: { email_param: string }
        Returns: string
      }
      extract_domain: {
        Args: { _email: string; _website: string }
        Returns: string
      }
      find_high_confidence_proposal_duplicate: {
        Args: {
          p_address: string
          p_client_id: string
          p_exclude_proposal_id?: string
          p_latitude?: number
          p_longitude?: number
          p_system_size_kwp: number
          p_title: string
        }
        Returns: {
          match_reasons: string[]
          match_score: number
          proposal_id: string
        }[]
      }
      find_or_create_client_by_email: {
        Args: {
          p_company_name: string
          p_created_by: string
          p_email: string
          p_first_name: string
          p_last_name: string
          p_phone: string
        }
        Returns: string
      }
      find_or_create_client_for_partner_api: {
        Args: {
          p_company_name: string
          p_email: string
          p_first_name: string
          p_last_name: string
          p_partner_id: string
          p_phone: string
        }
        Returns: string
      }
      format_system_size_for_display: {
        Args: { preferred_unit?: string; size_kwp: number }
        Returns: string
      }
      generate_secure_token: { Args: never; Returns: string }
      get_agent_by_email: {
        Args: { email_param: string }
        Returns: {
          agent_status: string
          commission_override: number
          email: string
          first_name: string
          id: string
          last_name: string
        }[]
      }
      get_agent_clients: {
        Args: { agent_id_param?: string }
        Returns: {
          agent_id: string
          agent_name: string
          client_email: string
          client_id: string
          client_name: string
          company_name: string
          created_at: string
          is_registered: boolean
          project_count: number
          total_mwp: number
        }[]
      }
      get_agent_clients_count: {
        Args: { agent_id_param?: string; search_param?: string }
        Returns: number
      }
      get_agent_clients_optimized: {
        Args: { agent_id_param?: string }
        Returns: {
          client_email: string
          client_id: string
          client_name: string
          company_name: string
          created_at: string
          is_registered: boolean
          project_count: number
          total_mwp: number
        }[]
      }
      get_agent_clients_paginated: {
        Args: {
          agent_id_param?: string
          limit_param?: number
          offset_param?: number
          search_param?: string
        }
        Returns: {
          client_company_id: string
          client_email: string
          client_id: string
          client_name: string
          company_name: string
          created_at: string
          has_profile: boolean
          is_registered: boolean
          portfolio_client_share_override: number
          project_count: number
          total_mwp: number
        }[]
      }
      get_agent_clients_paginated_admin: {
        Args: {
          agent_id_param?: string
          limit_param?: number
          offset_param?: number
          search_param?: string
        }
        Returns: {
          agent_company_name: string
          agent_id: string
          client_company_id: string
          client_email: string
          client_id: string
          client_name: string
          company_name: string
          created_at: string
          has_profile: boolean
          is_active: boolean
          is_registered: boolean
          portfolio_client_share_override: number
          project_count: number
          total_mwp: number
        }[]
      }
      get_agent_dashboard_stats: {
        Args: { agent_id_param: string }
        Returns: {
          active_proposals: number
          signed_proposals: number
          total_carbon_credits: number
          total_clients: number
          total_proposals: number
          total_revenue: number
        }[]
      }
      get_agents_management_counts: {
        Args: never
        Returns: {
          active: number
          invited: number
          pending_approval: number
          total: number
        }[]
      }
      get_agents_management_data: {
        Args: {
          limit_param?: number
          offset_param?: number
          search_term?: string
          status_filter?: string
        }
        Returns: {
          access_level: string
          active_proposals: number
          agent_email: string
          agent_id: string
          agent_name: string
          agent_status: string
          commission_override: number
          company_commission_override: number
          company_id: string
          company_name: string
          company_signed_kwp: number
          invitation_expires_at: string
          invitation_id: string
          invitation_token: string
          invited_by_email: string
          is_invitation: boolean
          join_date: string
          last_active_at: string
          onboarding_completed: boolean
          portfolio_size_kwp: number
          signed_proposals: number
          total_commission: number
          total_count: number
          total_proposals: number
        }[]
      }
      get_client_company_member_profiles: {
        Args: { _company_id: string; _requesting_user_id: string }
        Returns: {
          avatar_url: string
          email: string
          first_name: string
          last_name: string
          user_id: string
        }[]
      }
      get_client_email: { Args: never; Returns: string }
      get_client_user_company_id: {
        Args: { user_id_param: string }
        Returns: string
      }
      get_company_member_profiles: {
        Args: { _company_id: string; _requesting_user_id: string }
        Returns: {
          avatar_url: string
          email: string
          first_name: string
          last_name: string
          user_id: string
        }[]
      }
      get_current_user_role: { Args: never; Returns: string }
      get_dashboard_metrics_by_stage: {
        Args: { p_user_id?: string; p_user_role?: string }
        Returns: {
          audit_ready_mwp: number
          audit_ready_revenue: number
          audit_review_requests: number
          onboarding_mwp: number
          onboarding_revenue: number
          pending_approval_mwp: number
          pending_approval_revenue: number
        }[]
      }
      get_dashboard_stats_optimized: {
        Args: { user_id_param: string; user_role_param: string }
        Returns: {
          active_proposals: number
          portfolio_size_kwp: number
          signed_proposals: number
          total_carbon_credits: number
          total_proposals: number
          total_revenue: number
        }[]
      }
      get_data_access_status: {
        Args: { project_id_param: string }
        Returns: {
          configured_by: string
          created_at: string
          credential_method: string
          first_data_ingested_at: string
          has_credentials: boolean
          id: string
          last_test_at: string
          last_test_error: string
          last_test_status: string
          portal_url: string
          project_id: string
          provider: string
          site_id: string
          updated_at: string
        }[]
      }
      get_live_legal_document: {
        Args: { p_document_type: string }
        Returns: {
          content: string
          current_version: number
          document_type: string
          effective_date: string
          file_mime: string
          file_path: string
          id: string
          set_live_at: string
          title: string
        }[]
      }
      get_minimum_vintage_year: { Args: never; Returns: number }
      get_partner_attribution: {
        Args: { p_partner_id: string }
        Returns: {
          logo_url: string
          partner_name: string
          support_email: string
        }[]
      }
      get_partner_network_counts: {
        Args: never
        Returns: {
          approved: number
          awaiting_approval: number
          commercially_active_30d: number
          invited_not_registered: number
          total: number
        }[]
      }
      get_pending_team_invitations: {
        Args: { company_id_param: string }
        Returns: {
          company_id: string
          created_at: string
          email: string
          expires_at: string
          first_name: string
          id: string
          invitation_token: string
          invited_by: string
          inviter_name: string
          last_name: string
          status: string
        }[]
      }
      get_primary_role: { Args: { _user_id: string }; Returns: string }
      get_project_step_status: {
        Args: { proposal_id_param: string }
        Returns: {
          audit_ready_status: string
          cession_status: string
          data_access_status: string
          onboarding_status: string
        }[]
      }
      get_proposal_by_token: {
        Args: { token_param: string }
        Returns: {
          agent_id: string
          archived_at: string
          client_contact_id: string
          client_email: string
          client_id: string
          content: Json
          created_at: string
          id: string
          invitation_expires_at: string
          invitation_token: string
          is_preview: boolean
          preview_of_id: string
          review_later_until: string
          signed_at: string
          status: string
          title: string
        }[]
      }
      get_proposal_by_token_direct: {
        Args: { token_param: string }
        Returns: {
          agent_commission_percentage: number
          agent_id: string
          annual_energy: number
          archived_at: string
          carbon_credits: number
          client_email: string
          client_id: string
          client_reference_id: string
          client_share_percentage: number
          content: Json
          created_at: string
          id: string
          invitation_expires_at: string
          invitation_token: string
          is_preview: boolean
          preview_of_id: string
          review_later_until: string
          signed_at: string
          status: string
          system_size_kwp: number
          title: string
        }[]
      }
      get_public_homeowner_stats: {
        Args: never
        Returns: {
          co2_offset_tons: number
          homeowner_count: number
          signed_proposal_count: number
          total_system_kwp: number
        }[]
      }
      get_referral_partner_info: { Args: { p_token: string }; Returns: Json }
      get_super_partner_commission_by_company: {
        Args: never
        Returns: {
          amount: number
          company: string
          mwp: number
          rate: number
        }[]
      }
      get_super_partner_commission_ledger: {
        Args: never
        Returns: {
          agent_email: string
          agent_name: string
          calculated_at: string
          client_name: string
          commission_amount: number
          commission_rate: number
          commission_status: string
          id: string
          notes: string
          paid_at: string
          proposal_id: string
          proposal_title: string
          signed_at: string
          system_size_kwp: number
        }[]
      }
      get_super_partner_companies: {
        Args: { p_super_partner_id?: string }
        Returns: {
          active_member_count: number
          company_id: string
          company_name: string
          members: Json
          super_partner_linked_at: string
          total_signed_mwp: number
        }[]
      }
      get_super_partner_dashboard_stats: {
        Args: never
        Returns: {
          aggregated_mwp: number
          current_rate: number
          paid_commission: number
          pending_commission: number
          total_agents: number
        }[]
      }
      get_super_partner_rate: {
        Args: { p_super_partner_id: string }
        Returns: number
      }
      get_unsigned_cession_clients: {
        Args: never
        Returns: {
          client_email: string
          client_id: string
          client_name: string
          proposal_count: number
        }[]
      }
      get_user_client_company_client_ids: { Args: never; Returns: string[] }
      get_user_client_ids: { Args: never; Returns: string[] }
      get_user_company_id: { Args: { user_id_param: string }; Returns: string }
      get_user_role: { Args: never; Returns: string }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      has_accepted_latest_version: {
        Args: { p_document_type: string; p_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_proposal_engagement: {
        Args: { event_type: string; proposal_id: string }
        Returns: undefined
      }
      is_client_account_admin: {
        Args: { company_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_client_company_member: {
        Args: { company_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_client_email_suppressed: {
        Args: { p_email: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { company_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_current_user_agent: { Args: never; Returns: boolean }
      is_current_user_client_account_admin: { Args: never; Returns: boolean }
      is_placeholder_company_name: { Args: { _name: string }; Returns: boolean }
      is_project_stakeholder: {
        Args: { _project_id: string }
        Returns: boolean
      }
      is_proposal_client: {
        Args: { proposal_client_reference_id: string }
        Returns: boolean
      }
      is_super_partner: { Args: { _user_id: string }; Returns: boolean }
      is_team_lead: {
        Args: { company_id_param: string; user_id_param: string }
        Returns: boolean
      }
      log_client_access: {
        Args: {
          action_param: string
          client_ids_param: string[]
          result_count_param?: number
          search_term_param?: string
        }
        Returns: undefined
      }
      log_referral_conversion: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      mark_invitation_viewed: {
        Args: { token_param: string }
        Returns: undefined
      }
      merge_client_companies: {
        Args: { _drop_id: string; _keep_id: string }
        Returns: undefined
      }
      normalize_company_name: { Args: { _name: string }; Returns: string }
      normalize_project_identity: { Args: { value: string }; Returns: string }
      normalize_system_size_to_kwp: {
        Args: { size_value: number; unit_type?: string }
        Returns: number
      }
      queue_proposal_duplicate_review: {
        Args: {
          p_address: string
          p_agent_id: string
          p_client_id: string
          p_commissioning_date: string
          p_latitude?: number
          p_longitude?: number
          p_payload?: Json
          p_system_size_kwp: number
          p_title: string
        }
        Returns: Json
      }
      recalc_proposal_platform_fee: {
        Args: { p_proposal_id: string }
        Returns: undefined
      }
      recalc_super_partner_rates: {
        Args: { p_super_partner_id: string }
        Returns: number
      }
      recalculate_proposal_client_shares: {
        Args: never
        Returns: {
          agent_portfolio_kwp: number
          client_portfolio_kwp: number
          new_share: number
          old_share: number
          proposal_id: string
        }[]
      }
      request_company_link: { Args: { p_company_id: string }; Returns: string }
      resolve_broadcast_audience: {
        Args: { p_audience: Json }
        Returns: {
          client_id: string
          context: Json
          email: string
          excluded_by_default: boolean
          flags: Json
          recipient_name: string
          user_id: string
        }[]
      }
      resolve_broadcast_audience_raw: {
        Args: { p_audience: Json }
        Returns: {
          client_id: string
          context: Json
          email: string
          recipient_name: string
          self_authored: boolean
          source: string
          user_id: string
        }[]
      }
      resolve_client_company: {
        Args: {
          p_company_name: string
          p_created_by?: string
          p_email?: string
        }
        Returns: string
      }
      resolve_client_company_id: {
        Args: { _client_company_id: string; _user_id: string }
        Returns: string
      }
      resolve_client_company_name: {
        Args: {
          _client_company_id: string
          _fallback: string
          _user_id: string
        }
        Returns: string
      }
      search_clients: {
        Args: { search_term: string }
        Returns: {
          company: string
          email: string
          id: string
          is_registered: boolean
          name: string
        }[]
      }
      search_clients_optimized: {
        Args: {
          agent_id_param?: string
          limit_param?: number
          search_term: string
        }
        Returns: {
          company: string
          email: string
          id: string
          is_registered: boolean
          name: string
          relevance_score: number
        }[]
      }
      search_proposals_optimized: {
        Args: {
          limit_param?: number
          offset_param?: number
          search_term?: string
          status_filter?: string
          user_id_param: string
          user_role_param: string
        }
        Returns: {
          agent_id: string
          carbon_credits: number
          client_id: string
          client_reference_id: string
          created_at: string
          id: string
          invitation_sent_at: string
          invitation_viewed_at: string
          status: string
          system_size_kwp: number
          title: string
        }[]
      }
      set_legal_document_live: {
        Args: { p_document_id: string }
        Returns: {
          content: string
          created_at: string
          created_by: string | null
          current_version: number
          document_type: string
          effective_date: string
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          id: string
          is_active: boolean
          is_live: boolean
          metadata: Json | null
          set_live_at: string | null
          set_live_by: string | null
          source_file_path: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "legal_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_request_invitation_token:
        | {
            Args: { email_input: string; token_input: string }
            Returns: undefined
          }
        | { Args: { token: string }; Returns: boolean }
      test_rls_policies: {
        Args: never
        Returns: {
          operation: string
          result: string
          role: string
          success: boolean
          table_name: string
          test_name: string
        }[]
      }
      update_partner_api_key_usage: {
        Args: { p_api_key_id: string }
        Returns: undefined
      }
      update_proposal_status_with_log: {
        Args: {
          is_automated?: boolean
          new_status: string
          proposal_id: string
          trigger_event?: string
        }
        Returns: boolean
      }
      upgrade_agent_to_super_partner: {
        Args: { p_agent_id: string }
        Returns: undefined
      }
      user_client_company_ids: {
        Args: { user_id_param: string }
        Returns: {
          client_company_id: string
        }[]
      }
      user_company_ids: {
        Args: { user_id_param: string }
        Returns: {
          company_id: string
        }[]
      }
      validate_invitation_token: {
        Args: { token: string }
        Returns: {
          client_email: string
          client_id: string
          client_reference_id: string
          proposal_id: string
        }[]
      }
      validate_onboarding_completion: {
        Args: { project_id_param: string }
        Returns: boolean
      }
      validate_partner_api_key: {
        Args: { p_api_key_prefix: string }
        Returns: {
          api_key_hash: string
          api_key_id: string
          environment: string
          is_active: boolean
          partner_id: string
          partner_name: string
          rate_limit_per_day: number
          rate_limit_per_minute: number
          scopes: Json
        }[]
      }
      validate_token_direct: {
        Args: { token_param: string }
        Returns: {
          client_email: string
          client_id: string
          client_reference_id: string
          is_valid: boolean
          proposal_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "agent" | "client" | "super_partner"
      broadcast_category: "operational" | "opportunity" | "newsletter"
      broadcast_recipient_status:
        | "pending"
        | "sent"
        | "failed"
        | "skipped_suppressed"
        | "skipped_opted_out"
      broadcast_status: "draft" | "sending" | "sent" | "cancelled" | "failed"
      client_suppression_reason:
        | "manual"
        | "bounce"
        | "complaint"
        | "unsubscribe"
        | "fatigue"
        | "invalid"
      signature_type:
        | "typed_name"
        | "electronic_signature"
        | "manual"
        | "legacy_import"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "agent", "client", "super_partner"],
      broadcast_category: ["operational", "opportunity", "newsletter"],
      broadcast_recipient_status: [
        "pending",
        "sent",
        "failed",
        "skipped_suppressed",
        "skipped_opted_out",
      ],
      broadcast_status: ["draft", "sending", "sent", "cancelled", "failed"],
      client_suppression_reason: [
        "manual",
        "bounce",
        "complaint",
        "unsubscribe",
        "fatigue",
        "invalid",
      ],
      signature_type: [
        "typed_name",
        "electronic_signature",
        "manual",
        "legacy_import",
      ],
    },
  },
} as const
