# AI workflow log

Tool: Cursor, with the agent on Grok 4.7. No other model was used. The repository was empty except for the assessment PDF.

## Prompt 1 — the brief

> @FSE _ Tech Assessment _ 10.6.26.pdf read it out and start creating it

The PDF was read in full before any code was written. The useful constraints, pulled out of the longer platform description, were:

- Next.js and PostgreSQL, Atlanta only
- Price from duration, 30% deposit moves `DRAFT` to `CONFIRMED_SEARCHING`, 70% billed at session start
- Two providers can be offered the same visit; exactly one accept wins
- The guarantee has to be in Postgres (`SELECT … FOR UPDATE` and/or an exclusion constraint), not only in application code
- A webhook handler that returns 200 on a repeated Stripe event id and does not apply the charge twice
- Tests for the race and for the replay
- `CRITIQUE.md`, `ARCHITECTURE.md`, `AI_PROMPTS.md`, `README.md`

The 24-table SDS was treated as the thing to argue with in the critique, not as the schema to implement.

## Decisions made while building

These were chosen in the agent session, not handed in as a second prompt.

- Four booking states, eight tables. Offers are a record of who was asked. The booking row is the lock. See `docs/CRITIQUE.md`.
- Price is integer cents: `round(hourlyRate × minutes / 60)`, deposit `round(total × 0.30)`, balance `total − deposit`, plus a check constraint that the two parts equal the total.
- The deposit route only inserts a pending payment and a stable event id. The booking status changes inside `processStripeEvent`, so the UI, the tests, and a replay all share one path.
- Accept locks the booking, then the provider, in that order. A gist exclusion constraint on `(provider_id, tstzrange(start, end))` is the backstop if the overlap check is skipped.
- The race button calls the same `acceptBooking` function twice with `Promise.all`. It does not have its own locking code.
- Tests hit the database. `rkg_test` is required in `DATABASE_URL` so a test run cannot truncate the seeded app database.
- Docker Compose is the documented database. This machine's Docker daemon was not running, so `npm run db:embedded` starts the same Postgres  credentials with `embedded-postgres` for local verification.

## What was not delegated blindly

The agent wrote the SQL, the handlers, and the tests, then they were executed. The exclusion constraint and the webhook replay are asserted by `npm test`, not by reading the code and assuming it holds. The booking and dispatch screens were checked in a browser after the seed loaded: hold a time, pay the deposit, redeliver the webhook, run the concurrent accept, and bill the balance.

## Follow-up prompts worth using in the interview

If this work continues, the next prompts should stay narrow:

1. "Verify Stripe-Signature on `POST /api/webhooks/stripe` using `STRIPE_WEBHOOK_SECRET`, and keep the existing event-id dedupe. Add a test with a bad signature."
2. "Require the signed-in provider id on accept. Do not change the `FOR UPDATE` order."
3. "Add provider time off as windows that subtract from the weekly schedule, and extend the overlap test."

A prompt that says "implement the full 16-state SDS" would undo the critique. The useful ask is one new transition, with a test that names the invariant it must not break.
