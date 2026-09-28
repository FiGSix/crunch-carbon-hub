import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { CARBON_PRICES } from '@/lib/calculations/carbon/constants';

export type RevenueScope =
  | 'pipeline'
  | 'signed'
  | 'audit_ready'
  | 'signed_audit_ready'
  | 'all';

export interface YearlyRevenueRow {
  year: string; // 'blend' | '2025' ... '2037'
  label: string;
  price: number; // default rate-set price (per-client sets may differ)
  estimated: boolean;
  tonnes: number;
  total: number;
  client: number;
  partner: number;
  superPartner: number;
  crunch: number;
}

export interface AdminRevenueYearlyTable {
  rows: YearlyRevenueRow[];
  subtotalCurrent: YearlyRevenueRow; // Blend + 2025-2030
  subtotalEstimated: YearlyRevenueRow; // 2031-2037
  grandTotal: YearlyRevenueRow;
  projectCount: number;
  specialRateProjects: number; // projects priced on a non-default rate set
}

const BLEND_CUTOFF_DATE = new Date('2024-12-31T23:59:59');
const CURRENT_YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'];
const ESTIMATED_YEARS = ['2031', '2032', '2033', '2034', '2035', '2036', '2037'];
const EST_ESCALATION = 1.05; // 5% p.a. beyond 2030, per agreed convention

/** Statuses that count as live pipeline — mirrors get_dashboard_metrics_by_stage. */
const PIPELINE_STATUSES = ['draft', 'sent', 'delivered', 'opened', 'viewed', 'stale'];

const emptyRow = (year: string, label: string, price: number, estimated: boolean): YearlyRevenueRow => ({
  year,
  label,
  price,
  estimated,
  tonnes: 0,
  total: 0,
  client: 0,
  partner: 0,
  superPartner: 0,
  crunch: 0,
});

const addInto = (target: YearlyRevenueRow, source: YearlyRevenueRow) => {
  target.tonnes += source.tonnes;
  target.total += source.total;
  target.client += source.client;
  target.partner += source.partner;
  target.superPartner += source.superPartner;
  target.crunch += source.crunch;
};

/** Price for an estimated year: 5% p.a. escalation off that proposal's own 2030 rate. */
const estimatedPrice = (price2030: number, year: string) =>
  price2030 * Math.pow(EST_ESCALATION, Number(year) - 2030);

/**
 * Commissioning pro-rata factor for a year — identical rule to
 * get_dashboard_metrics_by_stage: 0 before the commissioning year, day-count
 * pro-rata in the commissioning year, 1 thereafter.
 */
const proRataFactor = (year: number, commissionDate: Date | null): number => {
  if (!commissionDate) return 1;
  const commissionYear = commissionDate.getFullYear();
  if (year < commissionYear) return 0;
  if (year > commissionYear) return 1;
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const day = 1000 * 60 * 60 * 24;
  const remainingDays = Math.max(0, Math.floor((yearEnd.getTime() - commissionDate.getTime()) / day) + 1);
  const totalDays = Math.floor((yearEnd.getTime() - yearStart.getTime()) / day) + 1;
  return remainingDays / totalDays;
};

/**
 * Admin-only year-by-year revenue breakdown (Blend -> 2037) with a scope filter.
 *
 * Aligned with get_dashboard_metrics_by_stage so both surfaces agree:
 *   - live prices from the client's carbon rate set (default set as fallback)
 *   - commissioning-date pro-rating
 *   - archived / deleted proposals excluded
 *   - the same stage definitions (audit ready implies signed, pipeline status allow-list)
 *
 * Split math: total = credits * price; client / partner by proposal percentages;
 * super partner by super_partner_commissions.commission_rate; crunch = remainder.
 */
