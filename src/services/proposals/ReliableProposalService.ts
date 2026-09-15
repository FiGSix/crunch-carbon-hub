/**
 * Enterprise-grade proposal service with invisible reliability
 * Handles all failures automatically with professional UX
 */

import { RetryService } from '@/lib/reliability/RetryService';
import { ConnectionManager } from '@/lib/reliability/ConnectionManager';
import { createProposal, searchClients } from './unifiedProposalService';
import { EligibilityCriteria, ClientInformation, ProjectInformation, AdditionalClient } from '@/types/proposals';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { isSelfAsClient, SELF_AS_CLIENT_MESSAGE } from '@/lib/validation/selfAsClient';

export interface ReliableProposalResult {
  success: boolean;
  proposalId?: string;
  error?: string;
}

export interface ProposalProgress {
  stage: 'validating' | 'creating_client' | 'calculating' | 'saving' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
}

export class ReliableProposalService {
  private static instance: ReliableProposalService;
  private connectionManager: ConnectionManager;
  private progressCallbacks = new Map<string, (progress: ProposalProgress) => void>();

  constructor() {
    this.connectionManager = ConnectionManager.getInstance();
  }

  static getInstance(): ReliableProposalService {
    if (!this.instance) {
      this.instance = new ReliableProposalService();
    }
    return this.instance;
  }

