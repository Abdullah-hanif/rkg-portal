import type { Prisma } from "@prisma/client";
import { MARKET } from "@/lib/constants";
import { coversWindow, type AvailabilityWindow } from "@/lib/availability";
import { prisma, type DbClient } from "@/lib/db";

export type ProviderWithAvailability = Prisma.ProviderGetPayload<{
  include: { availability: true };
}>;

export async function listActiveProviders(db: DbClient = prisma) {
  return db.provider.findMany({
    where: { active: true, city: MARKET.city },
    include: { availability: true },
    orderBy: { name: "asc" },
  });
}

export function isEligible(
  provider: { availability: AvailabilityWindow[] },
  start: Date,
  end: Date,
) {
  return coversWindow(provider.availability, start, end);
}

export async function providersForWindow(start: Date, end: Date, db: DbClient = prisma) {
  const providers = await listActiveProviders(db);
  const eligible = providers.filter((provider) => isEligible(provider, start, end));
  if (eligible.length === 0) return [];

  const busy = await db.booking.findMany({
    where: {
      providerId: { in: eligible.map((provider) => provider.id) },
      status: { in: ["PROVIDER_ASSIGNED", "SERVICE_STARTED"] },
      scheduledStart: { lt: end },
      scheduledEnd: { gt: start },
    },
    select: { providerId: true },
  });
  const busyIds = new Set(busy.map((row) => row.providerId));
  return eligible.filter((provider) => !busyIds.has(provider.id));
}