export function useAdminRevenueYearlyTable(scope: RevenueScope) {
  const { user, userRole } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.dashboard.adminRevenueYearlyTable(scope), user?.id, userRole],
    queryFn: async (): Promise<AdminRevenueYearlyTable> => {
      const emptyTable: AdminRevenueYearlyTable = {
        rows: [],
        subtotalCurrent: emptyRow('subtotal-current', 'Subtotal (Blend-2030)', 0, false),
        subtotalEstimated: emptyRow('subtotal-estimated', 'Subtotal (2031-2037 est.)', 0, true),
        grandTotal: emptyRow('grand-total', 'Grand total', 0, false),
        projectCount: 0,
        specialRateProjects: 0,
      };

      // Row-level access rules scope proposals to what this viewer may see.
      if (!user?.id) return emptyTable;

      const revenueLogger = logger.withContext({
        component: 'useAdminRevenueYearlyTable',
        feature: 'admin-revenue-yearly-table',
        userId: user.id,
      });

      // Proposals with onboarding audit flag and commissioning date
      const { data: proposals, error } = await (supabase.from('proposals') as any)
        .select(`
          id,
          carbon_credits,
          client_share_percentage,
          agent_commission_percentage,
          signed_at,
          status,
          client_reference_id,
          commission_date:content->projectInfo->>commissionDate,
          project_onboarding(audit_ready)
        `)
        .is('deleted_at', null)
        .is('archived_at', null);


      if (error) {
        revenueLogger.error('Failed to fetch proposals for yearly revenue table', { error: error.message });
        throw error;
      }

      // Carbon rate sets (default + client-specific)
      const { data: rateSets, error: rateSetError } = await supabase
        .from('carbon_rate_sets')
        .select('id, prices, is_default');

      if (rateSetError) {
        revenueLogger.error('Failed to fetch carbon rate sets', { error: rateSetError.message });
        throw rateSetError;
      }

      const pricesBySet = new Map<string, Record<string, number>>();
      let defaultPrices: Record<string, number> = CARBON_PRICES;
      rateSets?.forEach((set) => {
        const prices = (set.prices || {}) as Record<string, number>;
        pricesBySet.set(set.id, prices);
        if (set.is_default) defaultPrices = prices;
      });

      // Clients on a non-default rate set
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('id, carbon_rate_set_id')
        .not('carbon_rate_set_id', 'is', null);

      if (clientError) {
        revenueLogger.error('Failed to fetch client rate set assignments', { error: clientError.message });
        throw clientError;
      }

      const rateSetByClient = new Map<string, string>();
      clients?.forEach((c) => {
        if (c.carbon_rate_set_id) rateSetByClient.set(c.id, c.carbon_rate_set_id);
      });

      // Super partner commission rates per proposal
      const { data: spCommissions, error: spError } = await supabase
        .from('super_partner_commissions')
        .select('proposal_id, commission_rate');

      if (spError) {
        revenueLogger.error('Failed to fetch super partner commissions', { error: spError.message });
        throw spError;
      }

      const spRateByProposal = new Map<string, number>();
      spCommissions?.forEach((row) => {
        if (row.proposal_id && row.commission_rate != null) {
          const rate = Number(row.commission_rate);
          const existing = spRateByProposal.get(row.proposal_id) ?? 0;
          if (rate > existing) spRateByProposal.set(row.proposal_id, rate);
        }
      });

      // Scope filtering — same stage definitions as the dashboard funnel
      const inScope = (p: any): boolean => {
        const isSigned = !!p.signed_at;
        const onboarding = Array.isArray(p.project_onboarding)
          ? p.project_onboarding[0]
          : p.project_onboarding;
        const isAuditReady = isSigned && onboarding?.audit_ready === true;
        const isPipeline = !isSigned && PIPELINE_STATUSES.includes(p.status);

        switch (scope) {
          case 'pipeline':
            return isPipeline;
          case 'signed':
            return isSigned;
          case 'audit_ready':
            return isAuditReady;
          case 'signed_audit_ready':
            return isSigned || isAuditReady;
          case 'all':
            return isSigned || isPipeline;
        }
      };

      const scoped = (proposals || []).filter(inScope);

      // Initialise rows using the default rate set for the displayed price column
      const default2030 = Number(defaultPrices['2030']) || 0;
      const rows: YearlyRevenueRow[] = [
        emptyRow('blend', 'Blend (2022-2024)', Number(defaultPrices['2024']) || 0, false),
        ...CURRENT_YEARS.map((y) => emptyRow(y, y, Number(defaultPrices[y]) || 0, false)),
        ...ESTIMATED_YEARS.map((y) => emptyRow(y, y, Math.round(estimatedPrice(default2030, y)), true)),
      ];
      const rowByYear = new Map(rows.map((r) => [r.year, r]));

      let specialRateProjects = 0;

      scoped.forEach((p: any) => {
        const carbonCredits = p.carbon_credits || 0;
        const clientPct = p.client_share_percentage || 0;
        const agentPct = p.agent_commission_percentage || 0;
        const spPct = spRateByProposal.get(p.id) || 0;
        const signedAt = p.signed_at ? new Date(p.signed_at) : null;
        const commissionDate = p.commission_date ? new Date(p.commission_date) : null;

        // Per-client rate set, falling back to the default set
        const setId = p.client_reference_id ? rateSetByClient.get(p.client_reference_id) : undefined;
        const proposalPrices = (setId && pricesBySet.get(setId)) || defaultPrices;
        if (setId && pricesBySet.has(setId) && proposalPrices !== defaultPrices) specialRateProjects += 1;
        const proposal2030 = Number(proposalPrices['2030']) || 0;

        const applyYear = (row: YearlyRevenueRow, price: number, factor: number) => {
          if (factor <= 0 || price <= 0) return;
          const credits = carbonCredits * factor;
          const total = credits * price;
          const client = total * (clientPct / 100);
          const partner = total * (agentPct / 100);
          const superPartner = total * (spPct / 100);
          row.tonnes += credits;
          row.total += total;
          row.client += client;
          row.partner += partner;
          row.superPartner += superPartner;
          row.crunch += total - client - partner - superPartner;
        };

        // Blend only for projects signed on/before 2024-12-31
        if (signedAt && signedAt <= BLEND_CUTOFF_DATE) {
          applyYear(
            rowByYear.get('blend')!,
            Number(proposalPrices['2024']) || 0,
            proRataFactor(2024, commissionDate)
          );
        }

        CURRENT_YEARS.forEach((y) => {
          applyYear(rowByYear.get(y)!, Number(proposalPrices[y]) || 0, proRataFactor(Number(y), commissionDate));
        });

        ESTIMATED_YEARS.forEach((y) => {
          applyYear(rowByYear.get(y)!, estimatedPrice(proposal2030, y), proRataFactor(Number(y), commissionDate));
        });
      });

      // Round everything
      const roundRow = (r: YearlyRevenueRow) => {
        r.tonnes = Math.round(r.tonnes);
        r.total = Math.round(r.total);
        r.client = Math.round(r.client);
        r.partner = Math.round(r.partner);
        r.superPartner = Math.round(r.superPartner);
        r.crunch = Math.round(r.crunch);
      };
      rows.forEach(roundRow);

      const subtotalCurrent = emptyRow('subtotal-current', 'Subtotal (Blend-2030)', 0, false);
      const subtotalEstimated = emptyRow('subtotal-estimated', 'Subtotal (2031-2037 est.)', 0, true);
      const grandTotal = emptyRow('grand-total', 'Grand total', 0, false);

      rows.forEach((r) => {
        if (r.year === 'blend' || CURRENT_YEARS.includes(r.year)) addInto(subtotalCurrent, r);
        if (ESTIMATED_YEARS.includes(r.year)) addInto(subtotalEstimated, r);
      });
      addInto(grandTotal, subtotalCurrent);
      addInto(grandTotal, subtotalEstimated);

      revenueLogger.info('Yearly revenue table calculated', {
        scope,
        projectCount: scoped.length,
        specialRateProjects,
      });

      return {
        rows,
        subtotalCurrent,
        subtotalEstimated,
        grandTotal,
        projectCount: scoped.length,
        specialRateProjects,
      };
    },
    enabled: !!user?.id && userRole === 'admin',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