  /**
   * Create proposal with enterprise reliability
   */
  async createProposalReliably(
    proposalTitle: string,
    agentId: string,
    eligibilityCriteria: EligibilityCriteria,
    projectInfo: ProjectInformation,
    clientInfo: ClientInformation,
    selectedClientId?: string,
    onProgress?: (progress: ProposalProgress) => void,
    additionalClients?: AdditionalClient[]
  ): Promise<ReliableProposalResult> {
    const operationId = `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const serviceLogger = logger.withContext({
      component: 'ReliableProposalService',
      operation: 'createProposal',
      operationId
    });

    // Register progress callback
    if (onProgress) {
      this.progressCallbacks.set(operationId, onProgress);
    }

    try {
      // Quick validation first
      this.updateProgress(operationId, {
        stage: 'validating',
        progress: 10,
        message: 'Validating proposal data...'
      });

      if (!agentId || !proposalTitle.trim()) {
        throw new Error('Invalid proposal data');
      }

      // Hard business rule: a partner may not be the client on their own proposal
      await this.assertNotSelfAsClient(clientInfo, additionalClients);

      // Try immediate creation with extended timeout and retries
      const immediateResult = await this.tryImmediateCreation(
        proposalTitle,
        agentId,
        eligibilityCriteria,
        projectInfo,
        clientInfo,
        selectedClientId,
        operationId,
        additionalClients
      );

      if (immediateResult.success) {
        this.updateProgress(operationId, {
          stage: 'completed',
          progress: 100,
          message: 'Proposal created successfully!'
        });

        serviceLogger.info('Proposal created successfully', { proposalId: immediateResult.proposalId });
        return immediateResult;
      }

      serviceLogger.error('Proposal creation failed', { error: immediateResult.error });
      throw new Error(immediateResult.error || 'Failed to create proposal');

    } catch (error) {
      serviceLogger.error('Proposal creation failed', { error });
      
      this.updateProgress(operationId, {
        stage: 'failed',
        progress: 0,
        message: 'Failed to create proposal',
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create proposal'
      };
    } finally {
      // Cleanup progress callback
      setTimeout(() => {
        this.progressCallbacks.delete(operationId);
      }, 5000);
    }
  }

  /**
   * Hard business rule: the signed-in partner may not be listed as a client.
   * Admins are exempt.
   */
  private async assertNotSelfAsClient(
    clientInfo: ClientInformation,
    additionalClients?: AdditionalClient[]
  ): Promise<void> {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    if (!authUser) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', authUser.id)
      .maybeSingle();

    const ownEmail = profile?.email || authUser.email;
    const role = profile?.role;

    const emails = [clientInfo?.email, ...(additionalClients || []).map(c => c.email)];
    if (emails.some(email => isSelfAsClient(email, ownEmail, role))) {
      throw new Error(SELF_AS_CLIENT_MESSAGE);
    }
  }

  /**
   * Try immediate creation (fast path)
   */
  private async tryImmediateCreation(
    proposalTitle: string,
    agentId: string,
    eligibilityCriteria: EligibilityCriteria,
    projectInfo: ProjectInformation,
    clientInfo: ClientInformation,
    selectedClientId: string | undefined,
    operationId: string,
    additionalClients?: AdditionalClient[]
  ): Promise<ReliableProposalResult> {
    
    return await RetryService.executeWithRetry(
      async () => {
        this.updateProgress(operationId, {
          stage: 'creating_client',
          progress: 30,
          message: 'Processing client information...'
        });

        await this.connectionManager.waitForHealthyConnection(5000);

        this.updateProgress(operationId, {
          stage: 'calculating',
          progress: 60,
          message: 'Calculating carbon credits...'
        });

        const result = await createProposal(
          proposalTitle,
          agentId,
          eligibilityCriteria,
          projectInfo,
          clientInfo,
          selectedClientId,
          additionalClients
        );

        if (!result.success) {
          throw new Error(result.error || 'Proposal creation failed');
        }

        this.updateProgress(operationId, {
          stage: 'saving',
          progress: 90,
          message: 'Finalizing proposal...'
        });

        return {
          success: true,
          proposalId: result.proposalId
        };
      },
      {
        maxAttempts: 3,
        baseDelay: 1000,
        timeoutMs: 90000 // Increased from 45s to 90s for complex calculations
      }
    ).then(result => {
      if (result.success) {
        return { success: true, proposalId: result.data!.proposalId };
      } else {
        return { success: false, error: result.error?.message };
      }
    }).catch((error: any) => {
      console.error('Immediate proposal creation failed:', error);
      
      let userMessage = 'Unable to create proposal. Please try again.';
      
      // Map technical errors to user-friendly messages
      if (error.message?.includes('Email cannot be empty') || error.message?.includes('email is required')) {
        userMessage = 'Client email is required to create a proposal.';
      } else if (error.message?.includes('agent account must be approved')) {
        userMessage = error.message; // Pass through specific approval message
      } else if (error.message?.includes('permission') || error.message?.includes('policy')) {
        userMessage = 'You do not have permission to create proposals. Please contact support.';
      } else if (error.message?.includes('duplicate') || error.message?.includes('unique constraint')) {
        userMessage = 'A technical issue occurred with client data. Please try again or contact support.';
      }
      
      this.updateProgress(operationId, {
        stage: 'failed',
        progress: 100,
        message: userMessage
      });
      
      return {
        success: false,
        error: userMessage
      };
    });
  }

  /**
   * Update progress for operation
   */
  private updateProgress(operationId: string, progress: ProposalProgress): void {
    const callback = this.progressCallbacks.get(operationId);
    if (callback) {
      callback(progress);
    }
  }

  /**
   * Search clients with reliability
   */
  async searchClientsReliably(searchTerm: string): Promise<any[]> {
    const result = await RetryService.executeWithRetry(
      () => this.connectionManager.executeWithHealthCheck(() => searchClients(searchTerm)),
      {
        maxAttempts: 2,
        baseDelay: 300,
        timeoutMs: 10000
      }
    );

    if (result.success) {
      return result.data || [];
    } else {
      logger.error('Client search failed', { error: result.error?.message });
      return [];
    }
  }

  /**
   * Submit proposal for review with enhanced reliability and audit trail
   */
  async submitProposalReliably(proposalId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const serviceLogger = logger.withContext({
      component: 'ReliableProposalService',
      method: 'submitProposalReliably',
      proposalId,
      userId
    });

    serviceLogger.info('Starting reliable proposal submission with audit trail');

    const result = await RetryService.executeWithRetry(
      () => this.connectionManager.executeWithHealthCheck(async () => {
        const { updateProposalStatus } = await import('./statusUpdateService');
        
        // Status remains as 'draft' until proposal is actually sent
        // The send-proposal-invitation edge function will change status to 'sent'
        // No longer auto-promoting to 'pending' - that status is removed
        return { proposalId, status: 'draft' };
      }),
      {
        maxAttempts: 3,
        baseDelay: 1000,
        timeoutMs: 15000
      }
    );

    if (result.success) {
      serviceLogger.info('Proposal submission completed successfully with audit trail');
      
      // Create notification (non-blocking)
      void supabase.from('notifications').insert({
        user_id: userId,
        type: 'proposal_submitted',
        title: 'Proposal Submitted',
        message: 'Your proposal has been successfully submitted for review.',
        related_type: 'proposal',
        related_id: proposalId
      }).then(() => {
        serviceLogger.info('Notification created for proposal submission');
      });
    } else {
      serviceLogger.error('Proposal submission failed', { error: result.error?.message });
    }

    return {
      success: result.success,
      error: result.error?.message
    };
  }
}