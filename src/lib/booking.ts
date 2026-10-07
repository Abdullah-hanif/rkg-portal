import type { Prisma } from "@prisma/client";
import { isDuration, MARKET } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { BookingError, isExclusionViolation } from "@/lib/errors";
import { quote } from "@/lib/pricing";
import { providersForWindow } from "@/lib/providers";

const bookingInclude = {
  customer: true,
  service: true,
  provider: true,
  payments: { orderBy: { createdAt: "asc" as const } },
  offers: { include: { provider: true }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.BookingInclude;

export type BookingRecord = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

export async function getBooking(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: bookingInclude,
  });
}

export async function createDraftBooking(input: {
  serviceId: string;
  durationMinutes: number;
  scheduledStart: Date;
  customer: { name: string; email: string; phone?: string };
}) {
  if (!isDuration(input.durationMinutes)) {
    throw new BookingError("Duration must be 60, 90, or 120 minutes.", "INVALID");
  }
  if (Number.isNaN(input.scheduledStart.getTime())) {
    throw new BookingError("Choose a valid appointment time.", "INVALID");
  }
  if (input.scheduledStart.getTime() < Date.now() + 60_000) {
    throw new BookingError("That time has already passed.", "INVALID");
  }

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, active: true },
  });
  if (!service) throw new BookingError("That service is not available.", "NOT_FOUND");

  const scheduledEnd = new Date(input.scheduledStart.getTime() + input.durationMinutes * 60_000);
  const eligible = await providersForWindow(input.scheduledStart, scheduledEnd);
  if (eligible.length === 0) {
    throw new BookingError("No Atlanta provider covers that window.", "INELIGIBLE");
  }

  const price = quote(service.hourlyRateCents, input.durationMinutes);
  const email = input.customer.email.trim().toLowerCase();
  const customer = await prisma.customer.upsert({
    where: { email },
    update: {
      name: input.customer.name.trim(),
      phone: input.customer.phone?.trim() || null,
    },
    create: {
      name: input.customer.name.trim(),
      email,
      phone: input.customer.phone?.trim() || null,
    },
  });

  return prisma.booking.create({
    data: {
      customerId: customer.id,
      serviceId: service.id,
      city: MARKET.city,
      status: "DRAFT",
      scheduledStart: input.scheduledStart,
      scheduledEnd,
      durationMinutes: input.durationMinutes,
      ...price,
    },
    include: bookingInclude,
  });
}

type LockedBooking = {
  id: string;
  status: string;
  provider_id: string | null;
  scheduled_start: Date;
  scheduled_end: Date;
};

export async function acceptBooking(bookingId: string, providerId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<LockedBooking[]>`
        SELECT id, status::text AS status, provider_id, scheduled_start, scheduled_end
        FROM bookings
        WHERE id = ${bookingId}
        FOR UPDATE
      `;
      const booking = locked[0];
      if (!booking) throw new BookingError("Booking not found.", "NOT_FOUND");
      if (booking.status !== "CONFIRMED_SEARCHING") {
        throw new BookingError(
          "Another provider already accepted this booking.",
          "LOST_RACE",
        );
      }

      const providerRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM providers WHERE id = ${providerId} AND active = true FOR UPDATE
      `;
      if (providerRows.length === 0) {
        throw new BookingError("Provider is not available.", "INELIGIBLE");
      }

      const offer = await tx.dispatchOffer.findUnique({
        where: { bookingId_providerId: { bookingId, providerId } },
      });
      if (!offer || offer.status !== "OFFERED") {
        throw new BookingError("This provider was not offered the booking.", "INELIGIBLE");
      }

      const overlap = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM bookings
        WHERE provider_id = ${providerId}
          AND id <> ${bookingId}
          AND status::text IN ('PROVIDER_ASSIGNED', 'SERVICE_STARTED')
          AND tstzrange(scheduled_start, scheduled_end, '[)')
              && tstzrange(${booking.scheduled_start}::timestamptz, ${booking.scheduled_end}::timestamptz, '[)')
      `;
      if (overlap.length > 0) {
        throw new BookingError(
          "That provider is already booked for an overlapping window.",
          "OVERLAP",
        );
      }

      try {
        await tx.booking.update({
          where: { id: bookingId },
          data: { providerId, status: "PROVIDER_ASSIGNED" },
        });
      } catch (error) {
        if (isExclusionViolation(error)) {
          throw new BookingError(
            "That provider is already booked for an overlapping window.",
            "OVERLAP",
          );
        }
        throw error;
      }

      await tx.dispatchOffer.update({
        where: { id: offer.id },
        data: { status: "ACCEPTED" },
      });
      await tx.dispatchOffer.updateMany({
        where: { bookingId, providerId: { not: providerId }, status: "OFFERED" },
        data: { status: "LOST" },
      });

      return tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: bookingInclude,
      });
    }, { timeout: 20_000 });
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new BookingError(
        "That provider is already booked for an overlapping window.",
        "OVERLAP",
      );
    }
    throw error;
  }
}

export async function raceAccept(bookingId: string) {
  const offers = await prisma.dispatchOffer.findMany({
    where: { bookingId, status: "OFFERED" },
    include: { provider: true },
    orderBy: { provider: { name: "asc" } },
    take: 2,
  });

  if (offers.length < 2) {
    throw new BookingError(
      "The race needs two open offers. Book a time both Atlanta providers can cover.",
      "INELIGIBLE",
    );
  }

  const startedAt = Date.now();
  const results = await Promise.all(
    offers.map(async (offer) => {
      try {
        const booking = await acceptBooking(bookingId, offer.providerId);
        return {
          ok: true as const,
          providerId: offer.providerId,
          providerName: offer.provider.name,
          bookingId: booking.id,
          status: booking.status,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Accept failed.";
        const code = error instanceof BookingError ? error.code : "INVALID";
        return {
          ok: false as const,
          providerId: offer.providerId,
          providerName: offer.provider.name,
          message,
          code,
        };
      }
    }),
  );

  const booking = await getBooking(bookingId);
  return {
    elapsedMs: Date.now() - startedAt,
    results,
    booking,
  };
}
