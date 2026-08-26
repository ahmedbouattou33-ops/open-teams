#!/usr/bin/env node
import { loadEnv } from "./env.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = await createServer(loadEnv());
  try {
    const address = await server.start();
    server.app.log.info(`mcp-messaging listening on ${address} (POST /mcp, GET /ws)`);
  } catch (error) {
    server.app.log.error(error, "Failed to start mcp-messaging");
    process.exitCode = 1;
  }
}

void main();
