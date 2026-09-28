import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AUDIT_TAGS, firstAudit, useSetProjectAuditTags, type AuditProject, type AuditTag } from "@/hooks/audit/useProjectAudits";

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
  const setTags = useSetProjectAuditTags();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects
      .filter((p) =>
        audit === "all"
          ? true
          : audit === NONE
            ? p.auditTags.length === 0
            : audit.startsWith("new:")
              ? firstAudit(p) === audit.slice(4)
              : p.auditTags.includes(audit as AuditTag),
      )
      .filter((p) => (readiness === "all" ? true : readiness === "ready" ? p.auditReady : !p.auditReady))
      .filter((p) => !q || p.projectName.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q))
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [projects, audit, readiness, search]);

  const onToggle = (p: AuditProject, tag: AuditTag, on: boolean) => {
    const tags = on ? [...p.auditTags, tag] : p.auditTags.filter((t) => t !== tag);
    setTags.mutate(
      { onboardingId: p.onboardingId, tags },
      {
        onSuccess: () => toast.success(`${p.projectName}: ${on ? "added to" : "removed from"} ${tag}`),
        onError: (e: any) => toast.error(e?.message || "Could not update the audits"),
      },
    );
  };

  const tagBadges = (p: AuditProject) =>
    p.auditTags.length ? (
      <div className="flex flex-wrap gap-1">
        {p.auditTags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
      </div>
    ) : (
      <span className="text-sm text-muted-foreground">Not in an audit</span>
    );

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
              <SelectItem value="new:Audit 2">New in Audit 2</SelectItem>
              <SelectItem value="new:Audit 3">New in Audit 3</SelectItem>
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
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" className="h-auto min-h-8 justify-start px-2 py-1" disabled={setTags.isPending}>
                              {tagBadges(p)}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 space-y-2" align="start">
                            {AUDIT_TAGS.map((t) => {
                              const checked = p.auditTags.includes(t);
                              const blocked = !checked && !p.auditReady;
                              return (
                                <label key={t} className="flex items-center gap-2 text-sm">
                                  <Checkbox checked={checked} disabled={blocked || setTags.isPending} onCheckedChange={(v) => onToggle(p, t, v === true)} />
                                  {t}
                                </label>
                              );
                            })}
                            {!p.auditReady && <p className="text-xs text-muted-foreground">Only Audit Ready projects can be added to an audit.</p>}
                          </PopoverContent>
                        </Popover>
                      ) : (
                        tagBadges(p)
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
