import { expect, test } from "vitest";
import { createDraftBooking } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { prepareDeposit, processStripeEvent } from "@/lib/payments";
import { atHourTomorrow, seedMarket } from "./helpers";

test("a redelivered payment webhook is acknowledged once and does not charge again", async () => {
  const { service } = await seedMarket();
  const draft = await createDraftBooking({
    serviceId: service.id,
    durationMinutes: 90,
    scheduledStart: atHourTomorrow(13),
    customer: { name: "Avery Cole", email: "avery@example.com" },
  });

  expect(draft.totalCents).toBe(15_000);
  expect(draft.depositCents).toBe(4_500);
  expect(draft.balanceCents).toBe(10_500);
  expect(draft.status).toBe("DRAFT");

  const prepared = await prepareDeposit(draft.id);
  const first = await processStripeEvent(prepared.webhookPayload);
  const second = await processStripeEvent(prepared.webhookPayload);

  expect(first.duplicate).toBe(false);
  expect(first.booking?.status).toBe("CONFIRMED_SEARCHING");
  expect(second.duplicate).toBe(true);
  expect(second.booking?.status).toBe("CONFIRMED_SEARCHING");

  expect(await prisma.payment.count({ where: { status: "SUCCEEDED" } })).toBe(1);
  expect(await prisma.payment.count()).toBe(1);
  expect(await prisma.webhookEvent.count()).toBe(1);
  expect(await prisma.dispatchOffer.count()).toBe(2);

  const offers = await prisma.dispatchOffer.findMany();
  expect(offers.every((offer) => offer.status === "OFFERED")).toBe(true);
});
