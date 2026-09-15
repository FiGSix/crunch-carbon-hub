/**
 * Professional proposal submission form with invisible reliability
 * Provides seamless user experience with background processing
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EligibilityCriteria, ClientInformation, ProjectInformation, AdditionalClient } from "@/types/proposals";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ReliableProposalService, ProposalProgress } from "@/services/proposals/ReliableProposalService";
import { devLogger } from '@/lib/performance/ConsoleReplacementUtility';

interface ProposalSubmitFormReliableProps {
  eligibility: EligibilityCriteria;
  clientInfo: ClientInformation;
  projectInfo: ProjectInformation;
  nextStep: () => void;
  prevStep: () => void;
  selectedClientId?: string | null;
  additionalClients?: AdditionalClient[];
}

export function ProposalSubmitFormReliable({ 
  eligibility, 
  clientInfo, 
  projectInfo, 
  nextStep, 
  prevStep,
  selectedClientId,
  additionalClients
}: ProposalSubmitFormReliableProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<ProposalProgress | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasError, setHasError] = useState(false);

  const proposalService = ReliableProposalService.getInstance();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create a proposal",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    setProgress({ stage: 'validating', progress: 5, message: 'Starting proposal creation...' });
    
    try {
      const proposalTitle = projectInfo.name || `Solar Project for ${clientInfo.name}`;
      
      const result = await proposalService.createProposalReliably(
        proposalTitle,
        user.id,
        eligibility,
        projectInfo,
        clientInfo,
        selectedClientId || undefined,
        setProgress,
        additionalClients
      );
      
      if (result.success && result.proposalId) {
        // Success!
        setIsCompleted(true);
        toast({
          title: "Proposal Created Successfully",
          description: selectedClientId 
            ? "Your proposal has been created for the selected client."
            : "Your proposal has been created and a new client profile has been set up automatically.",
        });
        
        setTimeout(() => navigate('/proposals'), 1000);
      } else {
        throw new Error(result.error || "Failed to create proposal");
      }
      
    } catch (error) {
      devLogger.proposals.error("Error in proposal submission", error);
      setIsSubmitting(false);
      setProgress(null);
      setHasError(true);
      
      const message = error instanceof Error ? error.message : "";
      const isRuleBreach = message === SELF_AS_CLIENT_MESSAGE;

      toast({
        title: isRuleBreach ? "You cannot be your own client" : "Proposal Creation Failed",
        description: isRuleBreach
          ? SELF_AS_CLIENT_MESSAGE
          : "We encountered an issue creating your proposal. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = () => {
    if (isCompleted) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (hasError) return <AlertTriangle className="h-4 w-4 text-red-600" />;
    return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
  };

  const getStatusMessage = () => {
    if (isCompleted) return "Proposal created successfully!";
    if (hasError) return "Failed to create proposal";
    if (progress) return progress.message;
    return "Creating proposal...";
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {!selectedClientId && clientInfo.name && !isSubmitting && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            A new client profile will be created for <strong>{clientInfo.name}</strong> ({clientInfo.email})
            {clientInfo.companyName && ` from ${clientInfo.companyName}`}.
          </AlertDescription>
        </Alert>
      )}

      {/* Progress Display */}
      {isSubmitting && (
        <Alert className={`border ${isCompleted ? 'border-green-200 bg-green-50' : hasError ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <AlertDescription className={`${isCompleted ? 'text-green-800' : hasError ? 'text-red-800' : 'text-gray-800'}`}>
              {getStatusMessage()}
            </AlertDescription>
          </div>
          
          {progress && !isCompleted && !hasError && (
            <div className="mt-3 space-y-2">
              <Progress 
                value={progress.progress} 
                className="h-2"
              />
              <div className="text-xs text-gray-600">
                Stage: {progress.stage.replace('_', ' ')} • {progress.progress}% complete
              </div>
            </div>
          )}
        </Alert>
      )}

      <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={prevStep}
          disabled={isSubmitting || isCompleted}
          className="w-full min-h-11 sm:w-auto"
        >
          Previous
        </Button>
        
        <Button 
          type="submit" 
          disabled={isSubmitting || isCompleted}
          className="w-full min-h-11 sm:w-auto sm:min-w-[140px]"
        >
          {isCompleted ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Completed
            </>
          ) : isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : hasError ? (
            "Retry Creation"
          ) : (
            "Create Proposal"
          )}
        </Button>
      </div>
    </form>
  );
}