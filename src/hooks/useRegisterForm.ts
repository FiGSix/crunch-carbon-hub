
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signUp } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { RoleValidationService } from "@/services/auth/RoleValidationService";
import { authLogger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { 
  createCompany, 
  findCompanyByDomain, 
  extractCorporateDomain,
  inviteMember,
  findCompanyByName
} from "@/lib/supabase/company/companyOperations";
import { acceptLegalDocument } from "@/services/legalDocuments";
import {
  isEmailRateLimitError,
  EMAIL_RATE_LIMIT_COOLDOWN_SECONDS,
  EMAIL_RATE_LIMIT_TITLE,
  EMAIL_RATE_LIMIT_MESSAGE,
} from "@/lib/auth/emailRateLimit";

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  role: "client" | "agent";
}

export function useRegisterForm(initialRole: "client" | "agent", invitationToken?: string, prefilledEmail?: string) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invitationLoading, setInvitationLoading] = useState(!!invitationToken);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: "",
    lastName: "",
    email: prefilledEmail ?? "",
    password: "",
    confirmPassword: "",
    companyName: "",
    role: initialRole,
  });
  
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [acceptedDocumentId, setAcceptedDocumentId] = useState<string | null>(null);
  const [acceptedDocumentVersion, setAcceptedDocumentVersion] = useState<number | null>(null);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Count the cool-down down so the button re-enables on its own.
  useEffect(() => {
    if (!rateLimitedUntil) {
      setCooldownSeconds(0);
      return;
    }

    const tick = () => {
      const remaining = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setCooldownSeconds(0);
        setRateLimitedUntil(null);
      } else {
        setCooldownSeconds(remaining);
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [rateLimitedUntil]);

  // Fetch and validate invitation token
  useEffect(() => {
    if (!invitationToken) return;

    const validateInvitation = async () => {
      try {
        // Determine which table to query based on initial role
        // Use 'as any' for client_invitations since types may not be regenerated yet
        const tableName = initialRole === 'client' ? 'client_invitations' : 'agent_invitations';
        
        const { data, error } = await (supabase
          .from(tableName as any)
          .select('*')
          .eq('invitation_token', invitationToken)
          .eq('status', 'pending')
          .single() as any);

        if (error || !data) {
          toast({
            title: "Invalid Invitation",
            description: "This invitation link is invalid or has expired.",
            variant: "destructive",
          });
          navigate('/register');
          return;
        }

        // Check if invitation has expired
        if (new Date(data.expires_at) < new Date()) {
          toast({
            title: "Invitation Expired",
            description: "This invitation link has expired. Please request a new invitation.",
            variant: "destructive",
          });
          navigate('/register');
          return;
        }

        // Pre-fill form with invitation data
        setInvitationData(data);
        setInvitedEmail(data.email);
        setFormData((prev) => ({
          ...prev,
          email: data.email,
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          companyName: data.company_name || "",
          role: initialRole, // Lock role to what the invitation specifies
        }));

        authLogger.info("Invitation validated and form pre-filled", { 
          email: data.email,
          invitationId: data.id,
          role: initialRole,
        });

      } catch (error) {
        console.error("Error validating invitation:", error);
        toast({
          title: "Error",
          description: "Failed to validate invitation. Please try again.",
          variant: "destructive",
        });
      } finally {
        setInvitationLoading(false);
      }
    };

    validateInvitation();
  }, [invitationToken, initialRole, navigate, toast]);
  
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleRoleChange = (value: string) => {
    // Prevent role change if invitation token exists
    if (invitationToken) {
      toast({
        title: "Role Locked",
        description: `You must register as ${initialRole === 'agent' ? 'an agent' : 'a client'} to accept this invitation.`,
        variant: "destructive",
      });
      return;
    }
    authLogger.info("Role changed during registration", { newRole: value });
    setFormData((prev) => ({ ...prev, role: value as "client" | "agent" }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cooldownSeconds > 0) {
      toast({
        title: EMAIL_RATE_LIMIT_TITLE,
        description: EMAIL_RATE_LIMIT_MESSAGE,
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }
    
    if (formData.role === "agent" && !termsAccepted) {
      toast({
        title: "Terms & Conditions Required",
        description: "You must accept the Agent Referral Agreement to continue",
        variant: "destructive",
      });
      return;
    }

    // Validate email match for invited users
    if (invitationToken && invitedEmail) {
      const normalizedFormEmail = formData.email.toLowerCase().trim();
      const normalizedInvitedEmail = invitedEmail.toLowerCase().trim();
      
      if (normalizedFormEmail !== normalizedInvitedEmail) {
        toast({
          title: "Email Mismatch",
          description: `You must register with the email address this invitation was sent to: ${invitedEmail}`,
          variant: "destructive",
        });
        return;
      }
    }
    
    setIsLoading(true);
    
    try {
      authLogger.info("Starting registration process", { 
        email: formData.email, 
        role: formData.role 
      });
      
      // Read stored referral token (set by /ref/:token landing page) so
      // handle_new_user can attribute the signup server-side.
      let refToken: string | null = null;
      try {
        const stored = localStorage.getItem('crunchcarbon_ref');
        if (stored) {
          const parsed = JSON.parse(stored) as { token?: string };
          refToken = parsed?.token ?? null;
        }
      } catch {
        refToken = null;
      }

      const { data, error } = await signUp(
        formData.email,
        formData.password,
        formData.role as 'client' | 'agent' | 'admin',
        {
          first_name: formData.firstName,
          last_name: formData.lastName,
          company_name: formData.companyName || null,
          terms_accepted: formData.role === 'agent' ? termsAccepted : null,
          terms_accepted_at: formData.role === 'agent' && termsAccepted ? new Date().toISOString() : null,
          ...(refToken ? { ref_token: refToken } : {}),
        }
      );
      
      if (error) {
        throw error;
      }
      
      // Track legal document acceptance for agents
      if (formData.role === 'agent' && termsAccepted && acceptedDocumentId && acceptedDocumentVersion && data?.user?.id) {
        try {
          await acceptLegalDocument("agent_referral_agreement", {
            document_id: acceptedDocumentId,
            version: acceptedDocumentVersion,
            metadata: {
              registration_flow: true,
              invitation_token: invitationToken || null,
            },
          });
          authLogger.info("Legal document acceptance tracked", {
            userId: data.user.id,
            documentId: acceptedDocumentId,
            version: acceptedDocumentVersion,
          });
        } catch (acceptanceError) {
          authLogger.error("Failed to track legal document acceptance", {
            userId: data.user.id,
            error: acceptanceError,
          });
          // Don't fail registration if acceptance tracking fails
        }
      }
      
      // Validate role assignment after successful signup
      if (data?.user?.id) {
        authLogger.info("Post-registration role validation starting", { 
          userId: data.user.id,
          expectedRole: formData.role 
        });
        
        // Give the database trigger time to create the profile
        setTimeout(async () => {
          try {
            const validation = await RoleValidationService.validateUserRole(data.user.id);
            
            if (!validation.isValid || validation.mismatchDetected) {
              authLogger.warn("Role validation issue detected after registration", { 
                userId: data.user.id,
                validation 
              });
              
              // Attempt to correct the role
              const correction = await RoleValidationService.correctUserRole(data.user.id);
              
              if (correction.success) {
                authLogger.info("Post-registration role corrected", { 
                  userId: data.user.id,
                  correctedRole: correction.correctedRole 
                });
              } else {
                authLogger.error("Post-registration role correction failed", { 
                  userId: data.user.id,
                  error: correction.error 
                });
              }
            } else {
              authLogger.info("Post-registration role validation successful", { 
                userId: data.user.id,
                detectedRole: validation.detectedRole 
              });
            }
          } catch (validationError) {
            authLogger.error("Post-registration role validation failed", { 
              userId: data.user.id,
              error: validationError 
            });
          }
        }, 2000); // Wait 2 seconds for database trigger to complete
      }
      
      authLogger.info("Registration completed successfully", { 
        email: formData.email,
        role: formData.role 
      });

      // Handle company creation for agents
      if (formData.role === 'agent' && data?.user?.id) {
        try {
          // Priority 1: Use company_id from invitation (if exists)
          if (invitationData?.company_id) {
            authLogger.info("Linking agent to inviter's company", {
              companyId: invitationData.company_id,
              userId: data.user.id
            });
            
            await inviteMember(
              invitationData.company_id, 
              data.user.id, 
              invitationData.invited_by
            );
            
            toast({
              title: "Welcome to the Team!",
              description: "You've been added to your company. A team lead will approve your access.",
            });
          } 
          // Priority 2: Try to find existing company (current logic)
          else if (formData.companyName) {
            const emailDomain = extractCorporateDomain(formData.email);
            
            // Check if company already exists
            let existingCompany = null;
            
            if (emailDomain) {
              // Try to find by domain for corporate emails
              const { data: domainCompany } = await findCompanyByDomain(emailDomain);
              existingCompany = domainCompany;
            } else {
              // For personal emails, try to find by company name
              const { data: nameCompany } = await findCompanyByName(formData.companyName);
              existingCompany = nameCompany;
            }
            
            if (existingCompany) {
              // Company exists - create pending membership request
              authLogger.info("Existing company found, creating pending membership", {
                companyId: existingCompany.id,
                userId: data.user.id
              });
              
              await inviteMember(existingCompany.id, data.user.id, data.user.id);
              
              toast({
                title: "Company Found",
                description: "Your request to join the team has been sent to the team lead for approval.",
              });
            } else {
              // Create new company and make user team lead
              authLogger.info("Creating new company for agent", {
                companyName: formData.companyName,
                emailDomain,
                userId: data.user.id
              });
              
              const { data: companyData, error: companyError } = await createCompany(
                formData.companyName,
                emailDomain,
                data.user.id
              );
              
              if (companyError) {
                authLogger.error("CRITICAL: Failed to create company during registration", {
                  error: companyError,
                  errorMessage: companyError.message,
                  errorCode: companyError.code,
                  errorDetails: companyError.details,
                  errorHint: companyError.hint,
                  companyName: formData.companyName,
                  emailDomain,
                  userId: data.user.id,
                  isRLSError: companyError.message?.includes('row-level security') || companyError.code === '42501'
                });
                
                // Show user-facing error for company creation failure
                toast({
                  title: "Company Setup Warning",
                  description: "Your account was created but company setup failed. Please contact support.",
                  variant: "destructive",
                });
              } else {
                authLogger.info("Company created successfully", {
                  companyName: formData.companyName,
                  companyId: companyData?.company?.id,
                  membershipId: companyData?.membership?.id
                });
              }
            }
          }
        } catch (companyError) {
          authLogger.error("Company setup failed during registration", {
            error: companyError,
            userId: data.user.id
          });
          // Don't fail the registration, just log the error
        }
      }

      // Mark invitation as accepted if token exists
      if (invitationToken && invitationData) {
        try {
          const tableName = formData.role === 'client' ? 'client_invitations' : 'agent_invitations';
          await (supabase
            .from(tableName as any)
            .update({
              status: 'accepted',
              accepted_at: new Date().toISOString(),
            })
            .eq('id', invitationData.id) as any);

          authLogger.info("Invitation marked as accepted", { 
            invitationId: invitationData.id,
            table: tableName,
          });
        } catch (error) {
          authLogger.error("Failed to mark invitation as accepted", { 
            error,
            invitationId: invitationData.id 
          });
        }
      }

      // Track referring agent for agent registrations
      if (formData.role === 'agent' && data?.user?.id) {
        const referralCode = localStorage.getItem('agent_referral_code');
        if (referralCode) {
          try {
            // Store the referring agent in the profiles table notes field
            await supabase
              .from('profiles')
              .update({ 
                notes: `Referred by agent: ${referralCode}` 
              })
              .eq('id', data.user.id);
            
            // Clear the referral code
            localStorage.removeItem('agent_referral_code');
            
            authLogger.info('Referring agent tracked', { 
              newAgentId: data.user.id,
              referringAgentId: referralCode 
            });
          } catch (error) {
            authLogger.error('Failed to track referring agent', { 
              error,
              newAgentId: data.user.id 
            });
            // Don't block registration if tracking fails
          }
        }
      }
      
      // Referral attribution is handled server-side by the handle_new_user trigger
      // (reads ref_token from user metadata). Just clear the stored token.
      if (data?.user?.id) {
        try {
          localStorage.removeItem('crunchcarbon_ref');
        } catch (refErr) {
          authLogger.error('Failed to clear stored referral token', { error: refErr });
        }
      }

      toast({
        title: "Registration successful!",
        description: `Your ${formData.role} account has been created. Please check your email to verify your account.`,
      });
      
      // Redirect to verification page with email parameter
      navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`);
      
    } catch (error: any) {
      // Project-wide hourly cap on auth emails — not a fault with this user's
      // address. Keep them on the form, hold submit briefly, and record it.
      if (isEmailRateLimitError(error)) {
        authLogger.warn("Registration blocked by auth email rate limit", {
          email: formData.email,
          role: formData.role,
          code: error?.code ?? error?.error_code ?? null,
          status: error?.status ?? null,
        });
        setRateLimitedUntil(Date.now() + EMAIL_RATE_LIMIT_COOLDOWN_SECONDS * 1000);
        toast({
          title: EMAIL_RATE_LIMIT_TITLE,
          description: EMAIL_RATE_LIMIT_MESSAGE,
          variant: "destructive",
        });
        return;
      }

      authLogger.error("Registration failed", { 
        email: formData.email,
        role: formData.role,
        error: error.message 
      });
      const isDuplicate = error.message?.includes("already exists");
      toast({
        title: isDuplicate ? "Account already exists" : "Registration failed",
        description: isDuplicate 
          ? "An account with this email already exists. Please log in or reset your password."
          : (error.message || "Please check your information and try again"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTermsAccept = (documentId: string, version: number) => {
    authLogger.info("Terms accepted during registration", { documentId, version });
    setTermsAccepted(true);
    setAcceptedDocumentId(documentId);
    setAcceptedDocumentVersion(version);
    setTermsDialogOpen(false);
  };

  return {
    formData,
    termsAccepted,
    termsDialogOpen,
    privacyDialogOpen,
    isLoading: isLoading || invitationLoading,
    setTermsAccepted,
    setTermsDialogOpen,
    setPrivacyDialogOpen,
    handleChange,
    handleRoleChange,
    handleSubmit,
    handleTermsAccept,
    isInvitationRegistration: !!invitationToken,
    invitedEmail, // Expose invited email for read-only field
    cooldownSeconds, // Seconds left after an email rate-limit refusal
  };
}
