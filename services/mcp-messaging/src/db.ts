import { PrismaClient } from "./generated/prisma/index.js";

declare global {
  // eslint-disable-next-line no-var
  var __prismaMessaging: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prismaMessaging ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV === "development") {
  globalThis.__prismaMessaging = prisma;
}
