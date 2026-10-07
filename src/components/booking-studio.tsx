"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildSlots } from "@/lib/availability";
import { DURATIONS } from "@/lib/constants";
import { heroImage, providerImage, serviceImage } from "@/lib/media";
import { formatAppointment, formatHours, formatUsd, formatWindow, quote, statusLabel } from "@/lib/pricing";

type ServiceOption = {
  id: string;
  name: string;
  description: string;
  hourlyRateCents: number;
  suggestedDurationMinutes: number;
};

type ProviderOption = {
  id: string;
  name: string;
  bio: string;
  availability: { dayOfWeek: number; startMinute: number; endMinute: number }[];
};

type Offer = { status: string; provider: { name: string } };
type PaymentRow = { status: string; type: string; amountCents: number };
type BookingResponse = {
  id: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  service: { name: string };
  offers: Offer[];
  payments: PaymentRow[];
};

type WebhookResult = {
  duplicate: boolean;
  booking: BookingResponse | null;
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

export function BookingStudio({
  services,
  providers,
}: {
  services: ServiceOption[];
  providers: ProviderOption[];
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const service = services.find((item) => item.id === serviceId) ?? services[0];
  const [duration, setDuration] = useState(service?.suggestedDurationMinutes ?? 60);
  const [dateKey, setDateKey] = useState("");
  const [slotStart, setSlotStart] = useState("");
  const [name, setName] = useState("Avery Cole");
  const [email, setEmail] = useState("avery@example.com");
  const [phone, setPhone] = useState("404-555-0148");
  const [step, setStep] = useState<"compose" | "pay" | "confirmed">("compose");
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [payload, setPayload] = useState<unknown>(null);
  const [receipt, setReceipt] = useState<WebhookResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [days, setDays] = useState<ReturnType<typeof buildSlots>>([]);

  useEffect(() => {
    setDays(
      buildSlots(
        providers.map((provider) => ({
          id: provider.id,
          name: provider.name,
          availability: provider.availability,
        })),
        duration,
      ),
    );
  }, [providers, duration]);

  useEffect(() => {
    const available = days.filter((day) => day.slots.length > 0);
    if (!available.some((day) => day.dateKey === dateKey)) {
      setDateKey(available[0]?.dateKey ?? "");
    }
  }, [days, dateKey]);

  const day = days.find((item) => item.dateKey === dateKey) ?? days.find((item) => item.slots.length > 0);

  useEffect(() => {
    const slots = day?.slots ?? [];
    if (!slots.some((slot) => slot.start === slotStart)) {
      const preferred = slots.find((slot) => slot.providerIds.length > 1) ?? slots[0];
      setSlotStart(preferred?.start ?? "");
    }
  }, [day, slotStart]);

  if (!service) return null;

  const price = quote(service.hourlyRateCents, duration);
  const slot =
    day?.slots.find((item) => item.start === slotStart) ??
    day?.slots.find((item) => item.providerIds.length > 1) ??
    day?.slots[0];

  function chooseService(nextId: string) {
    setServiceId(nextId);
    const next = services.find((item) => item.id === nextId);
    if (next) setDuration(next.suggestedDurationMinutes);
  }

  async function holdTime(event: React.FormEvent) {
    event.preventDefault();
    if (!slot) {
      setError("Choose a time an Atlanta provider can cover.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await postJson<{ booking: BookingResponse }>("/api/bookings", {
        serviceId: service.id,
        durationMinutes: duration,
        scheduledStart: slot.start,
        customer: { name, email, phone },
      });
      setBooking(created.booking);
      setStep("pay");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the booking.");
    } finally {
      setBusy(false);
    }
  }

  async function payDeposit() {
    if (!booking) return;
    setBusy(true);
    setError("");
    try {
      const prepared = await postJson<{ webhookPayload: unknown }>(`/api/bookings/${booking.id}/deposit`);
      setPayload(prepared.webhookPayload);
      const hooked = await postJson<WebhookResult>("/api/webhooks/stripe", prepared.webhookPayload);
      setReceipt(hooked);
      if (hooked.booking) setBooking(hooked.booking);
      setStep("confirmed");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The deposit could not be captured.");
    } finally {
      setBusy(false);
    }
  }

  async function redeliver() {
    if (!payload) return;
    setBusy(true);
    setError("");
    try {
      const hooked = await postJson<WebhookResult>("/api/webhooks/stripe", payload);
      setReceipt(hooked);
      if (hooked.booking) setBooking(hooked.booking);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Redelivery failed.");
    } finally {
      setBusy(false);
    }
  }

  const succeeded = (receipt?.booking ?? booking)?.payments.filter((payment) => payment.status === "SUCCEEDED") ?? [];

  const portrait = (name: string) => providerImage(name);

  return (
    <div className="page-wrap">
      <section className="hero reveal">
        <div className="hero-frame">
          <img src={heroImage.src} alt={heroImage.alt} width={1280} height={720} />
        </div>
        <div className="hero-copy">
          <p className="eyebrow">In-home wellness</p>
          <h1>A practitioner at your door in Atlanta.</h1>
          <p className="lede">
            Pick a service and a length. The price is the hourly rate times the hours. A 30% deposit moves the visit
            from draft into the provider search. The rest is billed when the session starts.
          </p>
          <ul className="provider-legend">
            {providers.map((provider) => {
              const window = provider.availability[0];
              const photo = portrait(provider.name);
              return (
                <li key={provider.id}>
                  {photo ? <img src={photo.src} alt={photo.alt} width={720} height={960} /> : null}
                  <span>
                    <strong>{provider.name}</strong>
                    <span>{window ? `Every day · ${formatWindow(window.startMinute, window.endMinute)}` : provider.bio}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {error ? <p className="alert" role="alert">{error}</p> : null}

      {step === "compose" ? (
        <form className="booking-layout" onSubmit={holdTime}>
          <div className="stack">
            <section className="panel reveal">
              <div className="panel-head">
                <h2>Service</h2>
              </div>
              <div className="choice-grid">
                {services.map((item) => {
                  const photo = serviceImage(item.name);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="choice"
                      aria-pressed={item.id === service.id}
                      onClick={() => chooseService(item.id)}
                    >
                      <span className="choice-photo">
                        <img src={photo.src} alt={photo.alt} width={960} height={720} />
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.description}</small>
                      </span>
                      <span className="choice-price">{formatUsd(item.hourlyRateCents)}/hr</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="panel reveal">
              <div className="panel-head">
                <h2>Length</h2>
                <p>{formatUsd(service.hourlyRateCents)}/hr × {formatHours(duration)}</p>
              </div>
              <div className="duration-row">
                {DURATIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className="duration"
                    aria-pressed={duration === minutes}
                    onClick={() => setDuration(minutes)}
                  >
                    {formatHours(minutes)}
                  </button>
                ))}
              </div>
            </section>

            <section className="panel reveal">
              <div className="panel-head">
                <h2>Time</h2>
                <p>Times both providers can cover are shaded. Use one of those for the accept race.</p>
              </div>
              <div className="day-strip">
                {days.map((item) => (
                  <button
                    key={item.dateKey}
                    type="button"
                    className="day"
                    aria-pressed={item.dateKey === day?.dateKey}
                    disabled={item.slots.length === 0}
                    onClick={() => setDateKey(item.dateKey)}
                  >
                    {item.label}
                    <small>{item.slots.length === 0 ? "Full" : `${item.slots.length} times`}</small>
                  </button>
                ))}
              </div>
              <div className="slot-grid" style={{ marginTop: 12 }}>
                {day?.slots.map((item) => (
                  <button
                    key={item.start}
                    type="button"
                    className={item.providerIds.length > 1 ? "slot shared" : "slot"}
                    aria-pressed={item.start === slot?.start}
                    onClick={() => setSlotStart(item.start)}
                  >
                    {item.label}
                    <small>{item.providerNames.join(" & ")}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel reveal">
              <div className="panel-head">
                <h2>Your details</h2>
                <p>Filled in for the walkthrough.</p>
              </div>
              <div className="fields">
                <label>
                  Name
                  <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
                </label>
                <label>
                  Email
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
                <label>
                  Phone
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} />
                </label>
              </div>
            </section>
          </div>
          <Ticket
            serviceName={service.name}
            duration={duration}
            slotLabel={slot ? `${day?.label ?? ""} · ${slot.label}` : "Choose a time"}
            price={price}
            busy={busy}
            action="Hold this time"
          />
        </form>
      ) : null}

      {step === "pay" && booking ? (
        <div className="booking-layout reveal">
          <section className="panel">
            <img className="panel-photo" src={serviceImage(booking.service.name).src} alt={serviceImage(booking.service.name).alt} width={960} height={720} />
            <p className="eyebrow">Draft</p>
            <h2>The visit is held. The deposit starts the search.</h2>
            <p className="lede">
              {booking.service.name} · {formatAppointment(new Date(booking.scheduledStart), new Date(booking.scheduledEnd))}
            </p>
            <p className="hint" style={{ marginTop: 14 }}>
              Paying posts a simulated <span className="mono">payment_intent.succeeded</span> webhook. That is the only
              path from draft to searching.
            </p>
            <button type="button" className="btn ghost" style={{ marginTop: 18 }} onClick={() => setStep("compose")}>
              Change the visit
            </button>
          </section>
          <Ticket
            serviceName={booking.service.name}
            duration={booking.durationMinutes}
            slotLabel={formatAppointment(new Date(booking.scheduledStart), new Date(booking.scheduledEnd))}
            price={{
              totalCents: booking.totalCents,
              depositCents: booking.depositCents,
              balanceCents: booking.balanceCents,
            }}
            busy={busy}
            action={`Pay ${formatUsd(booking.depositCents)} deposit`}
            onAction={payDeposit}
          />
        </div>
      ) : null}

      {step === "confirmed" && booking ? (
        <div className="confirm-grid reveal">
          <section className="panel">
            <img className="panel-photo" src={serviceImage(booking.service.name).src} alt={serviceImage(booking.service.name).alt} width={960} height={720} />
            <p className="eyebrow">{statusLabel(booking.status)}</p>
            <h2>Deposit captured. Providers can accept.</h2>
            <p className="lede">
              {booking.service.name} · {formatAppointment(new Date(booking.scheduledStart), new Date(booking.scheduledEnd))}
            </p>
            <div className="chips">
              {booking.offers.length === 0 ? (
                <span className="chip">No provider free</span>
              ) : (
                booking.offers.map((offer) => (
                  <span key={offer.provider.name} className="chip searching">
                    Offered to {offer.provider.name}
                  </span>
                ))
              )}
            </div>
            <p className="hint" style={{ marginTop: 16 }}>
              Open dispatch and run the concurrent accept. Exactly one provider can win.
            </p>
            <Link href="/dispatch" className="btn slim" style={{ display: "inline-block", marginTop: 16, textDecoration: "none" }}>
              Go to dispatch
            </Link>
          </section>
          <section className="panel receipt">
            <h2>Webhook receipt</h2>
            <div><span>Event</span><span className="mono">{receipt?.duplicate ? "duplicate" : "processed"}</span></div>
            <div><span>Status</span><span>{statusLabel(booking.status)}</span></div>
            <div><span>Succeeded payments</span><span>{succeeded.length}</span></div>
            <div><span>Deposit</span><span>{formatUsd(booking.depositCents)}</span></div>
            <button type="button" className="btn ink" onClick={redeliver} disabled={busy || !payload}>
              Redeliver the same webhook
            </button>
            <p className="hint">
              A second delivery returns 200 and does not capture the deposit again. Succeeded payments should stay at one.
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Ticket({
  serviceName,
  duration,
  slotLabel,
  price,
  busy,
  action,
  onAction,
}: {
  serviceName: string;
  duration: number;
  slotLabel: string;
  price: { totalCents: number; depositCents: number; balanceCents: number };
  busy: boolean;
  action: string;
  onAction?: () => void;
}) {
  return (
    <aside className="ticket reveal">
      <img
        key={serviceName}
        className="ticket-photo"
        src={serviceImage(serviceName).src}
        alt=""
        width={960}
        height={720}
      />
      <p className="eyebrow">Due now · 30%</p>
      <p className="amount">{formatUsd(price.depositCents)}</p>
      <p>{serviceName}</p>
      <p className="fine">{formatHours(duration)} · {slotLabel}</p>
      <div className="ticket-row"><span>Visit total</span><span>{formatUsd(price.totalCents)}</span></div>
      <div className="ticket-row"><span>Deposit</span><span>{formatUsd(price.depositCents)}</span></div>
      <div className="ticket-row"><span>Balance at start</span><span>{formatUsd(price.balanceCents)}</span></div>
      {onAction ? (
        <button type="button" className="btn" onClick={onAction} disabled={busy}>
          {busy ? "Sending…" : action}
        </button>
      ) : (
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Saving…" : action}
        </button>
      )}
      <p className="fine">The remaining 70% is a second payment, billed when the provider starts the session.</p>
    </aside>
  );
}
