
export interface InvitationRequest {
  proposalId: string;
  clientEmail: string;
  clientName: string;
  invitationToken: string;
  projectName: string;
  clientId?: string;
  agentEmail?: string; // Agent email fetched server-side for CC
  /** Additional clients CC'd on the same invitation email (primary client still signs). */
  ccEmails?: string[];
  /** Display names matching ccEmails, used for logging only. */
  ccNames?: string[];
}

/** Values shown in the "Your proposal in 30 seconds" block. Any field may be absent. */
export interface ProposalSummaryData {
  clientOrCompany?: string;
  siteLocation?: string;
  capacity?: string;
  annualGeneration?: string;
  carbonCredits?: string;
  clientSharePercentage?: number;
  annualIncome?: string;
  termIncome?: string;
  reference?: string;
}

export interface EmailTemplateData {
  clientName: string;
  projectName: string;
  /** Direct signing link — primary CTA. */
  acceptLink: string;
  /** Token-authorised decline confirmation link. */
  declineLink: string;
  /** Full proposal view (secondary text link). */
  viewLink: string;
  tokenPreview: string;
  proposalId: string;
  summary: ProposalSummaryData;
  agentFirstName?: string;
  agentLastName?: string;
  agentCompanyName?: string;
  agentEmail?: string;
}
