# RKG Portal — Atlanta

**Live deployment:** not published from this workspace. Deploy with the steps below and put the URL here before you submit.

Customer booking, a 30% deposit, and an Atlanta dispatch board. One provider can win a visit. A second accept, and a redelivered Stripe webhook, both stop at the database.

## What you can walk through

1. On the booking page, pick a shaded afternoon time. Those slots are covered by both providers.
2. Hold the time, then pay the deposit. That posts a simulated `payment_intent.succeeded` webhook and moves the visit from `DRAFT` to `CONFIRMED_SEARCHING`.
3. Open Dispatch. Run concurrent accepts. One provider is assigned. The other is rejected.
4. In the webhook lab, send the same event again. The response is a duplicate, and the succeeded payment count stays at one.
5. Start the session to bill the remaining 70%.

## Stack

Next.js (App Router), PostgreSQL, Prisma. No Redis. The schedule lock is a row lock plus a Postgres exclusion constraint.

## Run it locally

Docker:

```bash
npm install
docker compose up -d --wait
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Without Docker, from this folder:

```bash
npm install
npm run db:embedded
```

Leave that process running, then in another terminal:

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

The app is at [http://localhost:3000](http://localhost:3000). Dispatch is at [http://localhost:3000/dispatch](http://localhost:3000/dispatch).

Copy `.env.example` to `.env` if you don't already have one. The local URL is:

```
DATABASE_URL=postgresql://rkg:rkg@localhost:5432/rkg?schema=public
```

Seeded market:

| Provider | Hours (America/New_York) |
| --- | --- |
| Maya Chen | Every day, 9:00–17:00 |
| Jordan Hale | Every day, 12:00–20:00 |

They overlap from noon to 5pm. A visit in that window is offered to both.

Price is `hourly rate × hours`. The deposit is 30% of that total, rounded to the cent. The balance is the rest.

## Tests

Postgres must be running. The suite uses the `rkg_test` database and will refuse any other URL.

```bash
npm test
```

- `tests/concurrency.test.ts` — two providers accept one visit at the same time, and one provider accepts two overlapping visits. A third test writes two overlapping assignments straight through Prisma and expects Postgres to reject the second (`bookings_no_provider_overlap`).
- `tests/webhook.test.ts` — the same `payment_intent.succeeded` event is processed twice. One charge, one status change, one webhook row.

## Deploy

1. Create a Neon (or Supabase) Postgres database and copy the connection string.
2. Push this repo to GitHub and import it in Vercel.
3. Set `DATABASE_URL` on the Vercel project.
4. Set the build command to:

```bash
npx prisma migrate deploy && npm run build
```

5. Put the public URL in the line at the top of this file.

Stripe is simulated. The webhook route does not check a Stripe signature. Production would verify `Stripe-Signature` before the handler runs. The idempotency table is still required after that check.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — locking and webhook idempotency
- [docs/CRITIQUE.md](docs/CRITIQUE.md) — why the 24-table draft is more system than this market needs
- [docs/AI_PROMPTS.md](docs/AI_PROMPTS.md) — how this slice was built with Cursor
