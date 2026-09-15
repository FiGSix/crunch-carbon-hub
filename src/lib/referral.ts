/**
 * Shared helpers for the WhatsApp referral / "invite a friend" flow.
 * Kept in one place so every entry point (floating button, calculator
 * results CTA, /referral page, etc.) shares the same URL + copy.
 */

const SITE_URL = "https://crunchcarbon.com";

/**
 * Returns the URL a friend should land on.
 * When a signed-in client id is provided, appends ?ref=<id> so the
 * referral can be attributed. Otherwise returns the plain site URL.
 */
export function buildReferralUrl(refId?: string | null): string {
  if (refId) {
    return `${SITE_URL}/calculator?ref=${encodeURIComponent(refId)}`;
  }
  return SITE_URL;
}

/**
 * Wraps a message in a wa.me deep link. Works on mobile (opens the
 * WhatsApp app) and desktop (opens WhatsApp Web).
 */
export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Default invite copy, matching the tone already used on /referral.
 */
export function defaultInviteMessage(url: string): string {
  return `Howzit! I've been using a company called Crunch Carbon to turn my solar energy I use into carbon credits and then cash — it's free, easy, and actually pays you for going green. Thought you'd want in too! ${url}`;
}

/**
 * Copy for a client who has just signed their Cession Agreement — shared as a
 * message or a WhatsApp status.
 */
export function signedClientShareMessage(url: string): string {
  return `My solar system is now earning me carbon credits through Crunch Carbon — free to join, and it pays you for power you're already generating. Check what yours could earn: ${url}`;
}
