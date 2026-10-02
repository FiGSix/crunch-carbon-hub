import "../_shared/sandbox.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getVintageDeadlines, getNextVintageDeadline } from "../_shared/vintageConfig.ts";
import { getCarbonPrices, type CarbonPrices } from "../_shared/carbonPricing.ts";
import { buildAgentBlockers, categoriseBlockers } from "./blockers.ts";
import { buildAgentSubject, buildAgentHtml, type AgentEmailInput, type VintageProjectAtRisk } from "./agentEmail.ts";
import { readPreviousSnapshot, writeSnapshot, computeDeltas, type AgentSnapshot } from "./snapshots.ts";
import { buildAgentFunnel, funnelToRows } from "./funnel.ts";
import { calculateAgentRevenueLens } from "./revenue.ts";
import { links, setEmailContext } from "./links.ts";
import {
  classifyAgent,
  pickVariant,
  getSubject,
  getOpening,
  SEGMENT_CONFIG,
  type SegmentInput,
  type AgentSegmentV2,
} from "./segmentation.ts";
import { buildMilestones } from "./milestones.ts";
import { pickRotatingBlock } from "./rotatingContent.ts";
import { getRoundupAnalytics, renderAnalyticsHtml } from "./adminAnalytics.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// CONSTANTS
// ============================================================================

const PLATFORM_2026_GOAL_MWP = 250;

// Dynamic carbon prices loaded once per invocation. Source of truth:
// system_settings.carbon_prices (same as the frontend dynamicCarbonPricingService).
let CARBON_PRICES_CACHE: CarbonPrices = {};

// ============================================================================
// TYPES
// ============================================================================

interface AgentData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  join_date: string | null;
  company_id: string | null;
  company_name: string | null;
  is_team_lead: boolean;
}

interface ProposalData {
  id: string;
  title: string;
  status: string;
  system_size_kwp: number | null;
  carbon_credits: number | null;
  client_share_percentage: number | null;
  agent_commission_percentage: number | null;
  agent_id: string;
  client_reference_id: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string | null;
  audit_ready: boolean;
}

interface ProjectOnboardingData {
  proposal_id: string;
  audit_ready: boolean;
  submitted_for_review: boolean;
  onboarding_complete: boolean;
}

type AgentSegment = "new" | "active" | "top_performer";

interface AgentMetrics {
  agent: AgentData;
  segment: AgentSegment;
  personal_audit_ready_mwp: number;
  personal_total_mwp: number;
  personal_revenue_2025_2030: number;
  personal_onboarding_mwp: number;
  personal_pending_mwp: number;
  team_name: string;
  team_audit_ready_mwp: number;
  team_total_mwp: number;
  team_revenue_2025_2030: number;
  team_member_count: number;
  agent_team_contribution_percent: number;
  week_movements: WeekMovement[];
  blockers: Blocker[];
}

interface WeekMovement {
  project_name: string;
  old_status: string;
  new_status: string;
  mwp: number;
}

interface Blocker {
  project_name: string;
  blocker_type: string;
  mwp: number;
}

interface TeamMetrics {
  team_id: string;
  team_name: string;
  team_audit_ready_mwp: number;
  team_total_mwp: number;
  team_revenue_2025_2030: number;
  team_active_agents: number;
  team_week_change_mwp: number;
}

interface PlatformMetrics {
  platform_audit_ready_mwp: number;
  platform_onboarding_mwp: number;
  platform_pending_mwp: number;
  platform_total_revenue: number;
  platform_client_revenue: number;
  platform_agent_revenue: number;
  platform_platform_revenue: number;
  new_proposals_count: number;
  new_proposals_mwp: number;
  signed_proposals_count: number;
  signed_mwp: number;
  new_audit_ready_count: number;
  platform_total_mwp: number;
  goal_progress_percent: number;
  weekly_mwp_added: number;
  active_agent_count: number;
  new_agents_count: number;
  top_agents: TopAgent[];
  new_agents: NewAgent[];
  teams: TeamMetrics[];
  blocker_summary: BlockerSummary[];
  blocked_revenue: number;
}

interface TopAgent {
  rank: number;
  agent_name: string;
  agent_company: string;
  agent_audit_ready_mwp: number;
  agent_revenue: number;
}

interface NewAgent {
  agent_name: string;
  company_name: string;
  join_date: string;
}

interface BlockerSummary {
  blocker_type: string;
  blocker_count: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatCurrency(amount: number): string {
  return `R ${Math.round(amount).toLocaleString("en-ZA")}`;
}

function formatMwp(kwp: number): string {
  return (kwp / 1000).toFixed(3);
}

async function getVintageCountdown(): Promise<{ days: number; hours: number; minutes: number; year: number } | null> {
  const deadlines = await getVintageDeadlines(supabase);
  const nextDeadline = getNextVintageDeadline(deadlines);
  
  if (!nextDeadline) {
    return null;
  }
  
  const now = new Date();
  const diff = nextDeadline.deadline.getTime() - now.getTime();
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, year: nextDeadline.year };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { days, hours, minutes, year: nextDeadline.year };
}

function calculateRevenue2025to2030(carbonCredits: number, sharePercent: number): number {
  let total = 0;
  for (let year = 2025; year <= 2030; year++) {
    const price = CARBON_PRICES_CACHE[String(year)] ?? 0;
    total += carbonCredits * price * (sharePercent / 100);
  }
  return total;
}

function getAgentSegment(agent: AgentData, proposals: ProposalData[]): AgentSegment {
  const joinDate = agent.join_date ? new Date(agent.join_date) : new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const signedProposals = proposals.filter((p) => p.agent_id === agent.id && p.signed_at);
  const portfolioMwp = signedProposals.reduce((sum, p) => sum + (p.system_size_kwp || 0), 0) / 1000;
  
  if (joinDate > thirtyDaysAgo || signedProposals.length === 0) {
    return "new";
  }
  
  if (portfolioMwp >= 1) {
    return "top_performer";
  }
  
  return "active";
}

function getWeekEndDate(): string {
  const now = new Date();
  return now.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchActiveAgents(): Promise<AgentData[]> {
  console.log("Fetching active agents...");
  
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, join_date")
    .eq("role", "agent")
    .eq("agent_status", "active")
    .is("deleted_at", null);
  
  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
    return [];
  }
  
  // Get company memberships for agents
  const agentIds = profiles?.map((p) => p.id) || [];
  const { data: memberships, error: membershipError } = await supabase
    .from("company_members")
    .select("user_id, company_id, role, companies(id, company_name)")
    .in("user_id", agentIds)
    .eq("status", "active");
  
  if (membershipError) {
    console.error("Error fetching memberships:", membershipError);
  }
  
  const membershipMap = new Map<string, { company_id: string; company_name: string; is_team_lead: boolean }>();
  memberships?.forEach((m: any) => {
    membershipMap.set(m.user_id, {
      company_id: m.company_id,
      company_name: m.companies?.company_name || "Independent",
      is_team_lead: m.role === "team_lead",
    });
  });
  
  const agents: AgentData[] = (profiles || []).map((p) => {
    const membership = membershipMap.get(p.id);
    return {
      id: p.id,
      email: p.email,
      first_name: p.first_name,
      last_name: p.last_name,
      join_date: p.join_date,
      company_id: membership?.company_id || null,
      company_name: membership?.company_name || "Independent",
      is_team_lead: membership?.is_team_lead || false,
    };
  });
  
  console.log(`Found ${agents.length} active agents`);
  return agents;
}

