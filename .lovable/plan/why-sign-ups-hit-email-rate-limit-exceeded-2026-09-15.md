# Why sign-ups hit "email rate limit exceeded"

## What is happening

Supabase (the service that handles accounts and log-ins) puts a cap on how many
account emails can be sent per hour — sign-up confirmations, password resets,
invitations and magic links all draw from the **same hourly pool for the whole
project, not per person**. When that pool is empty, the next sign-up is refused
with "email rate limit exceeded" and no email goes out.

Confirmed in this morning's sign-in records:

- `bennetfarming@jabama.co.za` tried to sign up at 09:20:30 and again at
  09:21:16 — both refused with the same error.
- The pool was already empty when they started, so it was not their own
  retrying that caused it. Other account emails sent in that hour used it up.

Two things make this worse right now:

1. Every refused attempt still creates a half-finished account, so the person
   ends up with several unverified records and none of them can be confirmed.
2. The sign-up screen shows the raw error text. People read it as a fault with
   their own email address, change it, and try again — which burns nothing but
   their patience and creates more half-finished accounts.

## Where the real fix lives

The cap is a setting in the Supabase dashboard, not something in the app's code.
It has to be raised by hand there — I cannot change it from here.

## Plan

1. **Raise the cap (you, in the Supabase dashboard).** I will confirm the exact
   screen and the value to set, and check afterwards that account emails are
   being sent through our own Resend sender rather than the built-in one — the
   built-in sender has a much smaller allowance and is only meant for testing.

2. **Stop the confusing message.** When a sign-up is refused for this reason,
   show: "We've sent a lot of verification emails in the last hour. Please wait
   a few minutes and try again — your details are saved." No raw error text.

3. **Stop the pile-up of half-finished accounts.** Hold the sign-up button for a
   short cool-down after a refusal instead of letting people submit repeatedly,
   and keep them on the same form rather than sending them round again.

4. **Make it visible when it happens again.** Record these refusals so we can
   see if we are regularly bumping the ceiling, rather than finding out only
   when someone phones in.

5. **Clean up the people already stuck.** Find the accounts left unverified by
   today's refusals and re-send their verification email once the cap is raised,
   starting with `bennetfarming@jabama.co.za`.

## Technical notes

- Error signature: HTTP 429, `error_code: over_email_send_rate_limit`, on
  `POST /signup`. Project-level limit under Auth → Rate Limits.
- Custom auth emails already run through the `send-auth-email` hook on Resend;
  verify the hook is enabled and that Auth is using custom SMTP, otherwise the
  low built-in allowance applies regardless of the hook.
- Client changes: map `over_email_send_rate_limit` to a friendly message in
  `src/lib/supabase/auth/signUp.ts` / `src/hooks/useRegisterForm.ts`, add a
  submit cool-down, and log the occurrence via the existing auth logger.
