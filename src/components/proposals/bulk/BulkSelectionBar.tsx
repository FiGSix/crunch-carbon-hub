import { Button } from "@/components/ui/button";
import { ArrowRight, X } from "lucide-react";

interface BulkSelectionBarProps {
  selectedCount: number;
  onMove: () => void;
  onClear: () => void;
}

/** Action bar shown above the proposals list when admins have selected rows. */
export function BulkSelectionBar({ selectedCount, onMove, onClear }: BulkSelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 px-4 py-3 my-4">
      <span className="text-sm font-medium">
        {selectedCount} selected
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
        <Button size="sm" onClick={onMove}>
          <ArrowRight className="h-4 w-4 mr-2" />
          Move to onboarding
        </Button>
      </div>
    </div>
  );
}
