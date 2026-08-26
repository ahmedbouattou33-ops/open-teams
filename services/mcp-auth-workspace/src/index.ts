#!/usr/bin/env node
import { loadEnv } from "./env.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = await createServer(loadEnv());
  try {
    const address = await server.start();
    server.app.log.info(`mcp-auth-workspace listening on ${address} (POST /mcp)`);
  } catch (error) {
    server.app.log.error(error, "Failed to start mcp-auth-workspace");
    process.exitCode = 1;
  }
}

void main();
