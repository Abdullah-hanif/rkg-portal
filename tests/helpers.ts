import { prisma } from "@/lib/db";
import { addCalendarDays, zonedParts, zonedTimeToUtc } from "@/lib/availability";

export function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("/rkg_test")) {
    throw new Error("Refusing to run against a database other than rkg_test.");
  }
}

export async function resetDatabase() {
  assertTestDatabase();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      webhook_events,
      dispatch_offers,
      payments,
      bookings,
      customers,
      provider_availability,
      providers,
      services
    RESTART IDENTITY CASCADE
  `);
}

export function atHourTomorrow(hour: number, minute = 0) {
  const today = zonedParts(new Date());
  const day = addCalendarDays(today.year, today.month, today.day, 1);
  return zonedTimeToUtc(day.year, day.month, day.day, hour, minute);
}

function weekly(startMinute: number, endMinute: number) {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startMinute,
    endMinute,
  }));
}

export async function seedMarket() {
  const service = await prisma.service.create({
    data: {
      name: "Swedish Massage",
      description: "Test service",
      hourlyRateCents: 10_000,
      suggestedDurationMinutes: 60,
    },
  });

  const maya = await prisma.provider.create({
    data: {
      name: "Maya Chen",
      email: "maya@rkg.test",
      city: "Atlanta",
      active: true,
      bio: "Test provider",
      availability: { create: weekly(9 * 60, 17 * 60) },
    },
  });

  const jordan = await prisma.provider.create({
    data: {
      name: "Jordan Hale",
      email: "jordan@rkg.test",
      city: "Atlanta",
      active: true,
      bio: "Test provider",
      availability: { create: weekly(12 * 60, 20 * 60) },
    },
  });

  return { service, maya, jordan };
}
