
import { Json } from "@/types/supabase";

/**
 * Base database record structure from Supabase
 * This represents the raw data structure as it exists in the database
 */
export interface ProposalDbRecord {
  id: string;
  created_at: string;
  title: string;
  client_id: string | null;
  client_reference_id: string | null;
  agent_id: string | null;
  status: string;
  content: Json;
  signed_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  review_later_until: string | null;
  invitation_sent_at: string | null;
  invitation_viewed_at: string | null;
  invitation_expires_at: string | null;
  invitation_token: string | null;
  annual_energy: number | null;
  carbon_credits: number | null;
  client_share_percentage: number | null;
  agent_commission_percentage: number | null;
  agent_portfolio_kwp: number | null;
  eligibility_criteria: Json;
  project_info: Json;
}

/**
 * Client and Project information structures
 * These represent the typed structure of the content JSON field
 */
export interface ClientInformation {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  existingClient: boolean;
  address?: string;
  registrationNumber?: string;
}

export interface AdditionalClient {
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  clientId?: string; // If selected from existing clients
}

export type GenerationInputMode = 'kwp' | 'kwh';

/** Map of vintage year -> estimated annual kWh generation. */
export type AnnualKwhByYear = Partial<Record<'2025' | '2026' | '2027' | '2028' | '2029' | '2030', number>>;

export const GENERATION_YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'] as const;

export interface ProjectPhase {
  phaseNumber: number;
  phaseName?: string;
  sizeKWp: number;
  commissionDate: string;
  /** When parent project uses 'kwh' mode, each phase carries its own per-year kWh grid. */
  annualKwhByYear?: AnnualKwhByYear;
}

export interface ProjectInformation {
  name: string;
  address: string;
  addressSource?: 'autocomplete' | 'pin_drop' | 'manual';
  gpsLat?: number;
  gpsLng?: number;
  isMultiPhase: boolean;
  // Legacy fields for single-phase projects
  size: string;
  commissionDate: string;
  // Multi-phase data
  phases?: ProjectPhase[];
  totalSystemSize?: number;
  additionalNotes: string;
  /** Generation input mode. Defaults to 'kwp' for backwards compatibility. */
  generationInputMode?: GenerationInputMode;
  /** When generationInputMode === 'kwh' (single-phase), user-supplied annual kWh per vintage year. */
  annualKwhByYear?: AnnualKwhByYear;
}

export interface EligibilityCriteria {
  inSouthAfrica: boolean;
  notRegistered: boolean;
  under15MWp: boolean;
  commissionedAfter2022: boolean;
  legalOwnership: boolean;
  noGovernmentFunding: boolean;
}

/**
 * Calculation metadata for transparency
 */
export interface CalculationMetadata {
  portfolioBasedPricing: boolean;
  portfolioSize: number;
  calculatedAt: string;
  carbonPricesUsed: Record<string, number>;
}

export interface ProposalContent {
  clientInfo: ClientInformation;
  projectInfo: ProjectInformation;
  additionalClients?: AdditionalClient[];
  portfolioSize?: number; // Store portfolio size for transparency
  revenue?: Record<string, number>; // Legacy field - kept for backward compatibility
  marketRevenue?: Record<string, number>; // Market-rate revenue breakdown
  clientSpecificRevenue?: Record<string, number>; // Client-specific revenue breakdown (what client actually gets)
  agentCommissionRevenue?: Record<string, number>; // Agent commission by year
  crunchCommissionRevenue?: Record<string, number>; // Crunch Carbon commission by year
  calculationMetadata?: CalculationMetadata; // Metadata about how calculations were performed
  financials?: {
    totalClientRevenue?: number; // Total client revenue across all years
  };
}

/**
 * Enriched proposal data for application use
 * This represents the proposal data after processing for use in components
 */
export interface ProposalData {
  id: string;
  title: string;
  status: string;
  content: ProposalContent;
  created_at: string;
  signed_at?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  review_later_until?: string | null;
  client_id?: string | null;
  client_reference_id?: string | null;
  agent_id?: string | null;
  annual_energy?: number | null;
  carbon_credits?: number | null;
  client_share_percentage?: number | null;
  agent_commission_percentage?: number | null;
  agent_portfolio_kwp?: number | null;
  system_size_kwp?: number | null;
  unit_standard?: string | null;
  invitation_token?: string | null;
  invitation_expires_at?: string | null;
  invitation_sent_at?: string | null;
  invitation_viewed_at?: string | null;
  engagement_count?: number | null;
  last_engagement_at?: string | null;
  last_email_event_type?: string | null;
  last_email_sent_at?: string | null;
  automation_paused?: boolean | null;
  automation_pause_reason?: string | null;
  
