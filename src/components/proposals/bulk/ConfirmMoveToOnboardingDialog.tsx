import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Package } from "lucide-react";
import { useBulkMoveToOnboarding } from "@/hooks/proposals/useBulkMoveToOnboarding";
import { ProposalListItem } from "@/types/proposals";

interface ConfirmMoveToOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Proposals the admin selected in the list. */
  proposals: ProposalListItem[];
  onSuccess: () => void;
}

export function ConfirmMoveToOnboardingDialog({
  open,
  onOpenChange,
  proposals,
  onSuccess,
}: ConfirmMoveToOnboardingDialogProps) {
  const { moveToOnboarding, isProcessing, result, reset } = useBulkMoveToOnboarding();
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (open) {
      reset();
      setShowResults(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const eligible = proposals.filter((p) => !p.signed_at);
  const ineligible = proposals.filter((p) => !!p.signed_at);

  const titleById = new Map(proposals.map((p) => [p.id, p.name || p.title]));

  const handleConfirm = async () => {
    if (eligible.length === 0) return;
    try {
      const moveResult = await moveToOnboarding(eligible.map((p) => p.id));
      setShowResults(true);
      if (moveResult.failureCount === 0) {
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 1500);
      } else {
        onSuccess();
      }
    } catch {
      // Errors are surfaced by the hook's toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isProcessing && onOpenChange(next)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Move to onboarding
          </DialogTitle>
          <DialogDescription>
            These projects will be marked as signed and an onboarding record will be created for each.
          </DialogDescription>
        </DialogHeader>

        {showResults && result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {result.failureCount === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-carbon-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              <p className="font-medium">
                {result.successCount} of {result.totalRequested} moved to onboarding
              </p>
            </div>
            {result.errors.length > 0 && (
              <ScrollArea className="max-h-56 pr-4">
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {result.errors.map((e) => (
                    <li key={e.proposalId}>
                      {titleById.get(e.proposalId) || e.proposalId}: {e.error}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <ScrollArea className="max-h-72 pr-4">
              <ul className="space-y-2">
                {eligible.map((p) => (
                  <li key={p.id} className="rounded-md border p-2 text-sm">
                    <p className="font-medium break-words">{p.name || p.title}</p>
                    <p className="text-muted-foreground break-words">{p.client}</p>
                  </li>
                ))}
              </ul>
            </ScrollArea>

            {ineligible.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {ineligible.length} selected project{ineligible.length === 1 ? " is" : "s are"} already
                signed and will be skipped.
              </p>
            )}
            {eligible.length === 0 && (
              <p className="text-sm text-destructive">
                None of the selected projects can be moved.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            {showResults ? "Close" : "Cancel"}
          </Button>
          {!showResults && (
            <Button onClick={handleConfirm} disabled={isProcessing || eligible.length === 0}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Moving...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Move {eligible.length} to onboarding
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
