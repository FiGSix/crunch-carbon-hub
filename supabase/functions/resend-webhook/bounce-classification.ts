export interface ResendBounceDetails {
  type?: string;
  subType?: string;
  reason?: string;
}

export function normalizeEmail(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function isPrimaryRecipient(
  webhookRecipient?: string | null,
  primaryRecipient?: string | null,
): boolean {
  const webhookEmail = normalizeEmail(webhookRecipient);
  const primaryEmail = normalizeEmail(primaryRecipient);
  return Boolean(webhookEmail && primaryEmail && webhookEmail === primaryEmail);
}

export function isRetryableBounce(bounce?: ResendBounceDetails): boolean {
  return bounce?.type?.toLowerCase() === 'transient';
}