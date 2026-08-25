#!/usr/bin/env node
import { loadEnv } from "./env.js";
import { createServer } from "./server.js";

const server = createServer(loadEnv());

server
  .start()
  .then((address) => {
    server.app.log.info(`mcp-messaging listening on ${address} (POST /mcp, GET /ws)`);
  })
  .catch((error) => {
    server.app.log.error(error, "Failed to start mcp-messaging");
    process.exitCode = 1;
  });
