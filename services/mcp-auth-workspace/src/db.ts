import { PrismaClient } from "./generated/prisma/index.js";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/** Singleton Prisma client (survives tsx watch hot reloads in dev). */
export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV === "development") {
  globalThis.__prisma = prisma;
}
