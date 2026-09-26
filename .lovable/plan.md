# Security finding: inverter portal defaults readable by any signed-in user

## Finding
The inverter portal defaults list (inverter brand, its public monitoring website, and an optional admin note) can be read by any signed-in user.

## Assessment
This is intentional and safe:
- The list only holds public information: brand names such as Sungrow or Huawei, and the address of each brand's public monitoring website.
- It holds no personal, client, project or financial details.
- Clients and partners need to read it while filling in onboarding, so the portal link fills in automatically when the meter type is SSEG.
- Only admins can add, change or delete entries. That part stays as it is.

## Action
- Make no change to access, because restricting reads would break the automatic fill-in during onboarding.
- Dismiss the finding in the Security tab with the explanation above.
- Guardrail: admins should keep the "Notes" field free of anything sensitive, because every signed-in user can see it. We can add a short hint under the Notes field that says so.

## Technical details
- The SELECT policy `USING (true)` for `authenticated` is deliberate reference-data access. Write policies stay gated by `has_role(auth.uid(),'admin')`.
- Use `security--manage_security_finding` with operation `ignore` for `lov_db_rls_tautology_permissive_v1_361493821f101708` (scanner `lov_pgscan`, info level).
- Optional: update the Notes input placeholder in `InverterPortalDefaultsManager.tsx` to "Visible to all users — no sensitive info".
