/**
 * Hard business rule: a partner may not act as both partner and client
 * on the same proposal. Admins are exempt.
 */

export const SELF_AS_CLIENT_MESSAGE =
  "You cannot list yourself as the client. A partner may not act as both partner and client on the same proposal. Enter your client's email address — a colleague at your company can be added instead.";

export const SELF_AS_CLIENT_SHORT_MESSAGE =
  'You cannot list your own email address as the client.';

const normalise = (value?: string | null): string =>
  (value ?? '').trim().toLowerCase();

/**
 * True when the supplied client email belongs to the signed-in user and
 * that user is not an admin.
 */
export function isSelfAsClient(
  clientEmail?: string | null,
  userEmail?: string | null,
  role?: string | null
): boolean {
  if (role === 'admin') return false;
  const client = normalise(clientEmail);
  const user = normalise(userEmail);
  if (!client || !user) return false;
  return client === user;
}
