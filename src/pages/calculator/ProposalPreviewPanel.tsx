import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, CalendarDays, Zap, MapPin } from "lucide-react";
import { format } from "date-fns";

interface ProposalPreviewPanelProps {
  estimate: {
    systemSizeKwp: number;
    province: string;
    commissionDate: Date;
    annualEnergyKwh: number;
    carbonCreditsPerYear: number;
  };
  proposalId: string;
  proposalToken: string;
}

export const ProposalPreviewPanel = ({
  estimate,
  proposalId,
  proposalToken,
}: ProposalPreviewPanelProps) => {
  const proposalUrl = `/proposals/${proposalId}?token=${encodeURIComponent(proposalToken)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="meta-card p-6 md:p-8 bg-gradient-to-br from-white to-crunch-yellow/5"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-crunch-yellow/10 rounded-xl">
            <FileText className="h-6 w-6 text-crunch-yellow" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-crunch-black">
              A sunny start
            </h2>
            <p className="text-sm text-crunch-black/60">
              Your personalised Crunch Carbon proposal is ready.
            </p>
          </div>
        </div>
        <div className="text-xs font-medium px-3 py-1 bg-green-100 text-green-800 rounded-full w-fit">
          Valid for 10 days
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/60 border border-crunch-black/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-crunch-black/60 mb-1">
            <Zap className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide font-medium">System</span>
          </div>
          <p className="text-lg font-bold text-crunch-black">
            {estimate.systemSizeKwp.toLocaleString()} kWp
          </p>
        </div>

        <div className="bg-white/60 border border-crunch-black/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-crunch-black/60 mb-1">
            <MapPin className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide font-medium">Location</span>
          </div>
          <p className="text-lg font-bold text-crunch-black">{estimate.province}</p>
        </div>

        <div className="bg-white/60 border border-crunch-black/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-crunch-black/60 mb-1">
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide font-medium">Commissioned</span>
          </div>
          <p className="text-lg font-bold text-crunch-black">
            {format(estimate.commissionDate, "dd MMM yyyy")}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Button
          asChild
          className="bg-crunch-yellow hover:bg-crunch-yellow/90 text-crunch-black font-medium px-6 py-5 rounded-xl group"
        >
          <a href={proposalUrl}>
            Review & sign your proposal
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </Button>
        <p className="text-xs text-crunch-black/50 max-w-sm">
          This opens your proposal page. You can review the cession agreement, sign digitally, and start onboarding your system.
        </p>
      </div>
    </motion.div>
  );
};
