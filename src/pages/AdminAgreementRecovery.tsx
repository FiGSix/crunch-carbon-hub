import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileWarning,
  RefreshCw,
  Search,
  Link as LinkIcon,
  Mail,
  MailX,
  CheckCheck,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAgreementRecoveryAction,
  useAgreementRecoveryItems,
  useRefreshAgreementRecovery,
  type RecoveryItem,
  type RecoveryState,
} from "@/hooks/admin/useAgreementRecovery";

const STATE_LABEL: Record<RecoveryState, string> = {
  not_started: "Not started",
  fixed: "Fixed",
  link_sent: "Link sent",
  opened: "Opened",
  signed: "Signed",
  bounced: "Bounced",
  failed: "Failed",
  handled: "Handled",
  resolved: "Complete",
};

const STATE_VARIANT: Record<
  RecoveryState,
  "default" | "secondary" | "destructive" | "outline"
> = {
  not_started: "outline",
  fixed: "default",
  link_sent: "secondary",
  opened: "secondary",
  signed: "default",
  bounced: "destructive",
  failed: "destructive",
  handled: "secondary",
  resolved: "default",
};

const GROUP_DESCRIPTION: Record<string, string> = {
  A: "Signed, document never produced — no client contact needed",
  B: "Marked signed, no signature on record — needs a fresh signature",
  C: "Marked signed, no agreement at all — needs a fresh signature",
};

export default function AdminAgreementRecovery() {
  const { data: items, isLoading } = useAgreementRecoveryItems();
  const refresh = useRefreshAgreementRecovery();
  const runAction = useAgreementRecoveryAction();

  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<"all" | "A" | "B" | "C">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    run: () => void;
  }>(null);

  const open = useMemo(
    () => (items ?? []).filter((i) => !i.resolved_at),
    [items],
  );

  const totals = useMemo(
    () => ({
      a: open.reduce((s, i) => s + i.a_count, 0),
      b: open.reduce((s, i) => s + i.b_count, 0),
      c: open.reduce((s, i) => s + i.c_count, 0),
    }),
    [open],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (items ?? []).filter((i) => {
      if (group !== "all" && i.group_code !== group) return false;
      if (!term) return true;
      return (
        (i.client_name ?? "").toLowerCase().includes(term) ||
        (i.client_email ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, search, group]);

  const selectedItems = (items ?? []).filter((i) => selected.includes(i.id));
  const selectedGroups = new Set(selectedItems.map((i) => i.group_code));
  const onlyGroupA =
    selectedGroups.size > 0 &&
    selectedGroups.has("A") &&
    selectedGroups.size === 1;
  const noGroupA = selectedItems.length > 0 && !selectedGroups.has("A");
  const everythingDone = open.length === 0 && (items?.length ?? 0) > 0;

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleAll = () =>
    setSelected((prev) =>
      prev.length === visible.length ? [] : visible.map((i) => i.id),
    );

  const act = (
    action: "fix_documents" | "issue_link" | "mark_handled",
    sendEmail: boolean,
    title: string,
    description: string,
  ) =>
    setConfirm({
      title,
      description,
      run: () =>
        runAction.mutate(
          { action, itemIds: selected, sendEmail },
          { onSuccess: () => setSelected([]) },
        ),
    });

  const copyLink = async (item: RecoveryItem) => {
    if (!item.link_token || !item.link_proposal_id) {
      toast.error("Create a link first using 'Create link only'");
      return;
    }
    const url = `${window.location.origin}/proposals/${item.link_proposal_id}/accept?token=${item.link_token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Signing link copied");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileWarning className="h-8 w-8" />
              Agreement Recovery
            </h1>
            <p className="text-muted-foreground mt-2 max-w-3xl">
              Temporary page for clearing the backlog of missing Cession
              Agreements. Once all three groups reach zero it can be closed and
              removed.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refresh.isPending ? "animate-spin" : ""}`}
            />
            Rebuild list
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {(["A", "B", "C"] as const).map((g) => (
            <Card key={g}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Group {g} remaining
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {g === "A" ? totals.a : g === "B" ? totals.b : totals.c}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {GROUP_DESCRIPTION[g]}
                </p>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Clients outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{open.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totals.a + totals.b + totals.c} projects in total
              </p>
            </CardContent>
          </Card>
        </div>

        {everythingDone && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>All groups are clear</CardTitle>
              <CardDescription>
                Every affected client has been resolved. This page and its data
                can now be removed — just say the word and it will be taken out
                along with a copy of the record for your files.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Affected clients</CardTitle>
            <CardDescription>
              One signature covers every project under a client, so most clients
              only need to be contacted once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Tabs
                value={group}
                onValueChange={(v) => setGroup(v as typeof group)}
              >
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="A">Group A</TabsTrigger>
                  <TabsTrigger value="B">Group B</TabsTrigger>
                  <TabsTrigger value="C">Group C</TabsTrigger>
                </TabsList>
                <TabsContent value={group} />
              </Tabs>
            </div>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center rounded-lg border p-3 bg-muted/40">
                <span className="text-sm font-medium mr-2">
                  {selected.length} selected
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!onlyGroupA || runAction.isPending}
                  onClick={() =>
                    act(
                      "fix_documents",
                      false,
                      "Fix silently, no email",
                      "Rebuilds the missing documents from the signature already on record. The client is not contacted.",
                    )
                  }
                >
                  <MailX className="h-4 w-4 mr-2" />
                  Fix silently, no email
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!onlyGroupA || runAction.isPending}
                  onClick={() =>
                    act(
                      "fix_documents",
                      true,
                      "Fix and email the document",
                      "Rebuilds the missing documents and emails each client their cession document. No signing is required.",
                    )
                  }
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Fix and email document
                </Button>
                <Button
                  size="sm"
                  disabled={!noGroupA || runAction.isPending}
                  onClick={() =>
                    act(
                      "issue_link",
                      true,
                      "Send fresh link with apology email",
                      "Issues a new signing link per client and sends the apology email. One signature clears all of that client's projects.",
                    )
                  }
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send link + apology email
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!noGroupA || runAction.isPending}
                  onClick={() =>
                    act(
                      "issue_link",
                      false,
                      "Create link only",
                      "Creates a signing link for each selected client without sending anything.",
                    )
                  }
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Create link only
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={runAction.isPending}
                  onClick={() =>
                    act(
                      "mark_handled",
                      false,
                      "Mark as handled",
                      "Marks the selected clients as dealt with outside the platform.",
                    )
                  }
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Mark as handled
                </Button>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : visible.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nothing here. Use "Rebuild list" to check the latest records.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          visible.length > 0 &&
                          selected.length === visible.length
                        }
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                    <TableHead>What is missing</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Last action</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(item.id)}
                          onCheckedChange={() => toggle(item.id)}
                          aria-label={`Select ${item.client_name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {item.client_name || "Unnamed client"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.client_email || "No email on record"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.group_code}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.project_count}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.group_code === "A"
                          ? "Document only"
                          : "Signature and document"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATE_VARIANT[item.state]}>
                          {STATE_LABEL[item.state]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.last_action
                          ? `${item.last_action.replace(/_/g, " ")}${
                              item.last_action_at
                                ? ` · ${new Date(item.last_action_at).toLocaleDateString("en-ZA")}`
                                : ""
                            }`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {item.link_token && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => copyLink(item)}
                            aria-label="Copy signing link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.description} This affects {selected.length} client(s).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirm?.run();
                setConfirm(null);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
