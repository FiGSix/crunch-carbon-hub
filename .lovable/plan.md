# Test user "Tester Shaun": recommended setup

## Advice on the current idea

Making a full admin on the live site and wiping its changes every night is risky. I don't recommend it as it stands:

- **Real client data is exposed.** An admin can see every client, every signed Cession Agreement, every ID number and every bank detail. Handing that login to outside testers is a POPIA problem.
- **Real emails go out.** An admin test can send proposal invitations, portfolio emails, recovery links and approval emails to real clients and partners. A nightly clean-up can't recall an email.
- **Admin actions change real records.** Tagging audits, moving projects, merging duplicates, editing or deleting proposals and regenerating agreements all touch real data. A nightly wipe can't tell a tester's edit to a real proposal apart from a real edit, so you can't undo it safely without risking real data.
- **Signatures spread.** One test signature against a real client's project spreads to all of that client's sibling projects.

## Recommended setup: a sandbox inside the live site

Tester Shaun gets full rights, but only inside a walled-off sandbox. Real data can't be seen or changed.

1. **Create the account** shaun@nuvoconsulting.com ("Tester Shaun") and mark it as a test account in a dedicated test-accounts list. The mark lives in the database, never in the browser.
2. **Role switcher:** the test account can switch between Client, Partner, Super Partner and Admin views to check each journey. Real users never see the switcher.
3. **Sandbox data:** everything Tester Shaun creates (proposals, clients, companies, onboarding projects, signatures, documents) is stamped as test data.
4. **Fenced admin:** as Admin, the test account sees only test data plus a seeded set of fake demo clients and projects. It never sees real clients. Access rules on the server enforce this, not just the screens.
5. **Email guard:** any email triggered by test data, or sent to a test address, is redirected to shaun@nuvoconsulting.com with a "[TEST]" subject. It never reaches a real person.
6. **Nightly reset at 23:00 SAST:** a scheduled job deletes all test-stamped records and files, then re-seeds the demo data. Only test-stamped rows are touched, so real data can't be hit.
7. **Exclusions:** test data is left out of homepage stats, revenue dashboards, exports, the weekly roundup and Agreement Recovery.

## Alternative: a separate test copy of the site

This is a full copy with its own empty database, used only for testing. It's the cleanest and safest option, but it's more work to keep in step with the live site and costs more to run. I'm happy to plan this instead if you prefer.

## What I need from you

- Is the sandbox approach right, or would you rather have a separate test copy?
- Is 23:00 SAST the right reset time?

## Technical details

- New table `test_accounts(user_id)` and helper `is_test_account(uid)`, a closed security-definer function per the AGENTS.md rule. Add an `is_test` boolean, defaulting to false, on proposals, clients, client_companies, project_onboarding and the related child tables. A trigger sets it automatically when the creator is a test account.
- Test-account role switching: grant `admin`, `agent` and `super_partner` in `user_roles` and add a client profile. The role switcher stores the active view in the session, and server checks still apply.
- RLS: add the restrictive policy `is_test = is_test_account(auth.uid())` on the affected tables, so test admins see only test rows and real users never see them.
- Shared email-send guard in `supabase/functions/_shared`, applied to every sending function.
- Cron job `reset-test-sandbox` deletes rows and storage objects where `is_test = true`, then re-seeds the fixtures. Every run is logged.
- Exclude `is_test` rows from stats views, exports, the roundup and recovery queries.