async function fetchAdmins(): Promise<AgentData[]> {
  console.log("Fetching admins...");
  
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, join_date")
    .eq("role", "admin")
    .is("deleted_at", null);
  
  if (error) {
    console.error("Error fetching admins:", error);
    return [];
  }
  
  const admins: AgentData[] = (profiles || []).map((p) => ({
    id: p.id,
    email: p.email,
    first_name: p.first_name,
    last_name: p.last_name,
    join_date: p.join_date,
    company_id: null,
    company_name: "Crunch Carbon",
    is_team_lead: true,
  }));
  
  console.log(`Found ${admins.length} admins`);
  return admins;
}

async function fetchAllProposals(): Promise<ProposalData[]> {
  console.log("Fetching all proposals...");
  
  const { data, error } = await supabase
    .from("proposals")
    .select("id, title, status, system_size_kwp, carbon_credits, client_share_percentage, agent_commission_percentage, agent_id, client_reference_id, signed_at, created_at, updated_at, audit_ready")
    .is("deleted_at", null)
    .is("archived_at", null);
  
  if (error) {
    console.error("Error fetching proposals:", error);
    return [];
  }
  
  console.log(`Found ${data?.length || 0} proposals`);
  return data || [];
}

async function fetchProjectOnboarding(): Promise<ProjectOnboardingData[]> {
  console.log("Fetching project onboarding data...");
  
  const { data, error } = await supabase
    .from("project_onboarding")
    .select("proposal_id, audit_ready, submitted_for_review, onboarding_complete");
  
  if (error) {
    console.error("Error fetching project onboarding:", error);
    return [];
  }
  
  console.log(`Found ${data?.length || 0} project onboarding records`);
  return data || [];
}

async function fetchNewAgentsThisWeek(): Promise<NewAgent[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, join_date")
    .eq("role", "agent")
    .eq("agent_status", "active")
    .gte("join_date", sevenDaysAgo.toISOString().split("T")[0]);
  
  if (error) {
    console.error("Error fetching new agents:", error);
    return [];
  }
  
  // Get company names
  const agentIds = profiles?.map((p) => p.id) || [];
  const { data: memberships } = await supabase
    .from("company_members")
    .select("user_id, companies(company_name)")
    .in("user_id", agentIds)
    .eq("status", "active");
  
  const companyMap = new Map<string, string>();
  memberships?.forEach((m: any) => {
    companyMap.set(m.user_id, m.companies?.company_name || "Independent");
  });
  
  return (profiles || []).map((p) => ({
    agent_name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
    company_name: companyMap.get(p.id) || "Independent",
    join_date: p.join_date || "",
  }));
}

// ============================================================================
// METRICS CALCULATION
// ============================================================================

function calculateTeamMetrics(
  agents: AgentData[],
  proposals: ProposalData[],
  onboardingMap: Map<string, ProjectOnboardingData>
): TeamMetrics[] {
  const teamMap = new Map<string, TeamMetrics>();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // Group agents by company
  const agentsByCompany = new Map<string, AgentData[]>();
  agents.forEach((agent) => {
    const companyKey = agent.company_id || "independent";
    const companyAgents = agentsByCompany.get(companyKey) || [];
    companyAgents.push(agent);
    agentsByCompany.set(companyKey, companyAgents);
  });
  
  // Calculate metrics per team
  agentsByCompany.forEach((teamAgents, companyKey) => {
    const teamName = teamAgents[0]?.company_name || "Independent";
    const teamAgentIds = new Set(teamAgents.map((a) => a.id));
    
    const teamProposals = proposals.filter((p) => teamAgentIds.has(p.agent_id));
    const signedProposals = teamProposals.filter((p) => p.signed_at);
    
    let auditReadyMwp = 0;
    let totalMwp = 0;
    let totalRevenue = 0;
    let weekChangeMwp = 0;
    
    signedProposals.forEach((p) => {
      const mwp = (p.system_size_kwp || 0) / 1000;
      totalMwp += mwp;
      
      const onboarding = onboardingMap.get(p.id);
      if (onboarding?.audit_ready) {
        auditReadyMwp += mwp;
      }
      
      if (p.carbon_credits && p.agent_commission_percentage) {
        totalRevenue += calculateRevenue2025to2030(p.carbon_credits, p.agent_commission_percentage);
      }
      
      // Check if signed in last 7 days
      if (p.signed_at && new Date(p.signed_at) > sevenDaysAgo) {
        weekChangeMwp += mwp;
      }
    });
    
    teamMap.set(companyKey, {
      team_id: companyKey,
      team_name: teamName,
      team_audit_ready_mwp: auditReadyMwp,
      team_total_mwp: totalMwp,
      team_revenue_2025_2030: totalRevenue,
      team_active_agents: teamAgents.length,
      team_week_change_mwp: weekChangeMwp,
    });
  });
  
  return Array.from(teamMap.values()).sort((a, b) => b.team_audit_ready_mwp - a.team_audit_ready_mwp);
}

