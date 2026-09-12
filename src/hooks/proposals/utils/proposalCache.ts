import { ProposalCache, ProposalFilters } from "../types";
import { ProposalListItem } from "@/types/proposals";

// Cache duration in milliseconds (10 seconds)
const CACHE_DURATION = 10000;

// In-memory cache store
let proposalsCache: ProposalCache | null = null;
let proposalsCacheUserId: string | null = null;

/**
 * Check if cache is valid based on filters and timestamp
 */
export function isCacheValid(filters: ProposalFilters, userId: string | null): boolean {
  if (!proposalsCache) return false;
  if (!userId || proposalsCacheUserId !== userId) return false;
  
  const now = Date.now();
  const isExpired = now - proposalsCache.timestamp > CACHE_DURATION;
  
  if (isExpired) return false;
  
  // Check if filters match
  return (
    proposalsCache.filters.search === filters.search &&
    proposalsCache.filters.status === filters.status &&
    proposalsCache.filters.sort === filters.sort
  );
}

/**
 * Get proposals from cache
 */
export function getCachedProposals(): ProposalListItem[] | null {
  if (!proposalsCache) return null;
  return proposalsCache.data;
}

/**
 * Update the proposals cache
 */
export function updateProposalsCache(
  proposals: ProposalListItem[], 
  filters: ProposalFilters,
  userId: string
): void {
  proposalsCache = {
    data: proposals,
    filters: { ...filters },
    timestamp: Date.now()
  };
  proposalsCacheUserId = userId;
}

/**
 * Clear the cache (useful when new proposals are created/modified)
 */
export function clearProposalsCache(): void {
  proposalsCache = null;
  proposalsCacheUserId = null;
}

export function setCachedProposals(proposals: any[]) {
  const cacheKey = 'proposals_cache';
  const cacheData = {
    data: proposals,
    timestamp: Date.now()
  };
  localStorage.setItem(cacheKey, JSON.stringify(cacheData));
}
