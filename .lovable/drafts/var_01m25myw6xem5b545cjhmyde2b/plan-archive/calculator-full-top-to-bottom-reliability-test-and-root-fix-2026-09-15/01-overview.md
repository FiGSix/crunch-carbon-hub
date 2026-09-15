# Calculator: full top-to-bottom reliability test and root fix

## Confirmed diagnosis

This is not specific to Shaun or his email address.

- Shaun's latest attempts at **06:51–06:54 UTC** reached the calculator service, but every proposal save returned HTTP 500.
- The database error is still `invalid input syntax for type numeric: "100 kWp"`.
- No proposal was created from these attempts.
- The current source now sends the new size as a number, but the live duplicate-project check scans earlier proposals and directly converts their stored sizes to numbers.
- **116 existing proposals** still contain display-formatted sizes such as `8.1 kWp` or `100 kWp`. Any one of those rows can crash the scan before the new proposal is saved.
- The already-staged safeguard only makes the incoming proposal tolerant. It does not yet make the legacy-row scan safe, so accepting that change alone would leave the underlying failure possible.

## Outcome

Rebuild the duplicate comparison around one safe size parser, harden calculator lead creation, then test the complete public journey using **shaun@radiant.africa** as requested: inputs, estimate, proposal creation, unlocked forecast, email arrival, proposal link, and signing-page handoff.
