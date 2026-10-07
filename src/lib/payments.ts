import type { Payment, PaymentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { BookingError } from "@/lib/errors";
import { providersForWindow } from "@/lib/providers";
import { newId, webhookPayloadFor, type StripeWebhookEvent } from "@/lib/stripe";

const bookingGraph = {
  customer: true,
  service: true,
  provider: true,
  payments: { orderBy: { createdAt: "asc" as const } },
  offers: { include: { provider: true } },
};

async function ensurePayment(
  bookingId: string,
  type: PaymentType,
  amountCents: number,
  requiredStatus: "DRAFT" | "PROVIDER_ASSIGNED",
  blockedMessage: string,
) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status::text AS status
      FROM bookings
      WHERE id = ${bookingId}
      FOR UPDATE
    `;
    const booking = rows[0];
    if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND");
    if (booking.status !== requiredStatus) {
      throw new BookingError(blockedMessage, requiredStatus === "DRAFT" ? "ALREADY_PAID" : "INVALID");
    }

    const existing = await tx.payment.findFirst({
      where: { bookingId, type, status: { in: ["PENDING", "SUCCEEDED"] } },
      orderBy: { createdAt: "desc" },
    });
    const payment =
      existing ??
      (await tx.payment.create({
        data: {
          bookingId,
          type,
          amountCents,
          status: "PENDING",
          stripePaymentIntentId: newId("pi"),
          stripeEventId: newId("evt"),
        },
      }));

    return { payment, webhookPayload: webhookPayloadFor(payment) };
  }, { timeout: 20_000 });
}

export async function prepareDeposit(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND");
  return ensurePayment(
    bookingId,
    "DEPOSIT",
    booking.depositCents,
    "DRAFT",
    "The deposit was already captured for this booking.",
  );
}

export async function prepareBalance(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND");
  return ensurePayment(
    bookingId,
    "BALANCE",
    booking.balanceCents,
    "PROVIDER_ASSIGNED",
    "The balance is billed only after a provider is assigned.",
  );
}

type LockedPayment = {
  id: string;
  booking_id: string;
  type: string;
  status: string;
  amount_cents: number;
};

export async function processStripeEvent(event: StripeWebhookEvent) {
  const paymentIntentId = event.data.object.id;

  return prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO webhook_events (id, type, booking_id, payload, processed_at)
      VALUES (
        ${event.id},
        ${event.type},
        ${event.data.object.metadata.bookingId},
        CAST(${JSON.stringify(event)} AS jsonb),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;

    if (inserted.length === 0) {
      const payment = await tx.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
        include: { booking: { include: bookingGraph } },
      });
      return {
        duplicate: true,
        payment,
        booking: payment?.booking ?? null,
      };
    }

    const paymentRows = await tx.$queryRaw<LockedPayment[]>`
      SELECT id, booking_id, type::text AS type, status::text AS status, amount_cents
      FROM payments
      WHERE stripe_payment_intent_id = ${paymentIntentId}
      FOR UPDATE
    `;
    const payment = paymentRows[0];
    if (!payment) {
      throw new BookingError("No payment matches that PaymentIntent.", "NOT_FOUND");
    }

    await tx.$queryRaw`
      SELECT id FROM bookings WHERE id = ${payment.booking_id} FOR UPDATE
    `;

    if (payment.amount_cents !== event.data.object.amount) {
      throw new BookingError("Webhook amount does not match the payment.", "INVALID");
    }

    if (payment.status !== "SUCCEEDED") {
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "SUCCEEDED" },
      });

      if (updated.count === 1 && payment.type === "DEPOSIT") {
        const moved = await tx.booking.updateMany({
          where: { id: payment.booking_id, status: "DRAFT" },
          data: { status: "CONFIRMED_SEARCHING" },
        });
        if (moved.count === 1) {
          const current = await tx.booking.findUniqueOrThrow({
            where: { id: payment.booking_id },
          });
          const eligible = await providersForWindow(current.scheduledStart, current.scheduledEnd, tx);
          if (eligible.length > 0) {
            await tx.dispatchOffer.createMany({
              data: eligible.map((provider) => ({
                bookingId: current.id,
                providerId: provider.id,
                status: "OFFERED" as const,
              })),
              skipDuplicates: true,
            });
          }
        }
      }

      if (updated.count === 1 && payment.type === "BALANCE") {
        await tx.booking.updateMany({
          where: { id: payment.booking_id, status: "PROVIDER_ASSIGNED" },
          data: { status: "SERVICE_STARTED" },
        });
      }
    }

    await tx.webhookEvent.update({
      where: { id: event.id },
      data: { bookingId: payment.booking_id },
    });

    const booking = await tx.booking.findUnique({
      where: { id: payment.booking_id },
      include: bookingGraph,
    });
    const freshPayment = await tx.payment.findUnique({ where: { id: payment.id } });

    return {
      duplicate: false,
      payment: freshPayment,
      booking,
    };
  }, { timeout: 20_000 });
}

export function serializePayment(payment: Payment) {
  return {
    ...payment,
    webhookPayload: webhookPayloadFor(payment),
  };
}
