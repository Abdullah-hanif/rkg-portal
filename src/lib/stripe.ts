import { randomBytes } from "node:crypto";
import type { Payment, PaymentType } from "@prisma/client";

export function newId(prefix: "pi" | "evt") {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export type StripeWebhookEvent = {
  id: string;
  type: "payment_intent.succeeded";
  data: {
    object: {
      id: string;
      amount: number;
      currency?: "usd";
      metadata: {
        bookingId: string;
        paymentType: PaymentType;
      };
    };
  };
};

export function webhookPayloadFor(payment: Pick<Payment, "stripeEventId" | "stripePaymentIntentId" | "amountCents" | "type" | "bookingId">): StripeWebhookEvent {
  return {
    id: payment.stripeEventId,
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: payment.stripePaymentIntentId,
        amount: payment.amountCents,
        currency: "usd",
        metadata: {
          bookingId: payment.bookingId,
          paymentType: payment.type,
        },
      },
    },
  };
}
