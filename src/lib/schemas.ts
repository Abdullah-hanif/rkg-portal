import { z } from "zod";
import { DURATIONS } from "@/lib/constants";

export const createBookingSchema = z.object({
  serviceId: z.string().min(1),
  durationMinutes: z.coerce.number().refine((value) => (DURATIONS as readonly number[]).includes(value), {
    message: "Duration must be 60, 90, or 120 minutes.",
  }),
  scheduledStart: z.string().min(1),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(120),
    phone: z.string().trim().max(30).optional(),
  }),
});

export const acceptSchema = z.object({
  providerId: z.string().min(1),
});

export const stripeEventSchema = z.object({
  id: z.string().min(3),
  type: z.literal("payment_intent.succeeded"),
  data: z.object({
    object: z.object({
      id: z.string().min(3),
      amount: z.number().int().nonnegative(),
      currency: z.literal("usd").optional(),
      metadata: z.object({
        bookingId: z.string().min(1),
        paymentType: z.enum(["DEPOSIT", "BALANCE"]),
      }),
    }),
  }),
});