function calculatePlatformMetrics(
  agents: AgentData[],
  proposals: ProposalData[],
  onboardingMap: Map<string, ProjectOnboardingData>,
  newAgents: NewAgent[]
): PlatformMetrics {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  let auditReadyMwp = 0;
  let onboardingMwp = 0;
  let pendingMwp = 0;
  let totalMwp = 0;
  let clientRevenue = 0;
  let agentRevenue = 0;
  let platformRevenue = 0;
  let newProposalsCount = 0;
  let newProposalsMwp = 0;
  let signedProposalsCount = 0;
  let signedMwp = 0;
  let newAuditReadyCount = 0;
  let weeklyMwpAdded = 0;
  let blockedRevenue = 0;
  
  const blockerCounts: Record<string, number> = {
    "data access setup": 0,
    "onboarding completion": 0,
    "audit review": 0,
  };
  
  const agentMetricsMap = new Map<string, { auditReadyMwp: number; revenue: number; company: string }>();
  
  proposals.forEach((p) => {
    const mwp = (p.system_size_kwp || 0) / 1000;
    const onboarding = onboardingMap.get(p.id);
    const createdAt = new Date(p.created_at);
    const signedAt = p.signed_at ? new Date(p.signed_at) : null;
    
    // New proposals this week
    if (createdAt > sevenDaysAgo) {
      newProposalsCount++;
      newProposalsMwp += mwp;
    }
    
    // Signed proposals this week
    if (signedAt && signedAt > sevenDaysAgo) {
      signedProposalsCount++;
      signedMwp += mwp;
      weeklyMwpAdded += mwp;
    }
    
    if (p.signed_at) {
      totalMwp += mwp;
      
      if (onboarding?.audit_ready) {
        auditReadyMwp += mwp;
        
        // Track per-agent audit-ready for top agents
        const agentData = agentMetricsMap.get(p.agent_id) || { auditReadyMwp: 0, revenue: 0, company: "" };
        agentData.auditReadyMwp += mwp;
        
        // Calculate revenues
        if (p.carbon_credits) {
          const clientShare = p.client_share_percentage || 60.2;
          const agentShare = p.agent_commission_percentage || 5;
          const platformShare = 100 - clientShare - agentShare;
          
          const cRev = calculateRevenue2025to2030(p.carbon_credits, clientShare);
          const aRev = calculateRevenue2025to2030(p.carbon_credits, agentShare);
          const pRev = calculateRevenue2025to2030(p.carbon_credits, platformShare);
          
          clientRevenue += cRev;
          agentRevenue += aRev;
          platformRevenue += pRev;
          
          agentData.revenue += aRev;
        }
        
        agentMetricsMap.set(p.agent_id, agentData);
      } else {
        onboardingMwp += mwp;
        
        // Count blockers
        if (!onboarding) {
          blockerCounts["onboarding completion"]++;
        } else if (onboarding.submitted_for_review && !onboarding.audit_ready) {
          blockerCounts["audit review"]++;
        } else if (!onboarding.onboarding_complete) {
          blockerCounts["onboarding completion"]++;
        }
        
        // Calculate blocked revenue
        if (p.carbon_credits && p.client_share_percentage) {
          blockedRevenue += calculateRevenue2025to2030(p.carbon_credits, 100 - (p.client_share_percentage || 60.2) - (p.agent_commission_percentage || 5));
        }
      }
    } else {
      pendingMwp += mwp;
    }
  });
  
  // Build top agents list
  const agentLookup = new Map(agents.map((a) => [a.id, a]));
  const topAgents: TopAgent[] = Array.from(agentMetricsMap.entries())
    .map(([agentId, metrics]) => {
      const agent = agentLookup.get(agentId);
      return {
        rank: 0,
        agent_name: agent ? `${agent.first_name || ""} ${agent.last_name || ""}`.trim() : "Unknown",
        agent_company: agent?.company_name || "Independent",
        agent_audit_ready_mwp: metrics.auditReadyMwp,
        agent_revenue: metrics.revenue,
      };
    })
    .sort((a, b) => b.agent_audit_ready_mwp - a.agent_audit_ready_mwp)
    .slice(0, 5)
    .map((agent, idx) => ({ ...agent, rank: idx + 1 }));
  
  // Build blocker summary
  const blockerSummary: BlockerSummary[] = Object.entries(blockerCounts)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => ({ blocker_type: type, blocker_count: count }));
  
  // Calculate team metrics
  const teams = calculateTeamMetrics(agents, proposals, onboardingMap);
  
  const totalRevenue = clientRevenue + agentRevenue + platformRevenue;
  const goalProgressPercent = (totalMwp / PLATFORM_2026_GOAL_MWP) * 100;
  
  return {
    platform_audit_ready_mwp: auditReadyMwp,
    platform_onboarding_mwp: onboardingMwp,
    platform_pending_mwp: pendingMwp,
    platform_total_revenue: totalRevenue,
    platform_client_revenue: clientRevenue,
    platform_agent_revenue: agentRevenue,
    platform_platform_revenue: platformRevenue,
    new_proposals_count: newProposalsCount,
    new_proposals_mwp: newProposalsMwp,
    signed_proposals_count: signedProposalsCount,
    signed_mwp: signedMwp,
    new_audit_ready_count: newAuditReadyCount,
    platform_total_mwp: totalMwp,
    goal_progress_percent: goalProgressPercent,
    weekly_mwp_added: weeklyMwpAdded,
    active_agent_count: agents.length,
    new_agents_count: newAgents.length,
    top_agents: topAgents,
    new_agents: newAgents,
    teams,
    blocker_summary: blockerSummary,
    blocked_revenue: blockedRevenue,
  };
}

