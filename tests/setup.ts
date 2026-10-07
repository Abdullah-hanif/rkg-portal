import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDatabase } from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
