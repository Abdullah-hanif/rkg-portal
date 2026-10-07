import { expect, test } from "vitest";
import { acceptBooking } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { BookingError } from "@/lib/errors";
import { prepareDeposit, processStripeEvent } from "@/lib/payments";
import { atHourTomorrow, seedMarket } from "./helpers";
import { createDraftBooking } from "@/lib/booking";

test("concurrent accepts for one visit produce a single winner", async () => {
  const { service, maya, jordan } = await seedMarket();
  const draft = await createDraftBooking({
    serviceId: service.id,
    durationMinutes: 60,
    scheduledStart: atHourTomorrow(13),
    customer: { name: "Avery Cole", email: "avery@example.com" },
  });
  const prepared = await prepareDeposit(draft.id);
  await processStripeEvent(prepared.webhookPayload);

  const results = await Promise.allSettled([
    acceptBooking(draft.id, maya.id),
    acceptBooking(draft.id, jordan.id),
  ]);

  const won = results.filter((result) => result.status === "fulfilled");
  const lost = results.filter((result) => result.status === "rejected");
  expect(won).toHaveLength(1);
  expect(lost).toHaveLength(1);
  expect((lost[0] as PromiseRejectedResult).reason).toBeInstanceOf(BookingError);

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: draft.id },
    include: { offers: true },
  });
  expect(booking.status).toBe("PROVIDER_ASSIGNED");
  expect([maya.id, jordan.id]).toContain(booking.providerId);
  expect(booking.offers.filter((offer) => offer.status === "ACCEPTED")).toHaveLength(1);
  expect(booking.offers.filter((offer) => offer.status === "LOST")).toHaveLength(1);
});

test("the same provider cannot own two overlapping visits", async () => {
  const { service, maya } = await seedMarket();
  const start = atHourTomorrow(13);
  const makeDraft = (email: string) =>
    createDraftBooking({
      serviceId: service.id,
      durationMinutes: 60,
      scheduledStart: start,
      customer: { name: email, email },
    });

  const first = await makeDraft("one@example.com");
  const second = await makeDraft("two@example.com");
  for (const booking of [first, second]) {
    const prepared = await prepareDeposit(booking.id);
    await processStripeEvent(prepared.webhookPayload);
  }

  const results = await Promise.allSettled([
    acceptBooking(first.id, maya.id),
    acceptBooking(second.id, maya.id),
  ]);

  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

  const assigned = await prisma.booking.count({
    where: { providerId: maya.id, status: "PROVIDER_ASSIGNED" },
  });
  expect(assigned).toBe(1);
});

test("postgres rejects a second overlapping assignment even if the app check is skipped", async () => {
  const { service, maya } = await seedMarket();
  const customer = await prisma.customer.create({
    data: { name: "Avery Cole", email: "avery@example.com" },
  });
  const start = atHourTomorrow(15);
  const end = new Date(start.getTime() + 60 * 60_000);
  const data = {
    customerId: customer.id,
    serviceId: service.id,
    providerId: maya.id,
    city: "Atlanta",
    status: "PROVIDER_ASSIGNED" as const,
    scheduledStart: start,
    scheduledEnd: end,
    durationMinutes: 60,
    totalCents: 10_000,
    depositCents: 3_000,
    balanceCents: 7_000,
  };

  await prisma.booking.create({ data });
  await expect(prisma.booking.create({ data })).rejects.toThrow(/23P01|bookings_no_provider_overlap/);
  expect(await prisma.booking.count()).toBe(1);
});
