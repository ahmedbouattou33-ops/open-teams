import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuthContext, ToolRegistry } from "./registry.js";

export interface McpRouteOptions {
  /** Path under which the JSON-RPC endpoint is exposed. */
  readonly path?: string;
  /**
   * Resolves caller identity from the request (e.g. verify a JWT bearer
   * token). Must never throw for anonymous callers — return `{}` instead.
   */
  readonly authenticate?: (request: FastifyRequest) => Promise<AuthContext> | AuthContext;
}

/**
 * Registers the MCP transport on a Fastify instance: `POST <path>` speaking
 * JSON-RPC 2.0. Notifications (`id: null`) yield HTTP 204.
 */
export function registerMcpEndpoint(app: FastifyInstance, registry: ToolRegistry, options: McpRouteOptions = {}): void {
  const path = options.path ?? "/mcp";

  app.post(path, async (request: FastifyRequest, reply: FastifyReply) => {
    const ctx: AuthContext = options.authenticate ? await options.authenticate(request) : {};
    const response = await registry.handle(request.body, ctx);
    if (!response) {
      return reply.code(204).send();
    }
    const isError = "error" in response;
    return reply.code(isError ? 400 : 200).send(response);
  });
}
