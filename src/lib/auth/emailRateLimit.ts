/**
 * Detection and messaging for Supabase Auth's project-wide hourly cap on
 * account emails (sign-up confirmations, password resets, invitations,
 * magic links). When the pool is empty Supabase answers HTTP 429 with
 * error code `over_email_send_rate_limit` and sends no email.
 */

export const EMAIL_RATE_LIMIT_CODE = 'over_email_send_rate_limit';

/** Seconds the submit button stays disabled after a rate-limited attempt. */
export const EMAIL_RATE_LIMIT_COOLDOWN_SECONDS = 60;

export const EMAIL_RATE_LIMIT_TITLE = 'Too many verification emails right now';

export const EMAIL_RATE_LIMIT_MESSAGE =
  "We've sent a lot of verification emails in the last hour. Please wait a few minutes and try again — your details are saved.";

type MaybeAuthError = {
  code?: string | null;
  status?: number | null;
  message?: string | null;
  error_code?: string | null;
} | null | undefined;

/**
 * True when the error is Supabase's auth email rate limit, regardless of
 * whether it arrives as a structured AuthApiError or a plain Error.
 */
export function isEmailRateLimitError(error: MaybeAuthError | Error): boolean {
  if (!error) return false;

  const candidate = error as MaybeAuthError;
  const code = candidate?.code ?? candidate?.error_code ?? null;
  if (code === EMAIL_RATE_LIMIT_CODE) return true;

  const message = (candidate?.message ?? '').toLowerCase();
  if (!message) return false;

  if (message.includes(EMAIL_RATE_LIMIT_CODE)) return true;

  return message.includes('email rate limit') || message.includes('email send rate');
}
