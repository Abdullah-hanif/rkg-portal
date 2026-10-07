"use client";

import { useMemo, useState } from "react";
import { formatAppointment, formatUsd, formatWindow, statusLabel } from "@/lib/pricing";
import { heroImage, providerImage, serviceImage } from "@/lib/media";

type PaymentView = {
  id: string;
  type: "DEPOSIT" | "BALANCE";
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  amountCents: number;
  stripeEventId: string;
  webhookPayload: unknown;
};

type OfferView = {
  id: string;
  status: "OFFERED" | "ACCEPTED" | "LOST";
  providerId: string;
  provider: { id: string; name: string };
};

type BookingView = {
  id: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  customer: { name: string };
  service: { name: string };
  provider: { id: string; name: string } | null;
  offers: OfferView[];
  payments: PaymentView[];
};

type ProviderView = {
  id: string;
  name: string;
  bio: string;
  availability: { startMinute: number; endMinute: number }[];
};

export type BoardData = {
  providers: ProviderView[];
  searching: BookingView[];
  assigned: BookingView[];
};

type RaceResult = {
  ok: boolean;
  providerName: string;
  message?: string;
  status?: string;
};

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}

export function DispatchBoard({ initial }: { initial: BoardData }) {
  const [board, setBoard] = useState(initial);
  const [selectedId, setSelectedId] = useState(
    initial.searching.find((booking) => booking.offers.filter((offer) => offer.status === "OFFERED").length >= 2)?.id ??
      initial.searching[0]?.id ??
      "",
  );
  const [race, setRace] = useState<{ elapsedMs: number; results: RaceResult[] } | null>(null);
  const [webhookNote, setWebhookNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const events = useMemo(
    () =>
      [...board.searching, ...board.assigned].flatMap((booking) =>
        booking.payments.map((payment) => ({ booking, payment })),
      ),
    [board],
  );
  const [eventKey, setEventKey] = useState(events[0] ? `${events[0].payment.id}` : "");
  const selectedEvent = events.find((item) => item.payment.id === eventKey) ?? events[0];
  const selected = board.searching.find((booking) => booking.id === selectedId) ?? board.searching[0];

  async function refresh() {
    const next = await fetch("/api/dispatch", { cache: "no-store" }).then((response) => response.json());
    setBoard(next);
    return next as BoardData;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-wrap">
      <section className="dispatch-banner reveal">
        <img src={heroImage.src} alt={heroImage.alt} width={1280} height={720} />
        <div>
          <p className="eyebrow">Atlanta dispatch</p>
          <h1>First accept wins.</h1>
          <p className="lede">
            Both providers see a visit when their hours cover it. Accepting locks the booking row. The race button fires
            both accepts at once so you can see the loser get rejected.
          </p>
        </div>
      </section>

      {error ? <p className="alert" role="alert">{error}</p> : null}

      <div className="dispatch-layout">
        <div className="board">
          <section className="panel">
            <div className="panel-head">
              <h2>Open offers</h2>
              <button type="button" className="btn ghost" onClick={() => run(async () => undefined)} disabled={busy}>
                Refresh
              </button>
            </div>
            {board.searching.length === 0 ? (
              <p className="empty">No visits are searching. Book one from the customer page and pay the deposit.</p>
            ) : null}
            <div className="provider-columns">
              {board.providers.map((provider) => {
                const window = provider.availability[0];
                const offers = board.searching.filter((booking) =>
                  booking.offers.some((offer) => offer.providerId === provider.id && offer.status === "OFFERED"),
                );
                const photo = providerImage(provider.name);
                return (
                  <div key={provider.id}>
                    <div className="column-head">
                      {photo ? <img className="portrait" src={photo.src} alt={photo.alt} width={720} height={960} /> : null}
                      <div>
                        <h3>{provider.name}</h3>
                        <span>{window ? formatWindow(window.startMinute, window.endMinute) : provider.bio}</span>
                      </div>
                    </div>
                      {offers.length === 0 ? <p className="empty">Nothing offered.</p> : null}
                      {offers.map((booking) => (
                        <article key={booking.id} className="offer">
                          <div className="offer-top">
                            <span className="offer-service">
                              <img src={serviceImage(booking.service.name).src} alt="" width={960} height={720} />
                              <strong>{booking.customer.name}</strong>
                            </span>
                            <span className="chip searching">Offer</span>
                          </div>
                          <p className="meta" style={{ marginTop: 6 }}>
                            {booking.service.name}
                            <br />
                            {formatAppointment(new Date(booking.scheduledStart), new Date(booking.scheduledEnd))}
                          </p>
                          <div className="row-actions" style={{ marginTop: 10 }}>
                            <span className="meta">Deposit {formatUsd(booking.depositCents)}</span>
                            <button
                              type="button"
                              className="btn slim"
                              disabled={busy}
                              onClick={() =>
                                run(() => postJson(`/api/bookings/${booking.id}/accept`, { providerId: provider.id }))
                              }
                            >
                              Accept
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  );
                })}
              </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Assigned</h2>
            </div>
            {board.assigned.length === 0 ? <p className="empty">No provider has won a visit yet.</p> : null}
            {board.assigned.map((booking) => (
              <article key={booking.id} className="assigned">
                <div className="offer-top">
                  <strong>{booking.customer.name}</strong>
                  <span className={booking.status === "SERVICE_STARTED" ? "chip started" : "chip assigned"}>
                    {statusLabel(booking.status)}
                  </span>
                </div>
                <p className="meta" style={{ marginTop: 6 }}>
                  {booking.provider?.name ?? "Unassigned"} · {booking.service.name}
                  <br />
                  {formatAppointment(new Date(booking.scheduledStart), new Date(booking.scheduledEnd))}
                </p>
                <p className="meta" style={{ marginTop: 6 }}>
                  Paid {formatUsd(booking.payments.filter((payment) => payment.status === "SUCCEEDED").reduce((sum, payment) => sum + payment.amountCents, 0))} of {formatUsd(booking.totalCents)}
                </p>
                {booking.status === "PROVIDER_ASSIGNED" ? (
                  <button
                    type="button"
                    className="btn slim"
                    style={{ marginTop: 10 }}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const prepared = await postJson<{ webhookPayload: unknown }>(`/api/bookings/${booking.id}/balance`);
                        await postJson("/api/webhooks/stripe", prepared.webhookPayload);
                      })
                    }
                  >
                    Start session · bill {formatUsd(booking.balanceCents)}
                  </button>
                ) : null}
              </article>
            ))}
          </section>
        </div>

        <aside className="proof reveal">
          <p className="eyebrow">Concurrency proof</p>
          <h2>Two accepts, one winner.</h2>
          <p className="fine">
            The button sends both provider accepts in the same instant. Postgres takes `SELECT … FOR UPDATE` on the
            booking. The second transaction sees the status has already moved and is rejected. A range exclusion
            constraint also blocks one provider from owning two overlapping visits.
          </p>

          {board.searching.length > 0 ? (
            <label>
              Visit
              <select value={selected?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>
                {board.searching.map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {booking.customer.name} · {booking.service.name}
                  </option>
                ))}
              </select>
            </label>
          ) : race ? null : (
            <p className="fine">Book a shaded afternoon time, pay the deposit, then come back.</p>
          )}

          <button
            type="button"
            className="btn"
            disabled={busy || !selected || selected.offers.filter((offer) => offer.status === "OFFERED").length < 2}
            onClick={() =>
              run(async () => {
                if (!selected) return;
                const result = await postJson<{ elapsedMs: number; results: RaceResult[] }>(
                  `/api/bookings/${selected.id}/race`,
                );
                setRace(result);
              })
            }
          >
            {busy ? "Running…" : "Run concurrent accepts"}
          </button>

          {race ? (
            <div className="verdicts">
              <p className="fine">Finished together in {race.elapsedMs} ms.</p>
              {race.results
                .slice()
                .sort((a, b) => Number(b.ok) - Number(a.ok))
                .map((result) => (
                  <article key={result.providerName} className={result.ok ? "verdict win" : "verdict loss"}>
                    {providerImage(result.providerName) ? (
                      <img
                        className="verdict-photo"
                        src={providerImage(result.providerName)?.src}
                        alt=""
                        width={720}
                        height={960}
                      />
                    ) : null}
                    <div>
                    <span className="section-label">{result.ok ? "Won the lock" : "Lost the lock"}</span>
                    <strong>{result.providerName}</strong>
                    <p>{result.ok ? "This provider was assigned." : result.message}</p>
                    </div>
                  </article>
                ))}
            </div>
          ) : null}

          <div style={{ marginTop: 22 }}>
            <p className="eyebrow">Webhook lab</p>
            <h3>Redeliver a Stripe event</h3>
            <p className="fine">Same event id. The handler returns 200 and does not apply the charge twice.</p>
            {selectedEvent ? (
              <>
                <p className="mono event">{selectedEvent.payment.stripeEventId}</p>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const before = selectedEvent.booking.payments.filter((payment) => payment.status === "SUCCEEDED").length;
                      const result = await postJson<{
                        duplicate: boolean;
                        booking: BookingView | null;
                      }>("/api/webhooks/stripe", selectedEvent.payment.webhookPayload);
                      const after =
                        result.booking?.payments.filter((payment) => payment.status === "SUCCEEDED").length ?? before;
                      setWebhookNote(
                        result.duplicate
                          ? `Duplicate ignored. Succeeded payments stayed at ${after}. Status: ${result.booking?.status ?? "unchanged"}.`
                          : `Event applied. Succeeded payments ${before} → ${after}.`,
                      );
                    })
                  }
                >
                  Send this event again
                </button>
              </>
            ) : (
              <p className="fine">Pay a deposit first. The event id will show up here.</p>
            )}
            {events.length > 1 ? (
              <select value={eventKey} onChange={(event) => setEventKey(event.target.value)}>
                {events.map((item) => (
                  <option key={item.payment.id} value={item.payment.id}>
                    {item.payment.type} · {item.booking.customer.name} · {item.payment.status}
                  </option>
                ))}
              </select>
            ) : null}
            {webhookNote ? <p className="fine">{webhookNote}</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
