import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { AUDIT_TAGS, useSetProjectAuditTag, type AuditProject, type AuditTag } from "@/hooks/audit/useProjectAudits";

const NONE = "none";

export function ProjectsAuditTable({
  projects,
  isLoading,
  isAdmin,
}: {
  projects: AuditProject[];
  isLoading: boolean;
  isAdmin: boolean;
}) {
  const [audit, setAudit] = useState("all");
  const [readiness, setReadiness] = useState("all");
  const [search, setSearch] = useState("");
  const setTag = useSetProjectAuditTag();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects
      .filter((p) => (audit === "all" ? true : audit === NONE ? !p.auditTag : p.auditTag === audit))
      .filter((p) => (readiness === "all" ? true : readiness === "ready" ? p.auditReady : !p.auditReady))
      .filter((p) => !q || p.projectName.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q))
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [projects, audit, readiness, search]);

  const onTag = (p: AuditProject, value: string) => {
    const tag = value === NONE ? null : (value as AuditTag);
    setTag.mutate(
      { onboardingId: p.onboardingId, tag },
      {
        onSuccess: () => toast.success(`${p.projectName}: ${tag ?? "removed from audit"}`),
        onError: (e: any) => toast.error(e?.message || "Could not update the audit"),
      },
    );
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Projects by audit</CardTitle>
        <CardDescription>
          See which projects are in an audit, and which still need to reach Audit Ready.
        </CardDescription>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search project or client" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={audit} onValueChange={setAudit}>
            <SelectTrigger className="sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All audits</SelectItem>
              {AUDIT_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              <SelectItem value={NONE}>Not in an audit</SelectItem>
            </SelectContent>
          </Select>
          <Select value={readiness} onValueChange={setReadiness}>
            <SelectTrigger className="sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              <SelectItem value="ready">Audit Ready</SelectItem>
              <SelectItem value="not_ready">Not Audit Ready</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No projects match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <p className="mb-2 text-xs text-muted-foreground">{rows.length} project{rows.length === 1 ? "" : "s"}</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Size (kWp)</TableHead>
                  <TableHead>Readiness</TableHead>
                  <TableHead>Audit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.onboardingId}>
                    <TableCell className="font-medium">{p.projectName}</TableCell>
                    <TableCell>{p.clientName}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.sizeKwp.toLocaleString("en-ZA", { maximumFractionDigits: 1 })}</TableCell>
                    <TableCell>
                      <Badge variant={p.auditReady ? "default" : "outline"}>{p.auditReady ? "Audit Ready" : "Not ready"}</Badge>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={p.auditTag ?? NONE}
                          onValueChange={(v) => onTag(p, v)}
                          disabled={!p.auditReady || setTag.isPending}
                        >
                          <SelectTrigger className="h-8 w-[150px]" title={p.auditReady ? undefined : "Only Audit Ready projects can join an audit"}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Not in an audit</SelectItem>
                            {AUDIT_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : p.auditTag ? (
                        <Badge variant="secondary">{p.auditTag}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not in an audit</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
