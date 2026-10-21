import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

const cachedPrisma = globalForPrisma.prisma;
const hasLatestDelegates =
  Boolean(cachedPrisma) &&
  typeof (cachedPrisma as unknown as Record<string, unknown>).goldPriceQuote !==
    "undefined" &&
  typeof (cachedPrisma as unknown as Record<string, unknown>).savingsDeposit !==
    "undefined";

export const prisma =
  hasLatestDelegates && cachedPrisma
    ? cachedPrisma
    : new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
