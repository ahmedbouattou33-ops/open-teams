import { z, type ZodTypeDef } from "zod";
import { McpError } from "./errors.js";
import {
  failureResponse,
  invalidRequest,
  parseError,
  parseJsonRpcRequest,
  successResponse,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./protocol.js";

/** Identity of the caller, resolved from the transport layer (e.g. JWT bearer token). */
export interface AuthContext {
  readonly userId?: string;
}

export interface ToolDefinition<I> {
  readonly name: string;
  readonly description: string;
  /** Accepts schemas with defaults/coercions (input side may differ from output). */
  readonly input: z.ZodType<I, z.ZodTypeDef, unknown>;
  /** When true the tool rejects unauthenticated contexts. */
  readonly secure: boolean;
  handler: (input: I, ctx: AuthContext) => Promise<unknown>;
}

type ErasedTool = {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodTypeAny;
  readonly secure: boolean;
  handler: (input: never, ctx: AuthContext) => Promise<unknown>;
};

export function defineTool<I>(definition: ToolDefinition<I>): ToolDefinition<I> {
  return definition;
}

/**
 * Central JSON-RPC dispatcher. Tools are isolated units; the registry owns
 * validation, auth enforcement and error normalization.
 */
export class ToolRegistry {
  readonly #tools = new Map<string, ErasedTool>();

  get size(): number {
    return this.#tools.size;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic identity is erased at the registry boundary
  register(tool: ToolDefinition<any>): this {
    if (this.#tools.has(tool.name)) {
      throw new Error(`MCP tool already registered: ${tool.name}`);
    }
    this.#tools.set(tool.name, tool as unknown as ErasedTool);
    return this;
  }

  list(): ReadonlyArray<{ name: string; description: string }> {
    return [...this.#tools.values()].map(({ name, description }) => ({ name, description }));
  }

  async handle(rawBody: unknown, ctx: AuthContext): Promise<JsonRpcResponse | null> {
    let request: JsonRpcRequest | null;
    try {
      request = typeof rawBody === "string" ? parseJsonRpcRequest(JSON.parse(rawBody)) : parseJsonRpcRequest(rawBody);
    } catch {
      return parseError();
    }
    if (!request) return invalidRequest(null);

    const id: JsonRpcId | null = request.id;
    const isNotification = id === null || id === undefined;

    const tool = this.#tools.get(request.method);
    if (!tool) {
      return isNotification
        ? null
        : failureResponse(id, new McpError(-32601, `Unknown method: ${request.method}`));
    }
    if (tool.secure && !ctx.userId) {
      return isNotification ? null : failureResponse(id, McpError.unauthorized());
    }

    let input: unknown;
    try {
      input = tool.input.parse(request.params ?? {});
    } catch (error) {
      return isNotification
        ? null
        : failureResponse(
            id,
            new McpError(-32602, "Invalid params", error instanceof z.ZodError ? error.flatten() : undefined),
          );
    }

    try {
      const result = await tool.handler(input as never, ctx);
      return isNotification ? null : successResponse(id, result ?? {});
    } catch (error) {
      if (isNotification) return null;
      if (error instanceof McpError) return failureResponse(id, error);
      return failureResponse(id, new McpError(-32603, "Internal server error"));
    }
  }
}
