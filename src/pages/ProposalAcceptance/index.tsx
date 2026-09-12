import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProposalData, ProposalContent } from "@/types/proposals";
import { resolveClientInfo, LiveClientRecord } from "@/utils/proposals/resolveClientInfo";
import { PageLoading } from "@/components/ui/loading-states";
import { ProposalSummarySection } from "./components/ProposalSummarySection";
import { ThirtySecondSummary } from "./components/ThirtySecondSummary";
import { TermsAndConditionsSection } from "./components/TermsAndConditionsSection";
import { SignatureSection } from "./components/SignatureSection";
import {
  ProjectDetailsStep,
  ProjectDetailsValue,
  projectDetailsValid,
} from "./components/ProjectDetailsStep";
import { AcceptingConfirmationStrip } from "./components/AcceptingConfirmationStrip";
import { SignedSuccessScreen } from "./components/SignedSuccessScreen";
import { useToast } from "@/hooks/use-toast";
import { parseEdgeFunctionError, parseEdgeFunctionErrorResponse } from "@/lib/errors/edgeFunctionErrors";
import { AlertTriangle, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProposalAcceptance() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { toast } = useToast();

  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasExistingAgreement, setHasExistingAgreement] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [signatoryName, setSignatoryName] = useState("");
  const [authenticatedSignerName, setAuthenticatedSignerName] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignedSuccess, setShowSignedSuccess] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [clientRecord, setClientRecord] = useState<LiveClientRecord | null>(null);
  const [projectDetails, setProjectDetails] = useState<ProjectDetailsValue>({
    systemAddress: "",
    systemLat: null,
    systemLng: null,
    commissioningDate: "",
    installerCompanyName: "",
    installerEmail: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setIsAuthenticated(!!data.session);
      const userId = data.session?.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .maybeSingle();
      const verifiedName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
      if (verifiedName) {
        setAuthenticatedSignerName(verifiedName);
        setSignatoryName(verifiedName);
      }
    });
  }, []);

  useEffect(() => {
    if (token) {
      // Token-based access (from email link)
      fetchProposalByToken();
    } else if (id) {
      // Authenticated user access (logged in, no token)
      fetchProposalAuthenticated();
    } else {
      setError("Invalid proposal link.");
      setLoading(false);
    }
  }, [id, token]);

  const fetchProposalByToken = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .rpc('get_proposal_by_token_direct', { token_param: token });

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Proposal not found or invitation has expired");
      }

      const rawProposal = data[0];
      
      // Transform the data to match ProposalData type
      const transformedProposal: ProposalData = {
        id: rawProposal.id,
        title: rawProposal.title,
        status: rawProposal.status,
        content: (rawProposal.content as unknown) as ProposalContent,
        created_at: rawProposal.created_at,
        signed_at: rawProposal.signed_at,
        archived_at: rawProposal.archived_at,
        review_later_until: rawProposal.review_later_until,
        client_id: rawProposal.client_id,
        client_reference_id: rawProposal.client_reference_id,
        agent_id: rawProposal.agent_id,
        annual_energy: rawProposal.annual_energy,
        carbon_credits: rawProposal.carbon_credits,
        client_share_percentage: rawProposal.client_share_percentage,
        invitation_token: rawProposal.invitation_token,
        invitation_expires_at: rawProposal.invitation_expires_at,
      };
      
      setProposal(transformedProposal);

      // Fetch live client data and check existing agreement
      if (rawProposal.client_reference_id) {
        await Promise.all([
          fetchClientRecord(rawProposal.client_reference_id),
          resolveAgreementState(rawProposal.id),
        ]);
      }
    } catch (err) {
      console.error("Error fetching proposal by token:", err);
      
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isExpiredError = errorMessage.includes('expired') || 
                             errorMessage.includes('Invalid or expired');
      
      // Check if user is authenticated admin or agent - can fallback to RLS access
      if (isExpiredError && id) {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Check user's role from user_roles table (secure approach)
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);
          
          const hasAgentOrAdminRole = roles?.some(r => 
            r.role === 'admin' || r.role === 'agent'
          );
          
          if (hasAgentOrAdminRole) {
            console.log("Token expired but user is admin/agent, using RLS access");
            setTokenExpired(true);
            // fetchProposalAuthenticated will use RLS to check access
            await fetchProposalAuthenticated();
            return;
          }
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchProposalAuthenticated = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to view this proposal");
      }

      // Query proposal directly (RLS will ensure user has access)
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Proposal not found or you don't have access to it");

      // Transform the data to match ProposalData type
      const transformedProposal: ProposalData = {
        id: data.id,
        title: data.title,
        status: data.status,
        content: (data.content as unknown) as ProposalContent,
        created_at: data.created_at,
        signed_at: data.signed_at,
        archived_at: data.archived_at,
        review_later_until: data.review_later_until,
        client_id: data.client_id,
        client_reference_id: data.client_reference_id,
        agent_id: data.agent_id,
        annual_energy: data.annual_energy,
        carbon_credits: data.carbon_credits,
        client_share_percentage: data.client_share_percentage,
        invitation_token: data.invitation_token,
        invitation_expires_at: data.invitation_expires_at,
      };
      
      setProposal(transformedProposal);

      // Fetch live client data and check existing agreement
      if (data.client_reference_id) {
        await Promise.all([
          fetchClientRecord(data.client_reference_id),
          resolveAgreementState(data.id),
        ]);
      }
    } catch (err) {
      console.error("Error fetching proposal:", err);
      setError(err instanceof Error ? err.message : "Failed to load proposal");
    } finally {
      setLoading(false);
    }
  };

  // Only authenticated viewers (admins/agents/the client) may read `clients`
  // directly. Anonymous token visitors get their details from the proposal
  // content returned by the token RPC — reading the table here just produced
  // 406s on the public signing page.
  const fetchClientRecord = async (clientReferenceId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('clients')
        .select('first_name, last_name, email, phone, company_name, registration_number')
        .eq('id', clientReferenceId)
        .single();

      if (!error && data) {
        setClientRecord(data);
      }
    } catch (err) {
      console.error('Error fetching client record:', err);
    }
  };

  /**
   * Ask the backend what should happen with this proposal. If the client
   * already holds a master cession signature, the backend inherits it,
   * generates this proposal's own document and emails it — no second
   * signing ceremony is ever shown.
   */
  const resolveAgreementState = async (proposalId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'ensure-proposal-agreement',
        { body: { proposalId, token } },
      );
      if (error) throw error;

      const state = (data as { state?: string } | null)?.state;
      if (state === 'inherited' || state === 'existing') {
        setHasExistingAgreement(true);
      }
    } catch (err) {
      console.error('Error resolving agreement state:', err);
    }
  };

  const getClientName = (): string => {
    if (!proposal) return "";
    const resolved = resolveClientInfo(proposal.content?.clientInfo || {}, clientRecord);
    return resolved.name || "";
  };

  /** Company cedents must name the natural person signing on their behalf. */
  const getCompanyName = (): string => {
    if (!proposal) return "";
    const resolved = resolveClientInfo(proposal.content?.clientInfo || {}, clientRecord);
    return (resolved.companyName || "").trim();
  };
  const isCompanyCedent = getCompanyName().length > 0;

  // Prefill with the contact person on record; the client can correct it.
  useEffect(() => {
    if (!signatoryName && !isAuthenticated) {
      const name = getClientName();
      if (name) setSignatoryName(name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal, clientRecord, isAuthenticated]);


  // Referral-sourced proposals require pre-signature project details capture.
  const isReferralProposal = Boolean(
    (proposal?.content as { referral_created?: boolean } | undefined)?.referral_created,
  );
  const projectDetailsOk = !isReferralProposal || projectDetailsValid(projectDetails);

  const signatoryOk = !isCompanyCedent || signatoryName.trim().length >= 2;

  // Drawing a signature is the only accepted signing method.
  const canSubmit =
    hasScrolledToBottom &&
    hasAgreed &&
    projectDetailsOk &&
    signatoryOk &&
    signatureImage !== null;


  const handleSubmit = async () => {
    if (!canSubmit || !proposal) return;

    setIsSubmitting(true);
    try {
      // Get user info for audit trail
      let ipAddress = '';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const { ip } = await ipResponse.json();
        ipAddress = ip;
      } catch (e) {
        console.warn('Failed to get IP address:', e);
      }

      // Refresh session to ensure valid JWT before edge function call
      await supabase.auth.getSession();

      // Call the public Edge Function
      const { data, error } = await supabase.functions.invoke('accept-proposal', {
        body: {
          token: token || undefined,
          proposalId: !token ? proposal.id : undefined,
          // Typing a name is no longer a signing method. The name is still sent
          // (and stored in typed_name) purely as the on-record signatory name,
          // which the PDF, admin signature list and emails read.
          typedName: (signatoryName || getClientName()).trim(),
          signatoryName: (signatoryName || getClientName()).trim() || undefined,
          isCompanyCedent,
          signatureImage: signatureImage || undefined,
          signatureType: 'canvas',

          ipAddress,
          userAgent: navigator.userAgent,
          projectDetails: isReferralProposal ? projectDetails : undefined,
        }
      });

      if (error) throw error;

      if (data?.alreadySigned) {
        toast({
          description: "This proposal has already been signed.",
        });
        setTimeout(() => {
          const redirectUrl = token 
            ? `/proposals/${proposal.id}?token=${token}`
            : `/proposals/${proposal.id}`;
          navigate(redirectUrl);
        }, 1500);
        return;
      }

      if (data?.autoApproved) {
        toast({
          description: "Project successfully added to your existing agreement.",
        });
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
        return;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Signature is recorded — show the completion screen.
      setShowSignedSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (err) {
      console.error("Error submitting agreement:", err);
      const errorResponse = await parseEdgeFunctionErrorResponse(err);
      const errorMessage = await parseEdgeFunctionError(
        err,
        "Failed to submit agreement. Please try again."
      );
      
      toast({
        description: errorMessage,
        variant: "destructive",
      });
      if (errorResponse?.requiresAuthentication) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <PageLoading minimal />;
  }

  // Warning banner for expired token access (admin/agent fallback)
  const ExpiredTokenBanner = () => (
    <div className="container max-w-4xl mx-auto px-4 pt-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <div>
          <p className="text-amber-800 font-medium">Invitation Link Expired</p>
          <p className="text-amber-700 text-sm">
            The client's invitation token has expired. You're viewing this proposal 
            with your account privileges. To send a new working link to the client, 
            regenerate the PDF which will create a fresh token.
          </p>
        </div>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="bg-destructive/10 border border-destructive rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Proposal</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Proposal Not Found</h2>
          <p className="text-muted-foreground">The proposal you're looking for could not be found.</p>
        </div>
      </div>
    );
  }

  if (showSignedSuccess) {
    const resolvedClient = resolveClientInfo(proposal.content?.clientInfo || {}, clientRecord);
    return (
      <SignedSuccessScreen
        proposalId={proposal.id}
        clientEmail={resolvedClient.email || null}
        isAuthenticated={isAuthenticated}
      />
    );
  }

  // Simplified flow for returning clients with existing agreement
  if (hasExistingAgreement) {
    return (
      <>
        {tokenExpired && <ExpiredTokenBanner />}
        <div className="container max-w-4xl mx-auto px-4 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Project Added to Your Agreement</h1>
            <p className="text-muted-foreground">
              You already have a signed Cession Agreement. This project has been automatically added.
            </p>
          </div>

          <div className="space-y-8">
            <ProposalSummarySection proposal={proposal} />
            
            <div className="bg-accent/50 border border-accent rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Automatically Added</h3>
                  <p className="text-muted-foreground mb-4">
                    Per Clause 5.6 of your existing Cession Agreement, new projects are automatically included 
                    without requiring a new signature. This project has been added to your portfolio and is ready 
                    for onboarding.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      View Dashboard
                    </button>
                    <button
                      onClick={() => navigate(`/proposals/${proposal.id}`)}
                      className="px-6 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
                    >
                      View Project Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Original signature flow for new clients
  const scrollToSign = () => {
    const el = document.getElementById("review-and-sign");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {tokenExpired && <ExpiredTokenBanner />}
      <div className="container max-w-4xl mx-auto px-4 py-8 md:py-12 pb-24 md:pb-12">
        <div className="space-y-8">
          <AcceptingConfirmationStrip
            proposal={proposal}
            clientName={getClientName()}
            companyName={isCompanyCedent ? getCompanyName() : null}
          />

          <ThirtySecondSummary
            proposal={proposal}
            clientName={getClientName()}
            onJumpToSign={scrollToSign}
          />

          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Full proposal &amp; Cession Agreement
            </h1>
            <p className="text-muted-foreground">
              Please review the proposal details and terms carefully before
              signing.
            </p>
          </div>

          <ProposalSummarySection proposal={proposal} />

          <TermsAndConditionsSection
            onScrolledToBottom={() => setHasScrolledToBottom(true)}
            proposal={proposal}
          />

          {isReferralProposal && (
            <div id="project-details" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                <h2 className="text-lg font-semibold">Step 1 of 2 — Confirm your project details</h2>
              </div>
              <ProjectDetailsStep
                value={projectDetails}
                onChange={setProjectDetails}
              />
            </div>
          )}

          <div id="review-and-sign" className="scroll-mt-24">
            {isReferralProposal && (
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                <h2 className="text-lg font-semibold">Step 2 of 2 — Review &amp; sign</h2>
              </div>
            )}
            {isReferralProposal && !projectDetailsOk && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-amber-900 font-medium">Before you can sign, please complete your project details above.</p>
                  <p className="text-amber-800 text-sm mt-0.5">We need your system address, commissioning date and installer contact to register the project.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    document.getElementById("project-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Jump to project details
                </Button>
              </div>
            )}
            <SignatureSection
              hasScrolledToBottom={hasScrolledToBottom}
              hasAgreed={hasAgreed}
              onAgreeChange={setHasAgreed}
              signatureImage={signatureImage}
              onSignatureImageChange={setSignatureImage}
              clientName={getClientName()}
              companyName={isCompanyCedent ? getCompanyName() : null}
              signatoryName={signatoryName}
              onSignatoryNameChange={setSignatoryName}
              signatoryNameLocked={Boolean(authenticatedSignerName)}
              canSubmit={canSubmit}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
            />

          </div>
        </div>

      </div>

      {/* Sticky mobile "jump to sign" bar — hidden on md+ and after signing */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3">
        <Button
          type="button"
          className="w-full"
          size="lg"
          onClick={scrollToSign}
        >
          <PenLine className="mr-2 h-4 w-4" />
          Jump to sign
        </Button>
      </div>
    </>
  );
}