function calculateAgentMetrics(
  agent: AgentData,
  proposals: ProposalData[],
  onboardingMap: Map<string, ProjectOnboardingData>,
  teamMetrics: TeamMetrics[]
): AgentMetrics {
  const agentProposals = proposals.filter((p) => p.agent_id === agent.id);
  const signedProposals = agentProposals.filter((p) => p.signed_at);
  
  let auditReadyMwp = 0;
  let totalMwp = 0;
  let onboardingMwp = 0;
  let pendingMwp = 0;
  let revenue = 0;
  const blockers: Blocker[] = [];
  const weekMovements: WeekMovement[] = [];
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  signedProposals.forEach((p) => {
    const mwp = (p.system_size_kwp || 0) / 1000;
    totalMwp += mwp;
    
    const onboarding = onboardingMap.get(p.id);
    if (onboarding?.audit_ready) {
      auditReadyMwp += mwp;
    } else {
      onboardingMwp += mwp;
      
      // Track blockers
      if (!onboarding?.onboarding_complete) {
        blockers.push({ project_name: p.title, blocker_type: "Onboarding incomplete", mwp });
      } else if (onboarding?.submitted_for_review && !onboarding?.audit_ready) {
        blockers.push({ project_name: p.title, blocker_type: "Awaiting audit review", mwp });
      }
    }
    
    // Calculate agent commission revenue
    if (p.carbon_credits && p.agent_commission_percentage) {
      revenue += calculateRevenue2025to2030(p.carbon_credits, p.agent_commission_percentage);
    }
    
    // Track week movements (signed this week)
    if (p.signed_at && new Date(p.signed_at) > sevenDaysAgo) {
      weekMovements.push({
        project_name: p.title,
        old_status: "Pending",
        new_status: "Signed",
        mwp,
      });
    }
  });
  
  // Pending (unsigned) proposals
  agentProposals.filter((p) => !p.signed_at).forEach((p) => {
    pendingMwp += (p.system_size_kwp || 0) / 1000;
  });
  
  // Get team metrics
  const team = teamMetrics.find((t) => t.team_id === (agent.company_id || "independent")) || {
    team_id: "independent",
    team_name: "Independent",
    team_audit_ready_mwp: auditReadyMwp,
    team_total_mwp: totalMwp,
    team_revenue_2025_2030: revenue,
    team_active_agents: 1,
    team_week_change_mwp: 0,
  };
  
  const contributionPercent = team.team_total_mwp > 0 ? (totalMwp / team.team_total_mwp) * 100 : 100;
  const segment = getAgentSegment(agent, proposals);
  
  return {
    agent,
    segment,
    personal_audit_ready_mwp: auditReadyMwp,
    personal_total_mwp: totalMwp,
    personal_revenue_2025_2030: revenue,
    personal_onboarding_mwp: onboardingMwp,
    personal_pending_mwp: pendingMwp,
    team_name: team.team_name,
    team_audit_ready_mwp: team.team_audit_ready_mwp,
    team_total_mwp: team.team_total_mwp,
    team_revenue_2025_2030: team.team_revenue_2025_2030,
    team_member_count: team.team_active_agents,
    agent_team_contribution_percent: contributionPercent,
    week_movements: weekMovements,
    blockers: blockers.slice(0, 3), // Top 3 blockers
  };
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/**
 * Adapter: builds the new agent email (subject + HTML) from existing metrics
 * by additionally fetching categorised, actionable blockers.
 */
async function buildAgentEmail(
  agent: AgentData,
  metrics: AgentMetrics,
  proposals: ProposalData[],
  rankInfo: { currentRank: number | null; previousRank: number | null; totalRanked: number },
  sendCtx: { sendId: string; variant: "A" | "B" }
): Promise<{ subject: string; html: string; segmentV2: AgentSegmentV2 }> {
  // Activate per-send link tracking
  setEmailContext(sendCtx);

  // Signed proposals for this agent — pass to blocker builder with audit_ready hint
  const signedForAgent = proposals
    .filter((p) => p.agent_id === agent.id && p.signed_at)
    .map((p) => ({
      id: p.id,
      title: p.title,
      system_size_kwp: p.system_size_kwp,
      signed_at: p.signed_at,
      client_reference_id: p.client_reference_id,
      audit_ready: p.audit_ready,
    }));

  const rawBlockers = await buildAgentBlockers(supabase, agent.id, signedForAgent);
  const blockers = categoriseBlockers(rawBlockers);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newProposalsThisWeek = proposals.filter(
    (p) => p.agent_id === agent.id && new Date(p.created_at) > sevenDaysAgo
  ).length;

  const vintageCountdown = await getVintageCountdown();

  // ---- Phase 2 enrichments ----
  const agentProposals = proposals.filter((p) => p.agent_id === agent.id);
  const revenueLens = calculateAgentRevenueLens(
    agentProposals.map((p) => ({
      id: p.id,
      carbon_credits: p.carbon_credits,
      agent_commission_percentage: p.agent_commission_percentage,
      system_size_kwp: p.system_size_kwp,
      signed_at: p.signed_at,
      audit_ready: p.audit_ready,
    })),
    CARBON_PRICES_CACHE
  );

  const previousSnapshot = await readPreviousSnapshot(supabase, agent.id);
  const currentSnapshot: AgentSnapshot = {
    audit_ready_mwp: metrics.personal_audit_ready_mwp,
    onboarding_mwp: metrics.personal_onboarding_mwp,
    pending_signature_mwp: metrics.personal_pending_mwp,
    signed_this_week_mwp: metrics.week_movements.reduce((s, m) => s + m.mwp, 0),
    new_proposals_count: newProposalsThisWeek,
    estimated_commission_2026: revenueLens.short_term_2026,
    estimated_commission_2025_2030: metrics.personal_revenue_2025_2030,
  };
  const deltas = computeDeltas(currentSnapshot, previousSnapshot);

  const funnelMetrics = await buildAgentFunnel(
    supabase,
    agent.id,
    proposals.map((p) => ({
      id: p.id,
      agent_id: p.agent_id,
      status: p.status,
      signed_at: p.signed_at,
      created_at: p.created_at,
    }))
  );
  const funnelRows = funnelToRows(funnelMetrics);

  const vintageAtRisk: VintageProjectAtRisk[] = rawBlockers
    .filter((b) => b.category !== "crunch")
    .slice(0, 5)
    .map((b) => ({
      project_name: b.project_name,
      mwp: b.mwp,
      resolve_url: b.resolve_url,
      missing_items: b.missing_items,
    }));

  let vintageDeadlineLabel: string | undefined;
  if (vintageCountdown) {
    const deadlines = await getVintageDeadlines(supabase);
    const iso = deadlines[String(vintageCountdown.year)];
    if (iso) {
      const d = new Date(iso);
      vintageDeadlineLabel = `${d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
  }

  // ---- Phase 3: segmentation, milestones, rotating block ----

  // Last activity timestamp for "stuck" detection
  const activityTimes = agentProposals
    .flatMap((p) => [p.created_at, p.signed_at, p.updated_at].filter(Boolean) as string[])
    .map((t) => new Date(t).getTime());
  const msSinceLastActivity = activityTimes.length
    ? Date.now() - Math.max(...activityTimes)
    : null;

  const segCtx: SegmentInput = {
    joinDate: agent.join_date,
    signedCount: signedForAgent.length,
    auditReadyMwp: metrics.personal_audit_ready_mwp,
    pendingMwp: metrics.personal_pending_mwp,
    signedThisWeekMwp: currentSnapshot.signed_this_week_mwp,
    newProposalsThisWeek,
    blockedMwp: blockers.total_blocked_mwp,
    msSinceLastActivity,
  };
  const segmentV2 = classifyAgent(segCtx);
  const subjectOverride = getSubject(segmentV2, sendCtx.variant, segCtx);
  const openingOverride = getOpening(segmentV2, segCtx, agent.first_name || "there");

  const milestones = buildMilestones({
    current: currentSnapshot,
    previous: previousSnapshot,
    currentRank: rankInfo.currentRank,
    previousRank: rankInfo.previousRank,
    totalRanked: rankInfo.totalRanked,
  });

  const rotatingBlock = pickRotatingBlock();

  const input: AgentEmailInput = {
    agent: {
      first_name: agent.first_name,
      is_team_lead: agent.is_team_lead,
    },
    segment: metrics.segment, // legacy v1 — still drives some fallback copy
    metrics: {
      audit_ready_mwp: metrics.personal_audit_ready_mwp,
      onboarding_mwp: metrics.personal_onboarding_mwp,
      pending_mwp: metrics.personal_pending_mwp,
      revenue_2025_2030: metrics.personal_revenue_2025_2030,
      signed_this_week_count: metrics.week_movements.length,
      signed_this_week_mwp: currentSnapshot.signed_this_week_mwp,
      new_proposals_this_week: newProposalsThisWeek,
    },
    team: {
      name: metrics.team_name,
      audit_ready_mwp: metrics.team_audit_ready_mwp,
      revenue_2025_2030: metrics.team_revenue_2025_2030,
      member_count: metrics.team_member_count,
      contribution_percent: metrics.agent_team_contribution_percent,
    },
    blockers,
    vintage: vintageCountdown,
    weekEndingLabel: getWeekEndDate(),
    deltas,
    funnel: funnelRows,
    revenue: revenueLens,
    vintageAtRisk,
    vintageDeadlineLabel,
    subjectOverride,
    openingOverride,
    milestones,
    rotatingBlock,
  };

  await writeSnapshot(supabase, agent.id, currentSnapshot);

  const result = {
    subject: buildAgentSubject(input),
    html: buildAgentHtml(input),
    segmentV2,
  };

  // Clear context so next agent starts fresh
  setEmailContext(null);
  return result;
}

function buildAgentEmailSubject(metrics: AgentMetrics): string {
  switch (metrics.segment) {
    case "new":
      return "Your Crunch Carbon journey is starting";
    case "top_performer":
      return `Leading the way: ${formatMwp(metrics.personal_audit_ready_mwp * 1000)} MWp audit-ready`;
    default:
      return `Your portfolio is growing — ${formatMwp(metrics.personal_total_mwp * 1000)} MWp in motion`;
  }
}

async function buildAgentEmailHtml(metrics: AgentMetrics, platformMetrics: PlatformMetrics): Promise<string> {
  const vintageCountdown = await getVintageCountdown();
  const { days = 0, hours = 0, minutes = 0, year: vintageYear = new Date().getFullYear() } = vintageCountdown || {};
  const firstName = metrics.agent.first_name || "there";
  
  // Segment-specific opening
  let opening = "";
  switch (metrics.segment) {
    case "new":
      opening = `Welcome to the start of something meaningful. Your first project unlocks the journey — every addition from here builds compounding returns for you, your clients, and the platform.`;
      break;
    case "top_performer":
      opening = `Your leadership continues to strengthen both your returns and the platform. Every project you add sets the pace for what's possible.`;
      break;
    default:
      opening = `Another week of progress as we continue building your portfolio together. Consistent additions create predictable, growing income.`;
  }
  
  // What Moved section (conditional)
  let whatMovedSection = "";
  if (metrics.week_movements.length > 0) {
    const movementsList = metrics.week_movements
      .map((m) => `<li><strong>${m.project_name}</strong>: ${m.old_status} → ${m.new_status} (${formatMwp(m.mwp * 1000)} MWp)</li>`)
      .join("");
    whatMovedSection = `
      <h2 style="color: #333; font-size: 18px; margin-top: 30px;">🔹 What Moved This Week</h2>
      <ul style="color: #555; line-height: 1.8;">${movementsList}</ul>
    `;
  }
  
  // Blockers section (conditional)
  let blockersSection = "";
  if (metrics.blockers.length > 0) {
    const blockersList = metrics.blockers
      .map((b) => `<li><strong>${b.project_name}</strong>: ${b.blocker_type} (${formatMwp(b.mwp * 1000)} MWp)</li>`)
      .join("");
    blockersSection = `
      <h2 style="color: #333; font-size: 18px; margin-top: 30px;">⚠️ Items to Unlock Momentum</h2>
      <p style="color: #555;">These projects need attention to move toward audit-ready:</p>
      <ul style="color: #555; line-height: 1.8;">${blockersList}</ul>
    `;
  }
  
  // Team section messaging
  let teamMessage = "";
  if (metrics.agent.is_team_lead) {
    teamMessage = "Your team is building something real together.";
  } else if (metrics.team_member_count > 1) {
    teamMessage = "When one team member adds a project, everyone's momentum grows.";
  }
  
  // Segment-specific momentum section
  let momentumSection = "";
  switch (metrics.segment) {
    case "new":
      momentumSection = `
        <p style="color: #555;">Your first project opens the door to compounding revenue.</p>
        <p style="color: #555;"><strong>Recommended next step:</strong> Add your first solar installation to start building your portfolio.</p>
      `;
      break;
    case "top_performer":
      momentumSection = `
        <p style="color: #555;">Your portfolio is proving the model — every addition compounds the outcome.</p>
        <p style="color: #555;"><strong>Recommended next step:</strong> Keep the momentum going. Each project added now compounds through 2030.</p>
      `;
      break;
    default:
      momentumSection = `
        <p style="color: #555;">Consistent additions create predictable, growing income.</p>
        <p style="color: #555;"><strong>Recommended next step:</strong> Focus on moving onboarding projects to audit-ready status.</p>
      `;
  }
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">Crunch Carbon Weekly Roundup</h1>
      <p style="color: #666; margin-top: 5px;">Week ending ${getWeekEndDate()}</p>
    </div>
    
    <p style="color: #333; font-size: 16px;">Hi ${firstName},</p>
    <p style="color: #555; line-height: 1.6;">${opening}</p>
    
    ${whatMovedSection}
    
    <h2 style="color: #333; font-size: 18px; margin-top: 30px;">💰 Your Revenue Snapshot</h2>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">Audit-ready</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; font-weight: bold; text-align: right;">${formatMwp(metrics.personal_audit_ready_mwp * 1000)} MWp</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">In onboarding</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; text-align: right;">${formatMwp(metrics.personal_onboarding_mwp * 1000)} MWp</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">Pending signature</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; text-align: right;">${formatMwp(metrics.personal_pending_mwp * 1000)} MWp</td>
      </tr>
      <tr>
        <td style="padding: 12px; color: #555;">Est. commission (2025-2030)</td>
        <td style="padding: 12px; color: #FFCD03; font-weight: bold; text-align: right;">${formatCurrency(metrics.personal_revenue_2025_2030)}</td>
      </tr>
    </table>
    <p style="color: #888; font-size: 13px; font-style: italic;">Every system strengthens both your income and the platform's scale.</p>
    
    <h2 style="color: #333; font-size: 18px; margin-top: 30px;">🏢 Your Team: ${metrics.team_name}</h2>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">Combined audit-ready</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; font-weight: bold; text-align: right;">${formatMwp(metrics.team_audit_ready_mwp * 1000)} MWp</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">Team revenue (2025-2030)</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; text-align: right;">${formatCurrency(metrics.team_revenue_2025_2030)}</td>
      </tr>
      <tr>
        <td style="padding: 12px; color: #555;">Your contribution</td>
        <td style="padding: 12px; color: #333; text-align: right;">${formatMwp(metrics.personal_total_mwp * 1000)} MWp (${metrics.agent_team_contribution_percent.toFixed(0)}% of team)</td>
      </tr>
    </table>
    ${teamMessage ? `<p style="color: #888; font-size: 13px; font-style: italic;">${teamMessage}</p>` : ""}
    
    <h2 style="color: #333; font-size: 18px; margin-top: 30px;">🎯 Our Shared 2026 Goal</h2>
    <p style="color: #555; line-height: 1.6;">Together, all Crunch Carbon agents are building toward <strong>250 MWp</strong> by end of 2026.</p>
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 6px; margin: 15px 0;">
      <div style="background-color: #e0e0e0; border-radius: 4px; height: 20px; overflow: hidden;">
        <div style="background-color: #FFCD03; height: 100%; width: ${Math.min(platformMetrics.goal_progress_percent, 100)}%;"></div>
      </div>
      <p style="color: #555; margin: 15px 0 5px 0;">Platform progress: <strong>${formatMwp(platformMetrics.platform_total_mwp * 1000)} MWp</strong> (${platformMetrics.goal_progress_percent.toFixed(1)}%)</p>
      <p style="color: #555; margin: 5px 0;">Your contribution: <strong>${formatMwp(metrics.personal_total_mwp * 1000)} MWp</strong></p>
    </div>
    <p style="color: #888; font-size: 13px; font-style: italic;">Every project — no matter the size — moves us closer.</p>
    
    ${blockersSection}
    
    <h2 style="color: #333; font-size: 18px; margin-top: 30px;">🚀 Momentum We Can Build On</h2>
    ${momentumSection}
    
    <h2 style="color: #333; font-size: 18px; margin-top: 30px;">⏳ Vintage ${vintageYear} Countdown</h2>
    <div style="background-color: #1a1a1a; color: #FFCD03; padding: 25px; border-radius: 6px; text-align: center; margin: 15px 0;">
      <span style="font-size: 32px; font-weight: bold;">${days}</span><span style="font-size: 14px; margin-right: 15px;"> days</span>
      <span style="font-size: 32px; font-weight: bold;">${hours}</span><span style="font-size: 14px; margin-right: 15px;"> hours</span>
      <span style="font-size: 32px; font-weight: bold;">${minutes}</span><span style="font-size: 14px;"> minutes</span>
    </div>
    <p style="color: #888; font-size: 13px; font-style: italic;">Projects added later simply roll into the next vintage — momentum carries forward.</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #555; line-height: 1.6;">Thanks for continuing to build with us.</p>
    <p style="color: #555; line-height: 1.6;">More projects mean stronger revenue for you, your team, and your clients.</p>
    
    <p style="color: #333; margin-top: 25px;">– Crunch Carbon</p>
  </div>
</body>
</html>
  `;
}

function buildAdminEmailSubject(platformMetrics: PlatformMetrics): string {
  const subjects = [
    `Platform Weekly: ${formatMwp(platformMetrics.platform_audit_ready_mwp * 1000)} MWp audit-ready, ${platformMetrics.active_agent_count} agents building`,
    `Crunch Carbon Week in Review: ${formatCurrency(platformMetrics.platform_total_revenue)} in motion`,
    `Platform Pulse: ${platformMetrics.goal_progress_percent.toFixed(1)}% toward our 250 MWp goal`,
  ];
  return subjects[Math.floor(Math.random() * subjects.length)];
}

async function buildAdminEmailHtml(admin: AgentData, platformMetrics: PlatformMetrics): Promise<string> {
  const vintageCountdown = await getVintageCountdown();
  const { days = 0, hours = 0, minutes = 0, year: vintageYear = new Date().getFullYear() } = vintageCountdown || {};
  const firstName = admin.first_name || "Admin";
  const analytics = await getRoundupAnalytics(supabase, 7);
  const analyticsHtml = renderAnalyticsHtml(analytics);
  
  // Team performance table
  const teamsTable = platformMetrics.teams
    .map(
      (t) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; font-weight: 500;">${t.team_name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; text-align: right;">${formatMwp(t.team_audit_ready_mwp * 1000)} MWp</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; text-align: right;">${formatMwp(t.team_total_mwp * 1000)} MWp</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; text-align: center;">${t.team_active_agents}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: ${t.team_week_change_mwp > 0 ? "#22c55e" : "#666"}; text-align: right;">${t.team_week_change_mwp > 0 ? "+" : ""}${formatMwp(t.team_week_change_mwp * 1000)} MWp</td>
      </tr>
    `
    )
    .join("");
  
  // Top agents list
  const topAgentsList = platformMetrics.top_agents
    .map(
      (a) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">${a.rank}. ${a.agent_name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">${a.agent_company}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333; text-align: right;">${formatMwp(a.agent_audit_ready_mwp * 1000)} MWp</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; color: #FFCD03; text-align: right; font-weight: 500;">${formatCurrency(a.agent_revenue)}</td>
      </tr>
    `
    )
    .join("");
  
  // New agents list
  let newAgentsSection = "";
  if (platformMetrics.new_agents.length > 0) {
    const newAgentsList = platformMetrics.new_agents
      .map((a) => `<li>${a.agent_name} joined ${a.company_name} on ${a.join_date}</li>`)
      .join("");
    newAgentsSection = `<ul style="color: #555; line-height: 1.8;">${newAgentsList}</ul>`;
  } else {
    newAgentsSection = `<p style="color: #888; font-style: italic;">No new agents this week.</p>`;
  }
  
  // Blockers summary
  let blockersSection = "";
  if (platformMetrics.blocker_summary.length > 0) {
    const blockersList = platformMetrics.blocker_summary
      .map((b) => `<li>${b.blocker_count} projects awaiting ${b.blocker_type}</li>`)
      .join("");
    blockersSection = `
      <ul style="color: #555; line-height: 1.8;">${blockersList}</ul>
      <p style="color: #555;">Total blocked revenue: <strong>${formatCurrency(platformMetrics.blocked_revenue)}</strong></p>
    `;
  } else {
    blockersSection = `<p style="color: #22c55e;">✅ No significant blockers this week!</p>`;
  }
  
  // Goal tracking
  const onTrack = platformMetrics.goal_progress_percent >= 20; // Rough estimate for being on track
  const goalStatus = onTrack
    ? `<p style="color: #22c55e;">✅ On track — current pace exceeds target</p>`
    : `<p style="color: #f59e0b;">⚠️ Below pace — need to accelerate project additions</p>`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">Platform Weekly Summary</h1>
      <p style="color: #666; margin-top: 5px;">Week ending ${getWeekEndDate()}</p>
    </div>
    
    <p style="color: #333; font-size: 16px;">Hi ${firstName},</p>
    <p style="color: #555; line-height: 1.6;">Here's your Crunch Carbon platform overview.</p>
    
    <h2 style="color: #333; font-size: 18px; margin-top: 30px;">📊 Platform Snapshot</h2>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">Total audit-ready</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; font-weight: bold; text-align: right;">${formatMwp(platformMetrics.platform_audit_ready_mwp * 1000)} MWp</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">Total onboarding</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; text-align: right;">${formatMwp(platformMetrics.platform_onboarding_mwp * 1000)} MWp</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">Pending signatures</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; text-align: right;">${formatMwp(platformMetrics.platform_pending_mwp * 1000)} MWp</td>
      </tr>
    </table>
    
    <h3 style="color: #333; font-size: 16px; margin-top: 20px;">Revenue Potential (2025-2030)</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">Client share</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; text-align: right;">${formatCurrency(platformMetrics.platform_client_revenue)}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">Agent commissions</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; text-align: right;">${formatCurrency(platformMetrics.platform_agent_revenue)}</td>
      </tr>
      <tr>
        <td style="padding: 12px; color: #555;">Platform revenue</td>
        <td style="padding: 12px; color: #FFCD03; font-weight: bold; text-align: right;">${formatCurrency(platformMetrics.platform_platform_revenue)}</td>
      </tr>
    </table>
    
    <h2 style="color: #333; font-size: 18px; margin-top: 30px;">📈 Week-over-Week Movement</h2>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">New proposals created</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333; text-align: right;">${platformMetrics.new_proposals_count} (${formatMwp(platformMetrics.new_proposals_mwp * 1000)} MWp)</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">Proposals signed</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #22c55e; font-weight: bold; text-align: right;">${platformMetrics.signed_proposals_count} (${formatMwp(platformMetrics.signed_mwp * 1000)} MWp)</td>
      </tr>
      <tr>
        <td style="padding: 12px; color: #555;">Weekly MWp added</td>
        <td style="padding: 12px; color: #333; font-weight: bold; text-align: right;">${formatMwp(platformMetrics.weekly_mwp_added * 1000)} MWp</td>
      </tr>
    </table>
    
    <h2 style="color: #333; font-size: 18px; margin-top: 30px;">🏢 Team Performance</h2>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
      <thead>
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 12px; text-align: left; color: #666; font-weight: 600;">Team</th>
          <th style="padding: 12px; text-align: right; color: #666; font-weight: 600;">Audit Ready</th>
          <th style="padding: 12px; text-align: right; color: #666; font-weight: 600;">Total</th>
          <th style="padding: 12px; text-align: center; color: #666; font-weight: 600;">Agents</th>
          <th style="padding: 12px; text-align: right; color: #666; font-weight: 600;">Week Δ</th>
        </tr>
      </thead>
      <tbody>
        ${teamsTable}
      </tbody>
    </table>
    
    <h2 style="color: #333; font-size: 18px; margin-top: 30px;">🌟 Agent Highlights</h2>
    <h3 style="color: #555; font-size: 15px; margin-top: 15px;">Top contributors:</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
      <thead>
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 10px; text-align: left; color: #666; font-weight: 600;">Agent</th>
          <th style="padding: 10px; text-align: left; color: #666; font-weight: 600;">Company</th>
          <th style="padding: 10px; text-align: right; color: #666; font-weight: 600;">Audit Ready</th>
          <th style="padding: 10px; text-align: right; color: #666; font-weight: 600;">Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${topAgentsList}
      </tbody>
    </table>
    
    <h3 style="color: #555; font-size: 15px; margin-top: 20px;">New agents onboarded: ${platformMetrics.new_agents_count}</h3>
    ${newAgentsSection}
    
    <h2 style="color: #333; font-size: 18px; margin-top: 30px;">🎯 Collective 2026 Goal Progress</h2>
    <p style="color: #555;">Target: <strong>250 MWp</strong> by end of 2026</p>
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 6px; margin: 15px 0;">
      <div style="background-color: #e0e0e0; border-radius: 4px; height: 24px; overflow: hidden;">
        <div style="background-color: #FFCD03; height: 100%; width: ${Math.min(platformMetrics.goal_progress_percent, 100)}%;"></div>
      </div>
      <p style="color: #333; margin: 15px 0 5px 0; font-size: 18px;"><strong>${formatMwp(platformMetrics.platform_total_mwp * 1000)} MWp</strong> (${platformMetrics.goal_progress_percent.toFixed(1)}%)</p>
      <p style="color: #555; margin: 5px 0;">Weekly addition: <strong>${formatMwp(platformMetrics.weekly_mwp_added * 1000)} MWp</strong></p>
      ${goalStatus}
    </div>
    
    <h2 style="color: #333; font-size: 18px; margin-top: 30px;">⚠️ Platform Blockers Overview</h2>
    ${blockersSection}
    
    ${analyticsHtml}
    
    <h2 style="color: #333; font-size: 18px; margin-top: 30px;">⏳ Vintage ${vintageYear} Countdown</h2>
    <div style="background-color: #1a1a1a; color: #FFCD03; padding: 25px; border-radius: 6px; text-align: center; margin: 15px 0;">
      <span style="font-size: 32px; font-weight: bold;">${days}</span><span style="font-size: 14px; margin-right: 15px;"> days</span>
      <span style="font-size: 32px; font-weight: bold;">${hours}</span><span style="font-size: 14px; margin-right: 15px;"> hours</span>
      <span style="font-size: 32px; font-weight: bold;">${minutes}</span><span style="font-size: 14px;"> minutes</span>
    </div>
    <p style="color: #888; font-size: 13px; font-style: italic;">Projects not audit-ready by the deadline roll into Vintage ${vintageYear + 1}.</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #555; line-height: 1.6;">Keep building.</p>
    <p style="color: #333; margin-top: 25px;">– Crunch Carbon System</p>
  </div>
</body>
</html>
  `;
}

// ============================================================================
// EMAIL SENDING WITH RATE LIMITING
// ============================================================================

async function sendEmailWithRetry(
  to: string,
  subject: string,
  html: string,
  maxRetries = 3
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response: any = await resend.emails.send({
        from: "Crunch Carbon <noreply@crunchcarbon.com>",
        to: [to],
        subject,
        html,
      });

      console.log(`Email sent successfully to ${to}:`, response);
      const messageId = response?.data?.id ?? response?.id;
      return { success: true, messageId };
    } catch (error: any) {
      console.error(`Email send attempt ${attempt} failed for ${to}:`, error);

      if (error?.statusCode === 429 && attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited. Waiting ${backoffMs}ms before retry...`);
        await sleep(backoffMs);
        continue;
      }

      if (attempt === maxRetries) {
        return { success: false, error: error.message || "Unknown error" };
      }
    }
  }

  return { success: false, error: "Max retries exceeded" };
}

// ============================================================================
// PHASE 3: Ranking + CTA event logging
// ============================================================================

interface RankSnapshot {
  agentId: string;
  auditReadyMwp: number;
}

function rankAgents(snapshots: RankSnapshot[]): Map<string, number> {
  const sorted = snapshots
    .filter((s) => s.auditReadyMwp > 0)
    .sort((a, b) => b.auditReadyMwp - a.auditReadyMwp);
  const ranks = new Map<string, number>();
  sorted.forEach((s, i) => ranks.set(s.agentId, i + 1));
  return ranks;
}

async function logEmailCtaEvent(params: {
  agentId: string;
  sendId: string;
  messageId?: string;
  subject: string;
  variant: "A" | "B";
  segment: AgentSegmentV2;
}): Promise<void> {
  try {
    await supabase.from("email_cta_events").insert({
      agent_id: params.agentId,
      email_send_id: params.sendId,
      message_id: params.messageId ?? null,
      email_type: "weekly_roundup",
      cta_type: "email_sent",
      target_url: null,
      variant: params.variant,
      subject: params.subject,
      sent_at: new Date().toISOString(),
      raw_payload: { segment: params.segment },
    });
  } catch (e: any) {
    console.error(`[email_cta_events] insert failed for ${params.agentId}:`, e?.message);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  console.log("=== Starting Weekly Roundup Email Job ===");
  console.log("Time:", new Date().toISOString());
  
  // Parse request body for test mode parameters
  let testAgentEmail: string | null = null;
  let testAdminEmail: string | null = null;
  
  try {
    const body = await req.json();
    testAgentEmail = body.testAgentEmail || null;
    testAdminEmail = body.testAdminEmail || null;
  } catch {
    // No body or invalid JSON - that's fine, run in production mode
  }
  
  const isTestMode = !!(testAgentEmail || testAdminEmail);
  
  if (isTestMode) {
    console.log("=== TEST MODE ENABLED ===");
    console.log("Test Agent Email:", testAgentEmail || "(none)");
    console.log("Test Admin Email:", testAdminEmail || "(none)");
  }
  
  try {
    // Load dynamic carbon prices once per invocation (replaces hardcoded constants)
    CARBON_PRICES_CACHE = await getCarbonPrices(supabase);
    console.log("Loaded dynamic carbon prices:", CARBON_PRICES_CACHE);

    // Fetch all data
    const [agents, admins, proposals, onboarding, newAgents] = await Promise.all([
      fetchActiveAgents(),
      fetchAdmins(),
      fetchAllProposals(),
      fetchProjectOnboarding(),
      fetchNewAgentsThisWeek(),
    ]);
    
    // Build onboarding lookup map
    const onboardingMap = new Map<string, ProjectOnboardingData>();
    onboarding.forEach((o) => onboardingMap.set(o.proposal_id, o));
    
    // Calculate platform metrics (needed for both email types)
    const platformMetrics = calculatePlatformMetrics(agents, proposals, onboardingMap, newAgents);
    const teamMetrics = platformMetrics.teams;

    console.log("Platform Metrics:", {
      audit_ready_mwp: platformMetrics.platform_audit_ready_mwp,
      total_mwp: platformMetrics.platform_total_mwp,
      goal_progress: platformMetrics.goal_progress_percent,
      active_agents: platformMetrics.active_agent_count,
    });

    // ---- Phase 3: rankings (current vs previous snapshot) ----
    const currentRankInputs: RankSnapshot[] = agents.map((a) => {
      const m = calculateAgentMetrics(a, proposals, onboardingMap, teamMetrics);
      return { agentId: a.id, auditReadyMwp: m.personal_audit_ready_mwp };
    });
    const currentRanks = rankAgents(currentRankInputs);

    const { data: priorSnapshotRows } = await supabase
      .from("agent_weekly_snapshots")
      .select("agent_id, audit_ready_mwp, snapshot_date")
      .lt("snapshot_date", new Date().toISOString().slice(0, 10))
      .order("snapshot_date", { ascending: false });

    const priorByAgent = new Map<string, number>();
    (priorSnapshotRows || []).forEach((r: any) => {
      if (!priorByAgent.has(r.agent_id)) priorByAgent.set(r.agent_id, Number(r.audit_ready_mwp));
    });
    const previousRanks = rankAgents(
      Array.from(priorByAgent.entries()).map(([agentId, auditReadyMwp]) => ({ agentId, auditReadyMwp }))
    );
    const totalRanked = currentRanks.size;

    let agentEmailsSent = 0;
    let agentEmailsFailed = 0;
    let adminEmailsSent = 0;
    let adminEmailsFailed = 0;

    // helper to generate a per-send id
    const makeSendId = () => crypto.randomUUID();

    // TEST MODE: Send to specific test emails only
    if (isTestMode) {
      if (testAgentEmail) {
        const targetAgent = agents.find((a) => a.email.toLowerCase() === testAgentEmail.toLowerCase()) || agents[0];

        if (targetAgent) {
          const metrics = calculateAgentMetrics(targetAgent, proposals, onboardingMap, teamMetrics);
          const sendId = makeSendId();
          const variant = pickVariant();
          const built = await buildAgentEmail(
            targetAgent,
            metrics,
            proposals,
            {
              currentRank: currentRanks.get(targetAgent.id) ?? null,
              previousRank: previousRanks.get(targetAgent.id) ?? null,
              totalRanked,
            },
            { sendId, variant }
          );
          const subject = `[TEST] ${built.subject}`;
          const html = built.html;

          console.log(`Sending TEST agent email to: ${testAgentEmail} (variant ${variant}, segment ${built.segmentV2})`);

          const result = await sendEmailWithRetry(testAgentEmail, subject, html);
          if (result.success) {
            agentEmailsSent++;
            await logEmailCtaEvent({
              agentId: targetAgent.id,
              sendId,
              messageId: result.messageId,
              subject,
              variant,
              segment: built.segmentV2,
            });
            console.log(`TEST agent email sent successfully to ${testAgentEmail}`);
          } else {
            agentEmailsFailed++;
            console.error(`Failed to send TEST agent email to ${testAgentEmail}: ${result.error}`);
          }
        } else {
          console.log("No agents found to use as template for test email");
        }
      }

      if (testAdminEmail) {
        const targetAdmin = admins.find((a) => a.email.toLowerCase() === testAdminEmail.toLowerCase()) || admins[0];

        if (targetAdmin) {
          const subject = `[TEST] ${buildAdminEmailSubject(platformMetrics)}`;
          const html = await buildAdminEmailHtml(targetAdmin, platformMetrics);

          console.log(`Sending TEST admin email to: ${testAdminEmail}`);

          const result = await sendEmailWithRetry(testAdminEmail, subject, html);
          if (result.success) {
            adminEmailsSent++;
            console.log(`TEST admin email sent successfully to ${testAdminEmail}`);
          } else {
            adminEmailsFailed++;
            console.error(`Failed to send TEST admin email to ${testAdminEmail}: ${result.error}`);
          }
        } else {
          console.log("No admins found to use as template for test email");
        }
      }
    } else {
      // PRODUCTION MODE
      console.log(`\n--- Sending ${agents.length} Agent Roundup emails ---`);
      for (const agent of agents) {
        const metrics = calculateAgentMetrics(agent, proposals, onboardingMap, teamMetrics);
        const sendId = makeSendId();
        const variant = pickVariant();
        const built = await buildAgentEmail(
          agent,
          metrics,
          proposals,
          {
            currentRank: currentRanks.get(agent.id) ?? null,
            previousRank: previousRanks.get(agent.id) ?? null,
            totalRanked,
          },
          { sendId, variant }
        );
        const subject = built.subject;
        const html = built.html;

        console.log(`Sending to agent: ${agent.email} (${built.segmentV2}, variant ${variant})`);

        const result = await sendEmailWithRetry(agent.email, subject, html);
        if (result.success) {
          agentEmailsSent++;
          await logEmailCtaEvent({
            agentId: agent.id,
            sendId,
            messageId: result.messageId,
            subject,
            variant,
            segment: built.segmentV2,
          });
        } else {
          agentEmailsFailed++;
          console.error(`Failed to send to ${agent.email}: ${result.error}`);
        }
        
        // Rate limiting: 600ms between emails
        await sleep(600);
      }
      
      // Send Admin Platform Summary emails
      console.log(`\n--- Sending ${admins.length} Admin Platform Summary emails ---`);
      for (const admin of admins) {
        const subject = buildAdminEmailSubject(platformMetrics);
        const html = await buildAdminEmailHtml(admin, platformMetrics);
        
        console.log(`Sending to admin: ${admin.email}`);
        
        const result = await sendEmailWithRetry(admin.email, subject, html);
        if (result.success) {
          adminEmailsSent++;
        } else {
          adminEmailsFailed++;
          console.error(`Failed to send to ${admin.email}: ${result.error}`);
        }
        
        // Rate limiting: 600ms between emails
        await sleep(600);
      }
    }
    
    // Summary
    const summary = {
      timestamp: new Date().toISOString(),
      test_mode: isTestMode,
      test_agent_email: testAgentEmail,
      test_admin_email: testAdminEmail,
      agent_emails_sent: agentEmailsSent,
      agent_emails_failed: agentEmailsFailed,
      admin_emails_sent: adminEmailsSent,
      admin_emails_failed: adminEmailsFailed,
      total_sent: agentEmailsSent + adminEmailsSent,
      total_failed: agentEmailsFailed + adminEmailsFailed,
    };
    
    console.log("\n=== Weekly Roundup Email Job Complete ===");
    console.log("Summary:", summary);
    
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Fatal error in weekly roundup job:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
