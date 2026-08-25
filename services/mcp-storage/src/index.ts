#!/usr/bin/env node
import { loadEnv } from "./env.js";
import { createServer } from "./server.js";

const server = createServer(loadEnv());

server
  .start()
  .then((address) => {
    server.app.log.info(`mcp-storage listening on ${address} (POST /mcp, GET /health)`);
  })
  .catch((error) => {
    server.app.log.error(error, "Failed to start mcp-storage");
    process.exitCode = 1;
  });
