
import { useState, useCallback, useEffect, useMemo } from "react";
import { ProposalListItem } from "@/types/proposals";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { useFetchProposals } from "./proposals/useFetchProposals";
import { useProposalFilters } from "./proposals/useProposalFilters";
import { getCachedProposals, isCacheValid, updateProposalsCache, clearProposalsCache } from "./proposals/utils/proposalCache";
import { UseProposalsResult } from "./proposals/types";
import { logger } from "@/lib/logger";
import { AdvancedFilters } from "@/components/proposals/filters/AdvancedProposalFilters";

export function useProposals(): UseProposalsResult {
  const { user, userRole, refreshUser } = useAuth();
  const { toast } = useToast();
  const { filters, handleFilterChange } = useProposalFilters();
  
  const [allProposals, setAllProposals] = useState<ProposalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    engagementLevel: 'all',
    automationStatus: 'all',
    emailStatus: 'all'
  });

  const proposalsLogger = useMemo(() => logger.withContext({
    component: 'UseProposals',
    feature: 'proposals'
  }), []);

  const { fetchProposals: fetchProposalsCore } = useFetchProposals({
    user,
    userRole,
    filters,
    toast,
    refreshUser,
    setProposals: setAllProposals,
    setLoading,
    setError
  });

  const fetchProposals = useCallback(async (forceRefresh: boolean = false) => {
    // Check cache first unless force refresh is requested
    if (!forceRefresh && isCacheValid(filters, user?.id ?? null)) {
      const cachedProposals = getCachedProposals();
      if (cachedProposals) {
        proposalsLogger.info("Using cached proposals", { count: cachedProposals.length });
        setAllProposals(cachedProposals);
        setLoading(false);
        return;
      }
    }

    // Fetch fresh data
    await fetchProposalsCore(forceRefresh);
  }, [filters, fetchProposalsCore, proposalsLogger, user?.id]);

  // Client-side search filtering for instant search performance
  const proposals = useMemo(() => {
    if (!filters.search || !filters.search.trim()) {
      return allProposals;
    }
    
    const search = filters.search.toLowerCase().trim();
    return allProposals.filter(proposal => {
      // Search in title
      if (proposal.title?.toLowerCase().includes(search)) return true;
      
      // Search in agent name
      if (proposal.agent_name?.toLowerCase().includes(search)) return true;
      
      // Search in status
      if (proposal.status?.toLowerCase().includes(search)) return true;
      
      // Search in client info from content
      const content = proposal.content;
      const clientInfo = content?.clientInfo;
      
      if (clientInfo) {
        const email = clientInfo.email?.toLowerCase() || '';
        const name = clientInfo.name?.toLowerCase() || '';
        const companyName = clientInfo.companyName?.toLowerCase() || '';
        
        if (email.includes(search) || 
            name.includes(search) ||
            companyName.includes(search)) {
          return true;
        }
      }
      
      return false;
    });
  }, [allProposals, filters.search]);

  // Update cache when proposals change
  useEffect(() => {
    if (allProposals.length > 0 && user?.id) {
      updateProposalsCache(allProposals, filters, user.id);
    }
  }, [allProposals, filters, user?.id]);

  // Listen for proposal status change events to refresh data - DEBOUNCED
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleProposalStatusChange = () => {
      proposalsLogger.info("Proposal status change detected - scheduling refresh");
      
      // Debounce to prevent multiple rapid refetches
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        clearProposalsCache();
        fetchProposals(true);
      }, 500); // Wait 500ms before refetching
    };

    window.addEventListener('proposal-status-changed', handleProposalStatusChange);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('proposal-status-changed', handleProposalStatusChange);
    };
  }, [fetchProposals, proposalsLogger]);

  // Initial fetch - STABLE DEPENDENCIES
  useEffect(() => {
    if (user?.id && userRole) {
      fetchProposals();
    }
  }, [user?.id, userRole]); // Stable dependencies - only refetch when user or role changes

  return {
    proposals,
    loading,
    error,
    handleFilterChange,
    fetchProposals,
    advancedFilters,
    setAdvancedFilters
  };
}
