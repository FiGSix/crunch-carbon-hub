import { Card, CardContent } from "@/components/ui/card";
import { ProposalData } from "@/types/proposals";
import {
  FileSignature,
  Coins,
  Wallet,
  ShieldCheck,
  AlertCircle,
  Clock,
} from "lucide-react";

interface ThirtySecondSummaryProps {
  proposal: ProposalData;
  clientName?: string;
}

/**
 * "Your Proposal in 30 Seconds"
 *
 * Above-the-fold decision-support block that answers the 6 questions every
 * client has before they sign. Designed to reduce hesitation, not chase.
 */
export function ThirtySecondSummary({
  proposal,
  clientName,
}: ThirtySecondSummaryProps) {
  const financialInfo = (proposal.content as ProposalData["content"] & {
    financialInfo?: { client_share_percentage?: number };
  }).financialInfo;
  const sharePct = proposal.client_share_percentage ?? financialInfo?.client_share_percentage;
  const revenueLabel =
    typeof sharePct === "number"
      ? `${sharePct}% of carbon-credit revenue`
      : "your agreed share of carbon-credit revenue";

  const greeting = clientName ? `Hi ${clientName},` : "Hi there,";

  const items: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    body: string;
  }> = [
    {
      icon: FileSignature,
      label: "What you're signing",
      body: "A Cession Agreement that lets Crunch Carbon register, audit, and monetise the carbon credits your solar system already generates.",
    },
    {
      icon: Coins,
      label: "What you get",
      body: `${revenueLabel} — paid to you. No upfront cost, no change to how your system runs.`,
    },
    {
      icon: Wallet,
      label: "What it costs you",
      body: "Nothing. Crunch Carbon only earns when you earn. Our share is taken from credit sales, not from your pocket.",
    },
    {
      icon: ShieldCheck,
      label: "What Crunch Carbon does",
      body: "We handle the audit, verification, registry submission and buyer matching — the admin-heavy work that turns generation data into revenue.",
    },
    {
      icon: AlertCircle,
      label: "Your risk",
      body: "You can cancel before the first credit is issued. The agreement covers carbon credits only — your system, energy savings and warranties stay yours.",
    },
    {
      icon: Clock,
      label: "What happens next",
      body: "Sign below, we onboard the project (we'll guide you), and credits start being registered. First payouts typically follow the first verification cycle.",
    },
  ];

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
      <CardContent className="p-6 md:p-8">
        <div className="mb-5">
          <p className="text-xl md:text-2xl font-semibold text-primary">{greeting}</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">
            Your proposal in 30 seconds
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            The full detail is below. This is the short version so you can
            decide with confidence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(({ icon: Icon, label, body }) => (
            <div
              key={label}
              className="flex gap-3 rounded-lg border border-border/60 bg-card/50 p-4"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="text-sm mt-1 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  );
}
