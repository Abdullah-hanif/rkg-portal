# Critique of the proposed RKG schema

The draft specification describes a national platform: 24 tables, 16 booking states, Next.js, Postgres with PostGIS, Redis, Stripe, and Twilio. The product that has to work first is smaller. One city. A customer pays a deposit. One provider accepts. The session starts and the balance is billed.

Those four facts are the system. The draft spreads them across enough objects that the dangerous part — two people taking the same hour — is no longer obvious.

## Sixteen states hide the four that matter

The proposed machine runs from `draft` through `validating`, `rejected`, `payment_pending`, `payment_failed`, `confirmed_searching`, `provider_notified`, `no_provider_available`, `provider_assigned`, `provider_en_route`, `provider_arrived`, `provider_no_show`, `service_started`, `service_completed`, `customer_no_show`, and `customer_cancelled`.

Most of those names do not change what the database must protect. `provider_notified` and `confirmed_searching` are the same row with a different story about a text message. `provider_en_route` and `provider_arrived` are locations, not a new owner of the calendar. `payment_pending` is a payment row, not a booking lifecycle.

A new state earns its place when it has different stored data and different allowed commands. For Atlanta that is:

- `DRAFT` — price and time exist, no money has moved
- `CONFIRMED_SEARCHING` — the deposit succeeded, offers are open
- `PROVIDER_ASSIGNED` — one provider owns the range
- `SERVICE_STARTED` — the balance succeeded

Cancellation, no-shows, and "on the way" can be added when an operator can take a different action in each of them. Adding them on day one means every query, every test, and every webhook has to know about transitions that have no UI.

## Twenty-four tables split one invariant

The invariant is: a provider cannot be assigned to two visits whose times overlap, and a visit cannot have two assigned providers.

That is one predicate on `bookings`. An exclusion constraint expresses it in a form the database will enforce for every writer, including a script, a second API, or a bug. A row lock (`SELECT … FOR UPDATE`) makes the two accepts line up so the loser gets a clean error instead of a constraint violation.

The draft puts pieces of that story in `DispatchOffers`, `ProviderAvailability`, `ProviderTimeOff`, `ProviderEarnings`, `Payouts`, Redis, and a 16-state enum. Offers are useful. They answer "who was asked, and who lost." They are a terrible lock. If the offer row is updated and the booking row is not, the board lies. Earnings and payouts are a ledger. They should be written after the visit is assigned, from the payment rows, not consulted to decide who won.

Gift cards, memberships, corporate accounts, prepaid blocks, masked phone sessions, flags, and audit logs are real products. They are not on the path that makes a double-book impossible. Each one is another transaction that can forget to take the booking lock.

## Redis is a second calendar

A Redis lock around accept looks fast and fails in a way Postgres does not. The lock can expire while the request is still writing. The process can die and leave the key until the TTL, while the visit is still free. Two app instances can disagree about who holds it if a replica is stale. None of that is visible in `bookings`.

Postgres row locks end when the transaction ends, including when the connection drops. The exclusion constraint remains after the lock is gone. There is nothing to keep in sync. Redis is justified later as a cache of provider search results. It is not justified as the authority for who is busy at 2pm.

## PostGIS and Twilio are the wrong layer for this race

Atlanta eligibility, for this slice, is a weekly window on an active provider in one city. Both seeded providers work every day. They overlap from noon to 5. That is enough to prove two offers and one winner.

Drive time will matter, and PostGIS is a reasonable way to store it. It belongs in the query that creates offers, before anyone accepts. It does not belong in the accept transaction. By the time a provider taps accept, the question is no longer "are they close enough." The question is "does this row still say searching, and is their range free."

Twilio has the same shape. Send the text after the commit. A notification table inside the accept transaction just makes the lock longer and the failure modes wider. If the SMS provider times out, the visit must still have exactly one owner.

## What to build instead

Eight tables are enough for the behavior the assessment asks for:

- `services`, `customers`, `providers`, `provider_availability`
- `bookings`, `payments`, `dispatch_offers`, `webhook_events`

City is a column. There is one market. A `cities` table starts earning its keep when a second market has different hours, prices, or providers, and a booking must not cross that boundary.

`webhook_events` is the one extra table that looks like infrastructure and is actually a business rule: Stripe delivers at least once, and a second delivery must not take a second deposit. The primary key is the event id. The insert and the status change commit together, so a crash retries cleanly and a replay returns 200 without writing again.

I would add the next tables only when a concrete failure shows up:

1. Time off, as exceptions to the weekly window, when a provider cannot be treated as available every day.
2. Provider identity on the accept route, when the open dispatch board is no longer acceptable.
3. Stripe signature verification in front of the handler that already exists. The signature does not replace the event table.
4. An outbox for SMS, written in the same transaction as the accept and sent after commit.
5. A second city, with its own providers, when Atlanta's lock has already held under a real race.

The draft is a map of a company. The portal needed a lock, a deposit, and a way to ignore a repeated webhook. Those are easier to trust when they are the whole schema, not a corner of it.
