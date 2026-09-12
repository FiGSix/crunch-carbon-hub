export interface CompanyMembership {
  user_id: string;
  status: string;
  can_sign_agreements: boolean;
}

export interface SignerAuthorizationInput {
  companyId: string | null;
  authenticatedUserId: string | null;
  memberships: CompanyMembership[];
}

export interface SignerAuthorizationResult {
  allowed: boolean;
  requiresAuthentication: boolean;
  reason?: string;
}

export function authorizeCompanySigner({ companyId, authenticatedUserId, memberships }: SignerAuthorizationInput): SignerAuthorizationResult {
  if (!companyId) return { allowed: true, requiresAuthentication: false };

  const activeMemberships = memberships.filter((membership) => membership.status === 'active');
  if (!authenticatedUserId) {
    return activeMemberships.length === 0
      ? { allowed: true, requiresAuthentication: false }
      : {
          allowed: false,
          requiresAuthentication: true,
          reason: 'Please sign in with an authorised company account to sign this agreement.',
        };
  }

  const signerMembership = activeMemberships.find((membership) => membership.user_id === authenticatedUserId);
  if (!signerMembership?.can_sign_agreements) {
    return {
      allowed: false,
      requiresAuthentication: false,
      reason: 'Your company account is not authorised to sign agreements.',
    };
  }

  return { allowed: true, requiresAuthentication: false };
}

export function resolveStoredSignatoryName(authenticatedProfileName: string | null, callerSuppliedName: string): string {
  return authenticatedProfileName?.trim() || callerSuppliedName.trim();
}