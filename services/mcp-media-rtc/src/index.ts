#!/usr/bin/env node
import { loadEnv } from "./env.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = await createServer(loadEnv());
  try {
    const address = await server.start();
    server.app.log.info(`mcp-media-rtc listening on ${address} (POST /mcp, GET /ws/call, GET /health)`);
  } catch (error) {
    server.app.log.error(error, "Failed to start mcp-media-rtc");
    process.exitCode = 1;
  }
}

void main();
