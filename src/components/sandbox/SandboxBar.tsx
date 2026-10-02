import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FlaskConical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth";
import type { UserRole } from "@/contexts/auth/types";
import { roleLandingPath } from "@/lib/auth/roleLanding";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "agent", label: "Partner" },
  { value: "super_partner", label: "Super Partner" },
  { value: "admin", label: "Admin" },
];

/**
 * Shown only to test accounts (server-side list). Lets the tester switch the
 * account's real role so every server check behaves exactly like that role,
 * inside the walled-off sandbox that is wiped nightly.
 */
export function SandboxBar() {
  const { user, userRole, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  const { data: isTest } = useQuery({
    queryKey: ["sandbox-account", user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("test_accounts" as never)
        .select("user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  if (!isTest) return null;

  const switchRole = async (role: string) => {
    if (role === userRole) return;
    setSwitching(true);
    const { error } = await supabase.rpc("sandbox_switch_role" as never, { p_role: role } as never);
    if (error) {
      toast.error(error.message);
      setSwitching(false);
      return;
    }
    queryClient.clear();
    await refreshUser();
    setSwitching(false);
    navigate(roleLandingPath(role as UserRole), { replace: true });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-warning/40 bg-warning/15 px-3 py-2 text-sm text-foreground md:px-4">
      <span className="flex items-center gap-2 font-semibold">
        <FlaskConical className="h-4 w-4" aria-hidden />
        Test mode
      </span>
      <span className="text-muted-foreground">
        You only see test data. Emails go to the tester's inbox. Everything is wiped nightly at 23:00.
      </span>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-muted-foreground">View as</span>
        <Select value={userRole} onValueChange={switchRole} disabled={switching}>
          <SelectTrigger className="h-8 w-40 bg-background" aria-label="Switch test role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {switching && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      </div>
    </div>
  );
}
