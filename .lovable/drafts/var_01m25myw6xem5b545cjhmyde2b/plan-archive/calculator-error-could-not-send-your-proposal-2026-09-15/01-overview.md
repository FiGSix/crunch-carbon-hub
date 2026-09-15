# Calculator error: "Could not send your proposal"

## What is actually happening

The failure is confirmed in the server logs for every attempt, including Shaun's:

```text
invalid input syntax for type numeric: "100 kWp"
```

The calculator saves the system size into the proposal record as the text
`"100 kWp"`. A safety rule in the database — the duplicate-project guard that
was added to stop two installers submitting the same site — reads that same
field and expects a plain number. It cannot read `"100 kWp"`, so the save is
rejected and the page shows "Could not send your proposal".

This affects every calculator submission, not just Shaun. Retrying can never
succeed because the same text is sent each time. Nothing is wrong with his
email address or with the email service.
