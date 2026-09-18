import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { ProposalListItem } from "@/types/proposals";
import { buildProposalsCsv, downloadCsv, proposalsCsvFilename } from "@/lib/proposals/exportProposalsCsv";

interface ExportProposalsButtonProps {
  proposals: ProposalListItem[];
}

/**
 * Admin-only export of the proposals currently visible in the list
 * (search, status and advanced filters already applied upstream).
 */
export function ExportProposalsButton({ proposals }: ExportProposalsButtonProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (proposals.length === 0 || exporting) return;
    setExporting(true);
    try {
      const csv = await buildProposalsCsv(proposals);
      downloadCsv(csv, proposalsCsvFilename());
      toast({
        title: "Export ready",
        description: `${proposals.length} proposal${proposals.length === 1 ? "" : "s"} exported to CSV.`,
      });
    } catch (error) {
      console.error("Proposal CSV export failed", error);
      toast({
        title: "Export failed",
        description: "The CSV could not be generated. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting || proposals.length === 0}
    >
      <Download className="h-4 w-4 mr-2" />
      {exporting ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
