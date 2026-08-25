import { PrismaClient } from "./generated/prisma/index.js";

declare global {
  // eslint-disable-next-line no-var
  var __prismaStorage: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prismaStorage ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV === "development") {
  globalThis.__prismaStorage = prisma;
}
