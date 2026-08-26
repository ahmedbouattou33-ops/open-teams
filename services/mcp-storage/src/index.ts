#!/usr/bin/env node
import { loadEnv } from "./env.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = await createServer(loadEnv());
  try {
    const address = await server.start();
    server.app.log.info(`mcp-storage listening on ${address} (POST /mcp, GET /health)`);
  } catch (error) {
    server.app.log.error(error, "Failed to start mcp-storage");
    process.exitCode = 1;
  }
}

void main();
