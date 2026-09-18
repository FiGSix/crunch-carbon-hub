
import { useEffect, useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, RefreshCw } from "lucide-react";
import { ProposalList } from "@/components/proposals/ProposalList";
import { ProposalFilters } from "@/components/proposals/ProposalFilters";
import { ProposalActions } from "@/components/proposals/ProposalActions";
import { ProposalLoadingState } from "@/components/proposals/ProposalLoadingState";
import { EngagementDashboard } from "@/components/proposals/engagement/EngagementDashboard";
import { AdvancedProposalFilters, applyAdvancedFilters } from "@/components/proposals/filters/AdvancedProposalFilters";
import { BulkSelectionBar } from "@/components/proposals/bulk/BulkSelectionBar";
import { ConfirmMoveToOnboardingDialog } from "@/components/proposals/bulk/ConfirmMoveToOnboardingDialog";

import { useProposals } from "@/hooks/useProposals";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { clearProposalsCache } from "@/hooks/proposals/utils/proposalCache";
import { devLogger } from "@/lib/performance/ConsoleReplacementUtility";

export function ProposalsSectionOptimized() {
  const { 
    proposals, 
    loading, 
    error,
    handleFilterChange, 
    fetchProposals,
    advancedFilters,
    setAdvancedFilters
  } = useProposals();
  
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [showDashboard, setShowDashboard] = useState(false);
  
  // Apply advanced filters to proposals
  const filteredProposals = useMemo(() => {
    return applyAdvancedFilters(proposals, advancedFilters);
  }, [proposals, advancedFilters]);

  // Admin-only bulk selection of visible proposals
  const isAdmin = userRole === 'admin';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  // Drop selections that are no longer visible after filtering/refresh
  useEffect(() => {
    setSelectedIds(prev => {
      if (prev.size === 0) return prev;
      const visible = new Set(filteredProposals.map(p => p.id));
      const next = new Set([...prev].filter(id => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredProposals]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const selectable = filteredProposals.filter(p => !p.signed_at);
      const allSelected =
        selectable.length > 0 && selectable.every(p => prev.has(p.id));
      return allSelected ? new Set() : new Set(selectable.map(p => p.id));
    });
  }, [filteredProposals]);

  const selectedProposals = useMemo(
    () => filteredProposals.filter(p => selectedIds.has(p.id)),
    [filteredProposals, selectedIds]
  );
  
  // Optimized auth state logging - only on significant changes
  useEffect(() => {
    if (import.meta.env.DEV && user && proposals.length > 0) {
      devLogger.proposals.info("ProposalsSection initialized", { 
        userId: user.id, 
        userRole,
        proposalsCount: proposals.length
      });
    }
  }, [user?.id, userRole]); // Removed proposals.length to reduce noise
  
  // Memoize title based on user role to prevent re-renders
  const sectionTitle = useMemo(() => {
    if (userRole === 'agent') return 'My Proposals';
    if (userRole === 'client') return 'My Proposals';
    return 'Proposal Management';
  }, [userRole]);
  
  // Optimize proposal update handler with useCallback - STABLE DEPENDENCIES
  const handleProposalUpdate = useCallback(() => {
    devLogger.proposals.info("Proposal update triggered");
    clearProposalsCache(); // Clear cache to force refresh
    fetchProposals();
  }, [fetchProposals]); // fetchProposals is now stable from useProposals
  
  // CONSOLIDATED global proposal status change event handler - STABLE DEPENDENCIES
  useEffect(() => {
    const handleProposalStatusChange = (event: Event) => {
      const customEvent = event as CustomEvent<{id?: string, status?: string, type?: string, clientId?: string}>;
      devLogger.proposals.info("Status change event detected", customEvent.detail);
      
      // Show toast notification based on the event type
      if (customEvent.detail.type === 'portfolio-update') {
        toast({
          title: "Portfolio Updated",
          description: "Client portfolio percentages have been recalculated.",
        });
      } else if (customEvent.detail.type === 'portfolio-validation-complete') {
        toast({
          title: "Portfolio Validation Complete",
          description: "All portfolio inconsistencies have been checked and fixed.",
        });
      } else if (customEvent.detail.status === 'approved') {
        toast({
          title: "Proposal Approved",
          description: "The proposal has been approved successfully.",
        });
      } else if (customEvent.detail.status === 'rejected') {
        toast({
          title: "Proposal Rejected",
          description: "The proposal has been rejected.",
        });
      }
      
      // Refresh proposals list - this is handled by useProposals hook now
    };
    
    window.addEventListener('proposal-status-changed', handleProposalStatusChange as EventListener);
    
    return () => {
      window.removeEventListener('proposal-status-changed', handleProposalStatusChange as EventListener);
    };
  }, [toast]); // Only toast as dependency - handleProposalUpdate removed as it's handled in useProposals
  
  return (
    <div className="space-y-6">
      {/* Engagement Dashboard - Agents and Admins */}
      {(userRole === 'agent' || userRole === 'admin') && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDashboard(!showDashboard)}
          >
            {showDashboard ? 'Hide' : 'Show'} Engagement Dashboard
          </Button>
          {showDashboard && <EngagementDashboard />}
        </div>
      )}

      <Card className="retro-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              {sectionTitle}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleProposalUpdate}
              disabled={loading}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProposalActions />
          <ProposalFilters 
            onSearchChange={(value) => handleFilterChange('search', value)}
            onStatusChange={(value) => handleFilterChange('status', value)}
            onSortChange={(value) => handleFilterChange('sort', value)}
          />
          
          {error && (
            <Alert variant="destructive" className="my-4">
              <AlertTitle>Error Loading Proposals</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <p>{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="self-start"
                  onClick={() => fetchProposals()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          <ProposalLoadingState 
            loading={loading} 
            hasProposals={filteredProposals.length > 0} 
          />
          
          {!loading && filteredProposals.length > 0 && (
            <>
              {isAdmin && (
                <BulkSelectionBar
                  selectedCount={selectedIds.size}
                  onMove={() => setShowMoveDialog(true)}
                  onClear={() => setSelectedIds(new Set())}
                />
              )}
              <ProposalList 
                proposals={filteredProposals} 
                onProposalUpdate={handleProposalUpdate}
                selectable={isAdmin}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
              />
            </>
          )}
          
          {!loading && proposals.length > 0 && filteredProposals.length === 0 && (
            <Alert className="my-4">
              <AlertDescription>
                No proposals match the selected filters. Try adjusting your filter criteria.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
