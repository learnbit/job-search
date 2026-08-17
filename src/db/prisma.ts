import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.",
  );
}

const globalForPrisma = globalThis as typeof globalThis & {
  jobSearchPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.jobSearchPrisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.jobSearchPrisma = prisma;
}
