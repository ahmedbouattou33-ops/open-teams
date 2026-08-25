#!/usr/bin/env node
import { loadEnv } from "./env.js";
import { createServer } from "./server.js";

const server = createServer(loadEnv());

server
  .start()
  .then((address) => {
    server.app.log.info(`mcp-media-rtc listening on ${address} (POST /mcp, GET /ws/call, GET /health)`);
  })
  .catch((error) => {
    server.app.log.error(error, "Failed to start mcp-media-rtc");
    process.exitCode = 1;
  });