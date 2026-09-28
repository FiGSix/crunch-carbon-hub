import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { useAdminRevenueYearlyTable, type RevenueScope, type YearlyRevenueRow } from "@/hooks/dashboard/useAdminRevenueYearlyTable";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(value);

const SCOPE_OPTIONS: { value: RevenueScope; label: string }[] = [
  { value: "audit_ready", label: "Audit Ready" },
  { value: "signed", label: "Signed" },
  { value: "pipeline", label: "Pipeline" },
  { value: "signed_audit_ready", label: "Signed + Audit Ready" },
  { value: "all", label: "Pipeline + Signed + Audit Ready" },
];

type SplitKey = "client" | "partner" | "superPartner" | "crunch";
const SPLIT_LABELS: Record<SplitKey, string> = {
  client: "Client",
  partner: "Partner",
  superPartner: "Super Partner",
  crunch: "Crunch Carbon",
};
function splitsForRole(role: string | null | undefined): SplitKey[] {
  if (role === "admin") return ["client", "partner", "superPartner", "crunch"];
  if (role === "super_partner") return ["client", "partner", "superPartner"];
  if (role === "agent") return ["client", "partner"];
  return ["client"];
}

function DataRow({ row, splits }: { row: YearlyRevenueRow; splits: SplitKey[] }) {
  const isBlend = row.year === "blend";
  return (
    <TableRow className={cn(row.estimated && "text-muted-foreground")}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {isBlend ? (
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: "#8ED973" }}
            >
              Blend
            </span>
          ) : (
            row.label
          )}
          {row.estimated && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">
              Est
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">R{formatNumber(row.price)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(row.tonnes)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(row.total)}</TableCell>
      {splits.map((k) => (
        <TableCell key={k} className="text-right tabular-nums">{formatCurrency(row[k])}</TableCell>
      ))}
    </TableRow>
  );
}

function TotalRow({ row, muted, splits }: { row: YearlyRevenueRow; muted?: boolean; splits: SplitKey[] }) {
  return (
    <TableRow className={cn("font-semibold bg-muted/50", muted && "text-muted-foreground")}>
      <TableCell>{row.label}</TableCell>
      <TableCell />
      <TableCell className="text-right tabular-nums">{formatNumber(row.tonnes)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(row.total)}</TableCell>
      {splits.map((k) => (
        <TableCell key={k} className="text-right tabular-nums">{formatCurrency(row[k])}</TableCell>
      ))}
    </TableRow>
  );
}

export function RevenueYearlyBreakdown() {
  const [scope, setScope] = useState<RevenueScope>("audit_ready");
  const { data, isLoading } = useAdminRevenueYearlyTable(scope);
  const { userRole } = useAuth();
  const splits = splitsForRole(userRole);

  const currentRows = data?.rows.filter((r) => !r.estimated) ?? [];
  const estimatedRows = data?.rows.filter((r) => r.estimated) ?? [];

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Revenue year-by-year breakdown</CardTitle>
          <CardDescription>
            Total contract value with splits, pro-rated from each project's commissioning date.
            2031-2037 rates are estimates at 5% p.a. escalation on the 2030 rate. Prices shown are the
            default rate set; clients on a custom rate set are priced on theirs.
            {data ? ` ${data.projectCount} project${data.projectCount === 1 ? "" : "s"} in scope` : ""}
            {data && data.specialRateProjects > 0
              ? `, ${data.specialRateProjects} on a custom rate set.`
              : data
                ? "."
                : ""}
          </CardDescription>
        </div>

        <Select value={scope} onValueChange={(v) => setScope(v as RevenueScope)}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="Select scope" />
          </SelectTrigger>
          <SelectContent>
            {SCOPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">SA price (R/t)</TableHead>
                  <TableHead className="text-right">CO₂ (tonnes)</TableHead>
                  <TableHead className="text-right">Total revenue</TableHead>
                  {splits.map((k) => (
                    <TableHead key={k} className="text-right">{SPLIT_LABELS[k]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentRows.map((row) => (
                  <DataRow key={row.year} row={row} splits={splits} />
                ))}
                <TotalRow row={data.subtotalCurrent} splits={splits} />
                {estimatedRows.map((row) => (
                  <DataRow key={row.year} row={row} splits={splits} />
                ))}
                <TotalRow row={data.subtotalEstimated} muted splits={splits} />
                <TotalRow row={data.grandTotal} splits={splits} />
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
