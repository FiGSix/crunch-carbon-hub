export interface CompanyMembership {
  user_id: string;
  status: string;
  can_sign_agreements: boolean;
}

export interface SignerAuthorizationInput {
  companyId: string | null;
  authenticatedUserId: string | null;
  memberships: CompanyMembership[];
  /**
   * True when the caller presented the proposal's own valid, unexpired
   * invitation token. The link is issued to one named recipient at their own
   * address, so holding it is proof of identity in its own right.
   */
  holdsValidInvitationToken?: boolean;
}

export interface SignerAuthorizationResult {
  allowed: boolean;
  requiresAuthentication: boolean;
  authorisedVia?: "invitation_token" | "company_member" | "unmanaged";
  reason?: string;
}

export function authorizeCompanySigner({
  companyId,
  authenticatedUserId,
  memberships,
  holdsValidInvitationToken = false,
}: SignerAuthorizationInput): SignerAuthorizationResult {
  if (!companyId)
    return {
      allowed: true,
      requiresAuthentication: false,
      authorisedVia: "unmanaged",
    };

  const activeMemberships = memberships.filter(
    (membership) => membership.status === "active",
  );
  if (!authenticatedUserId) {
    if (activeMemberships.length === 0) {
      return {
        allowed: true,
        requiresAuthentication: false,
        authorisedVia: "unmanaged",
      };
    }
    if (holdsValidInvitationToken) {
      return {
        allowed: true,
        requiresAuthentication: false,
        authorisedVia: "invitation_token",
      };
    }
    return {
      allowed: false,
      requiresAuthentication: true,
      reason:
        "Please sign in with an authorised company account to sign this agreement.",
    };
  }

  const signerMembership = activeMemberships.find(
    (membership) => membership.user_id === authenticatedUserId,
  );
  if (!signerMembership?.can_sign_agreements) {
    return {
      allowed: false,
      requiresAuthentication: false,
      reason: "Your company account is not authorised to sign agreements.",
    };
  }

  return {
    allowed: true,
    requiresAuthentication: false,
    authorisedVia: "company_member",
  };
}

export function resolveStoredSignatoryName(
  authenticatedProfileName: string | null,
  callerSuppliedName: string,
): string {
  return authenticatedProfileName?.trim() || callerSuppliedName.trim();
}
