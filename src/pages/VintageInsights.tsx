import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { RevenueYearlyBreakdown } from "@/components/dashboard/sections/RevenueYearlyBreakdown";
import { AuditOverviewCard } from "@/components/audit/AuditOverviewCard";
import { ProjectsAuditTable } from "@/components/audit/ProjectsAuditTable";
import { usePortfolioAuditProjects } from "@/hooks/audit/useProjectAudits";
import { useAuth } from "@/contexts/auth";

/** Audit rounds, projected revenue and per-project audit membership for the viewer's portfolio. */
export default function VintageInsights() {
  const { userRole } = useAuth();
  const { data: projects = [], isLoading } = usePortfolioAuditProjects();

  return (
    <DashboardLayout>
      <DashboardHeader
        title="Vintage & revenue"
        description="Which audit each project is in, and the revenue your portfolio is projected to earn."
      />
      <AuditOverviewCard projects={projects} />
      <RevenueYearlyBreakdown />
      <ProjectsAuditTable projects={projects} isLoading={isLoading} isAdmin={userRole === "admin"} />
    </DashboardLayout>
  );
}
