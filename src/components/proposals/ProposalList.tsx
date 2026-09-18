
import { useEffect, memo, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ProposalActionButtons } from "./components/ProposalActionButtons";
import { ClientShareCell } from "./components/ClientShareCell";
import { ProposalStatusBadge } from "./list/ProposalStatusBadge";
import { ProposalMobileCard } from "./list/ProposalMobileCard";
import { ProposalListProps, ProposalListItem } from "@/types/proposals";
import { useAuth } from "@/contexts/auth";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { logger } from "@/lib/logger";
import { UserRole } from "@/contexts/auth/types";
import { formatSystemSizeForDisplay } from "@/lib/calculations/carbon";


// Define the props interface for the MemoizedProposalRow component
interface ProposalRowProps {
  proposal: ProposalListItem;
  userRole: UserRole | null;
  isCurrentUser: boolean;
  onProposalUpdate?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

// Optimized row component with deep comparison for proposal data
const MemoizedProposalRow = memo<ProposalRowProps>(({
  proposal,
  userRole,
  isCurrentUser,
  onProposalUpdate,
  selectable,
  selected,
  onToggleSelect
}) => {
  const formattedDate = useMemo(
    () => new Date(proposal.date).toLocaleDateString(),
    [proposal.date]
  );
  
  const formattedSize = useMemo(
    () => formatSystemSizeForDisplay(proposal.size),
    [proposal.size]
  );

  const alreadyOnboarding = !!proposal.signed_at;
  
  return (
    <TableRow className={isCurrentUser ? "bg-carbon-green-50" : ""}>
      {selectable && (
        <TableCell className="w-10">
          <Checkbox
            checked={!!selected}
            disabled={alreadyOnboarding}
            aria-label={
              alreadyOnboarding
                ? `${proposal.name} is already in onboarding`
                : `Select ${proposal.name}`
            }
            title={alreadyOnboarding ? "Already in onboarding" : undefined}
            onCheckedChange={() => onToggleSelect?.(proposal.id)}
          />
        </TableCell>
      )}
      <TableCell className="font-medium">{proposal.name}</TableCell>
      <TableCell>{proposal.client}</TableCell>
      <TableCell>
        {proposal.isMultiPhase ? (
          <div className="flex items-center gap-2">
            <span>{formattedDate}</span>
            <Badge variant="outline" className="text-xs">Multi</Badge>
          </div>
        ) : (
          formattedDate
        )}
      </TableCell>
      <TableCell>{formattedSize}</TableCell>
      <TableCell>
        <ProposalStatusBadge proposal={proposal} />
      </TableCell>
      {userRole === "admin" && (
        <TableCell>{proposal.agent || "Unassigned"}</TableCell>
      )}
      {userRole === "admin" && (
        <TableCell>
          <ClientShareCell proposal={proposal} />
        </TableCell>
      )}
      <TableCell className="text-right">
        <ProposalActionButtons 
          proposal={proposal} 
          onProposalUpdate={onProposalUpdate} 
        />
      </TableCell>
    </TableRow>
  );

}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.proposal.id === nextProps.proposal.id &&
    prevProps.proposal.status === nextProps.proposal.status &&
    prevProps.proposal.last_email_event_type === nextProps.proposal.last_email_event_type &&
    prevProps.proposal.engagement_count === nextProps.proposal.engagement_count &&
    prevProps.proposal.audit_ready === nextProps.proposal.audit_ready &&
    prevProps.proposal.submitted_for_review === nextProps.proposal.submitted_for_review &&
    prevProps.proposal.onboarding_complete === nextProps.proposal.onboarding_complete &&
    prevProps.proposal.signed_at === nextProps.proposal.signed_at &&
    prevProps.userRole === nextProps.userRole &&
    prevProps.isCurrentUser === nextProps.isCurrentUser &&
    prevProps.selectable === nextProps.selectable &&
    prevProps.selected === nextProps.selected
  );
});

MemoizedProposalRow.displayName = "MemoizedProposalRow";

export function ProposalList({
  proposals,
  onProposalUpdate,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll
}: ProposalListProps) {
  const { userRole, user } = useAuth();

  // Create a contextualized logger
  const proposalLogger = useMemo(() => logger.withContext({
    component: 'ProposalList',
    feature: 'proposals'
  }), []);

  // Selectable proposals are those not yet signed (already-signed ones are in onboarding)
  const selectableProposals = useMemo(
    () => proposals.filter(p => !p.signed_at),
    [proposals]
  );

  const allSelected = useMemo(
    () =>
      selectableProposals.length > 0 &&
      selectableProposals.every(p => selectedIds?.has(p.id)),
    [selectableProposals, selectedIds]
  );

  // Memoize the empty state message
  const emptyStateMessage = useMemo(() => {
    if (userRole === "agent") {
      return "You don't have any proposals assigned to you. Click 'Create New Proposal' to get started.";
    } else if (userRole === "client") {
      return "You don't have any proposals yet. An agent will create a proposal for you.";
    } else {
      return "No proposals found matching your criteria. Try changing the filters or create a new proposal.";
    }
  }, [userRole]);

  // Memoize the status change handler
  const handleProposalStatusChange = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<{ id: string; status: string; }>;
    proposalLogger.info("Status change event detected", customEvent.detail);
    if (onProposalUpdate) {
      proposalLogger.info("Triggering proposal list refresh");
      onProposalUpdate();
    }
  }, [onProposalUpdate, proposalLogger]);

  // Enhanced logging for debugging
  useEffect(() => {
    proposalLogger.debug("Component rendered", {
      userRole,
      userId: user?.id,
      proposalsCount: proposals.length
    });
  }, [proposals.length, userRole, user, proposalLogger]);

  // Listen for global proposal status change events
  useEffect(() => {
    window.addEventListener('proposal-status-changed', handleProposalStatusChange as EventListener);
    return () => {
      window.removeEventListener('proposal-status-changed', handleProposalStatusChange as EventListener);
    };
  }, [handleProposalStatusChange]);

  // No proposals found state
  if (proposals.length === 0) {
    return (
      <Alert className="my-4">
        <AlertTitle>No proposals found</AlertTitle>
        <AlertDescription>{emptyStateMessage}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="grid gap-3 md:hidden">
        {selectable && selectableProposals.length > 0 && (
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={allSelected}
              onCheckedChange={() => onToggleSelectAll?.()}
              aria-label="Select all shown proposals"
            />
            Select all shown ({selectableProposals.length})
          </label>
        )}
        {proposals.map(proposal => (
          <ProposalMobileCard
            key={proposal.id}
            proposal={proposal}
            userRole={userRole}
            isCurrentUser={proposal.agent_id === user?.id}
            onProposalUpdate={onProposalUpdate}
            selectable={selectable}
            selected={selectedIds?.has(proposal.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>

      {/* Tablet & up: table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    disabled={selectableProposals.length === 0}
                    onCheckedChange={() => onToggleSelectAll?.()}
                    aria-label="Select all shown proposals"
                  />
                </TableHead>
              )}
              <TableHead>Project Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              {userRole === "admin" && <TableHead>Agent</TableHead>}
              {userRole === "admin" && <TableHead>Client Share</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals.map(proposal => (
              <MemoizedProposalRow 
                key={proposal.id} 
                proposal={proposal} 
                userRole={userRole} 
                isCurrentUser={proposal.agent_id === user?.id} 
                onProposalUpdate={onProposalUpdate}
                selectable={selectable}
                selected={selectedIds?.has(proposal.id)}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );

}
