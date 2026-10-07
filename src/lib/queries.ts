import { prisma } from "@/lib/db";
import { webhookPayloadFor } from "@/lib/stripe";

export async function getCatalog() {
  const [services, providers] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { hourlyRateCents: "asc" },
    }),
    prisma.provider.findMany({
      where: { active: true, city: "Atlanta" },
      include: { availability: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { services, providers };
}

export async function getDispatchBoard() {
  const [providers, searching, assigned] = await Promise.all([
    prisma.provider.findMany({
      where: { city: "Atlanta", active: true },
      include: { availability: true },
      orderBy: { name: "asc" },
    }),
    prisma.booking.findMany({
      where: { status: "CONFIRMED_SEARCHING", city: "Atlanta" },
      include: {
        customer: true,
        service: true,
        provider: true,
        offers: { include: { provider: true } },
        payments: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { scheduledStart: "asc" },
    }),
    prisma.booking.findMany({
      where: { status: { in: ["PROVIDER_ASSIGNED", "SERVICE_STARTED"] }, city: "Atlanta" },
      include: {
        customer: true,
        service: true,
        provider: true,
        payments: { orderBy: { createdAt: "asc" } },
        offers: true,
      },
      orderBy: { scheduledStart: "asc" },
    }),
  ]);

  return {
    providers,
    searching: searching.map(withPayloads),
    assigned: assigned.map(withPayloads),
  };
}

function withPayloads<T extends { payments: { stripeEventId: string; stripePaymentIntentId: string; amountCents: number; type: "DEPOSIT" | "BALANCE"; bookingId: string }[] }>(
  booking: T,
) {
  return {
    ...booking,
    payments: booking.payments.map((payment) => ({
      ...payment,
      webhookPayload: webhookPayloadFor(payment),
    })),
  };
}
