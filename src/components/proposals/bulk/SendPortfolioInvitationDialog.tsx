import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProposalListItem } from "@/types/proposals";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposals: ProposalListItem[];
  onSuccess: () => void;
}

/** Why a selection cannot be sent as one portfolio, or null when it can. */
export function portfolioBlocker(proposals: ProposalListItem[]): string | null {
  if (proposals.length < 2) return "Select at least two proposals.";
  if (proposals.some((p) => p.signed_at)) return "Some selected proposals are already signed.";
  const clients = new Set(proposals.map((p) => p.client_reference_id ?? null));
  if (clients.has(null)) return "Some selected proposals have no client attached.";
  if (clients.size > 1) return "The selected proposals belong to different clients.";
  return null;
}

export function SendPortfolioInvitationDialog({ open, onOpenChange, proposals, onSuccess }: Props) {
  const { toast } = useToast();
  const [cc, setCc] = useState("");
  const [sending, setSending] = useState(false);
  const blocker = portfolioBlocker(proposals);
  const totalKwp = useMemo(
    () => proposals.reduce((s, p) => s + (Number((p as any).system_size_kwp) || 0), 0),
    [proposals]
  );

  const send = async () => {
    const ccEmails = cc.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-portfolio-invitation", {
      body: { proposalIds: proposals.map((p) => p.id), ccEmails },
    });
    setSending(false);
    const msg = (data as any)?.error || error?.message;
    if (msg || !(data as any)?.success) {
      toast({ title: "Portfolio not sent", description: String(msg || "Unknown error"), variant: "destructive" });
      return;
    }
    toast({ title: "Portfolio invitation sent", description: `One email to ${(data as any).recipient} covering ${proposals.length} projects.` });
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(n) => !sending && onOpenChange(n)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Send portfolio invitation</DialogTitle>
          <DialogDescription>
            The client gets one email with the project count and total portfolio size, then signs once for the full portfolio.
          </DialogDescription>
        </DialogHeader>
        {blocker ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />{blocker}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Projects</div><div className="text-xl font-bold">{proposals.length}</div></div>
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Total size</div><div className="text-xl font-bold">{Math.round(totalKwp).toLocaleString("en-ZA")} kWp</div></div>
            </div>
            <ScrollArea className="max-h-56 rounded-md border">
              <ul className="divide-y text-sm">
                {proposals.map((p) => (
                  <li key={p.id} className="flex justify-between px-3 py-2">
                    <span className="truncate">{p.name || p.title}</span>
                    <span className="text-muted-foreground">{Math.round(Number((p as any).system_size_kwp) || 0).toLocaleString("en-ZA")} kWp</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <div className="space-y-1">
              <Label htmlFor="portfolio-cc">Also send to (optional, comma separated)</Label>
              <Input id="portfolio-cc" value={cc} maxLength={1000} onChange={(e) => setCc(e.target.value)} placeholder="colleague@company.com" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={send} disabled={!!blocker || sending}>
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send one email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
