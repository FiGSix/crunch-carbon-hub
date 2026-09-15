
import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { useProposalUpdate } from './hooks/useProposalUpdate';
import { useFormValidation } from './hooks/useFormValidation';

export function useRegistrationFormLogic(
  proposalId: string,
  clientEmail: string,
  onComplete: () => void,
  onError?: (errorMessage: string) => void,
  onRegistrationSuccess?: () => void
) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { updateProposalClientId } = useProposalUpdate();
  const { validatePasswords, validateRequired } = useFormValidation();
  
  // Create a contextualized logger
  const registrationLogger = logger.withContext({
    component: 'useRegistrationFormLogic', 
    feature: 'client-auth'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    switch(name) {
      case 'firstName':
        setFirstName(value);
        break;
      case 'lastName':
        setLastName(value);
        break;
      case 'password':
        setPassword(value);
        break;
      case 'confirmPassword':
        setConfirmPassword(value);
        break;
    }
  };

  const validateForm = (): string | null => {
    const firstNameError = validateRequired(firstName, 'First name');
    if (firstNameError) return firstNameError;
    
    const lastNameError = validateRequired(lastName, 'Last name');
    if (lastNameError) return lastNameError;
    
    const passwordError = validatePasswords(password, confirmPassword);
    if (passwordError) return passwordError;
    
    return null;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form inputs
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      if (onError) {
        onError(validationError);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      registrationLogger.info("Starting client registration", { 
        email: clientEmail,
        proposalId
      });
      
      // Phase 5: Create a new user with Supabase Auth, including proposal context
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: clientEmail,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: 'client',
            // Phase 5: Store proposal context in user metadata
            proposal_id: proposalId,
            registration_source: 'proposal_invitation'
          },
          // Phase 5: Set redirect URL to return to proposal after email confirmation
          emailRedirectTo: `${window.location.origin}/auth/callback?type=email&redirect_to=${encodeURIComponent(`/view-proposal/${proposalId}?source=email_verification`)}`
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      // Detect duplicate signup: Supabase returns user with empty identities
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }

      // Once registered, update the proposal's client_id
      if (data?.user) {
        registrationLogger.info("User registered successfully, updating proposal", {
          userId: data.user.id,
          proposalId
        });
        
        // Wait for proposal update to complete
        const updateSuccess = await updateProposalClientId({
          proposalId,
          userId: data.user.id
        });
        
        if (!updateSuccess) {
          registrationLogger.error("Failed to link proposal to user account", {
            userId: data.user.id,
            proposalId
          });
          // Continue anyway - user can still access via client_reference_id
        }

        // Wait for database sync to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        registrationLogger.info("Registration flow complete", {
          step: "proposal_linked",
          success: updateSuccess,
          proposalId,
          userId: data.user.id
        });
        
        // Show success dialog instead of immediate redirect
        if (onRegistrationSuccess) {
          onRegistrationSuccess();
        } else {
          // Fallback to original behavior if no success callback provided
          toast({
            title: "Registration successful!",
            description: "Your account has been created. Please check your email to confirm.",
            variant: "default"
          });
          onComplete();
        }
      }
    } catch (error: any) {
      // Log detailed error information for diagnostics
      registrationLogger.error("Registration error", { 
        message: error.message,
        name: error.name,
        status: error.status,
        code: error.code,
        email: clientEmail
      });
      
      // Handle common errors
      let errorMessage: string;
      if (isEmailRateLimitError(error)) {
        errorMessage = EMAIL_RATE_LIMIT_MESSAGE;
        toast({
          title: EMAIL_RATE_LIMIT_TITLE,
          description: EMAIL_RATE_LIMIT_MESSAGE,
          variant: "destructive"
        });
      } else if (error.message.includes("User already registered")) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
        toast({
          title: "Account exists",
          description: "This email is already registered. Please use the login option instead.",
          variant: "destructive"
        });
      } else if (error.message === "Database error saving new user") {
        errorMessage = "We couldn't create your account due to a temporary issue. Please try again. If you've tried before, tap 'Returning User' to sign in.";
        toast({
          title: "Registration Error",
          description: errorMessage,
          variant: "destructive"
        });
      } else {
        errorMessage = error.message || "Failed to create account. Please try again.";
      }
      
      setError(errorMessage);
      
      // Call the onError callback if provided
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    firstName,
    lastName,
    password,
    confirmPassword,
    loading,
    error,
    handleChange,
    handleSignUp
  };
}
