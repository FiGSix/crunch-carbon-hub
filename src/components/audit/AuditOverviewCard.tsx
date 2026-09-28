import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AUDIT_TAGS, type AuditProject } from "@/hooks/audit/useProjectAudits";

const CYCLES: Record<string, { status: string; note: string; variant: "secondary" | "outline" | "default" }> = {
  "Audit 1": { status: "Completed", note: "Verified and closed", variant: "secondary" },
  "Audit 2": { status: "Closed", note: "1 Jan 2025 – 30 Jun 2026", variant: "outline" },
  "Audit 3": { status: "Open", note: "Accepting Audit Ready projects", variant: "default" },
};

const fmtMwp = (kwp: number) => `${(kwp / 1000).toLocaleString("en-ZA", { maximumFractionDigits: 2 })} MWp`;

export function AuditOverviewCard({ projects }: { projects: AuditProject[] }) {
  const unassignedReady = projects.filter((p) => p.auditReady && !p.auditTag);
  const notReady = projects.filter((p) => !p.auditReady);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Audit rounds</CardTitle>
        <CardDescription>Which of your projects are in each carbon credit audit.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {AUDIT_TAGS.map((tag) => {
          const inTag = projects.filter((p) => p.auditTag === tag);
          const kwp = inTag.reduce((s, p) => s + p.sizeKwp, 0);
          const c = CYCLES[tag];
          return (
            <div key={tag} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{tag}</span>
                <Badge variant={c.variant}>{c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{c.note}</p>
              <p className="text-2xl font-bold tabular-nums">{inTag.length}</p>
              <p className="text-xs text-muted-foreground">projects · {fmtMwp(kwp)}</p>
            </div>
          );
        })}
        <div className="rounded-lg border border-dashed p-4 space-y-2">
          <span className="font-semibold">Not in an audit</span>
          <p className="text-xs text-muted-foreground">Ready but unassigned, or still working toward Audit Ready</p>
          <p className="text-2xl font-bold tabular-nums">{unassignedReady.length + notReady.length}</p>
          <p className="text-xs text-muted-foreground">
            {unassignedReady.length} ready · {notReady.length} not yet ready
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
