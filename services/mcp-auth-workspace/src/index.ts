#!/usr/bin/env node
import { loadEnv } from "./env.js";
import { createServer } from "./server.js";

const server = createServer(loadEnv());

server
  .start()
  .then((address) => {
    server.app.log.info(`mcp-auth-workspace listening on ${address} (POST /mcp)`);
  })
  .catch((error) => {
    server.app.log.error(error, "Failed to start mcp-auth-workspace");
    process.exitCode = 1;
  });
