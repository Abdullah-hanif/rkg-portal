import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const services = [
  {
    name: "Swedish Massage",
    description: "A full-body visit at home. Steady pressure, unhurried pace.",
    hourlyRateCents: 14000,
    suggestedDurationMinutes: 60,
  },
  {
    name: "Deep Tissue",
    description: "Slower work on the muscles that driving and desk time lock up.",
    hourlyRateCents: 17000,
    suggestedDurationMinutes: 90,
  },
  {
    name: "Assisted Stretch",
    description: "Guided mobility on a mat. No massage table required.",
    hourlyRateCents: 12000,
    suggestedDurationMinutes: 60,
  },
  {
    name: "Recovery Session",
    description: "A longer appointment that pairs tissue work with stretching.",
    hourlyRateCents: 15500,
    suggestedDurationMinutes: 120,
  },
];

function weekly(startMinute: number, endMinute: number) {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startMinute,
    endMinute,
  }));
}

async function main() {
  await prisma.dispatchOffer.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.providerAvailability.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.service.deleteMany();

  await prisma.service.createMany({ data: services });

  const maya = await prisma.provider.create({
    data: {
      name: "Maya Chen",
      email: "maya.chen@rkg.example",
      city: "Atlanta",
      active: true,
      bio: "Swedish and stretch. Midtown, Virginia-Highland, and Buckhead.",
      availability: { create: weekly(9 * 60, 17 * 60) },
    },
  });

  const jordan = await prisma.provider.create({
    data: {
      name: "Jordan Hale",
      email: "jordan.hale@rkg.example",
      city: "Atlanta",
      active: true,
      bio: "Deep tissue and recovery. Decatur, Grant Park, and East Atlanta.",
      availability: { create: weekly(12 * 60, 20 * 60) },
    },
  });

  console.log(`Seeded services plus ${maya.name} and ${jordan.name}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