  // Resolved user_id from clients table for identity matching
  client_reference_user_id?: string | null;
  
  // Live client data from clients table (joined at fetch time)
  client?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    company_name?: string | null;
    registration_number?: string | null;
  } | null;
}

/**
 * Simplified proposal representation for list views
 * Updated to match what's actually used in ProposalList component
 */
export interface ProposalListItem {
  id: string;
  name: string;
  client: string;
  date: string;
  size: number;
  status: string;
  revenue: number;
  created_at: string;
  title: string;
  signed_at?: string | null;
  archived_at?: string | null;
  review_later_until?: string | null;
  client_id?: string | null;
  client_reference_id?: string | null;
  agent_id?: string | null;
  client_name?: string;
  client_email?: string;
  agent_name?: string;
  annual_energy?: number | null;
  carbon_credits?: number | null;
  client_share_percentage?: number | null;
  client_share_override_enabled?: boolean;
  agent_commission_percentage?: number | null;
  agent_portfolio_kwp?: number | null;
  invitation_sent_at?: string | null;
  invitation_viewed_at?: string | null;
  invitation_expires_at?: string | null;
  system_size_kwp?: number | null;
  agent?: string;
  content?: ProposalContent;
  isMultiPhase?: boolean;
  phases?: ProjectPhase[];
  
  // Email engagement tracking
  last_email_event_type?: string | null;
  last_email_sent_at?: string | null;
  engagement_count?: number | null;
  last_engagement_at?: string | null;
  
  // Project onboarding status
  onboarding_complete?: boolean | null;
  submitted_for_review?: boolean | null;
  admin_validated?: boolean | null;
  audit_ready?: boolean | null;
}

/**
 * Interface for the details view components
 */
export interface ProposalDetailsProps {
  proposal: ProposalData;
  token?: string | null;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  isReviewLater?: boolean;
  showActions?: boolean;
}

/**
 * Operation result interfaces
 */
export interface ProposalOperationResult {
  success: boolean;
  error?: string;
  [key: string]: any;
}

/**
 * Form step types
 */
export type FormStep = "eligibility" | "client" | "project" | "summary";

/**
 * Proposal filters for listing
 */
export interface ProposalFilters {
  search: string;
  status: string;
  sort: string;
}

/**
 * Props interface for the proposal list component
 */
export interface ProposalListProps {
  proposals: ProposalListItem[];
  onProposalUpdate?: () => void;
  /** Admin-only bulk selection */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

/**
 * Bulk upload types for Excel-based proposal creation
 */
export interface BulkProposalRow {
  proposal_title: string;
  client_email: string;
  client_first_name: string;
  client_last_name: string;
  client_phone?: string;
  client_company_name?: string;
  project_name: string;
  project_address: string;
  system_size: number;
  system_size_unit: 'kWp' | 'MWp';
  commission_date: string;
  in_south_africa: boolean;
  not_registered: boolean;
  under_15mwp: boolean;
  commissioned_after_2022: boolean;
  legal_ownership: boolean;
  additional_notes?: string;
  assigned_agent_email?: string;
}

export interface BulkUploadResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  failureCount: number;
  errors: Array<{
    row: number;
    data: Partial<BulkProposalRow>;
    error: string;
  }>;
  createdProposalIds: string[];
}

/**
 * Proposal Agreement with signature metadata
 */
export interface ProposalAgreement {
  id: string;
  proposal_id: string;
  signed_by: string;
  typed_name: string;
  signature_type: 'typed_name';
  signed_at: string;
  ip_address: string;
  user_agent: string;
  witness_1_name: string;
  witness_1_verified_at: string;
  witness_2_name: string;
  witness_2_verified_at: string;
  accepted_terms_version: string;
  metadata: {
    signed_via: 'acceptance_link' | 'authenticated_user';
    token_used?: string;
    proposal_id_used?: string;
    timestamp: string;
  };
  signed_pdf_url?: string;
  created_at: string;
}
