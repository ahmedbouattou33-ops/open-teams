import { z } from "zod";
import { JsonRpcErrorCode, McpError } from "./errors.js";

export const JsonRpcIdSchema = z.union([z.string(), z.number()]);
export type JsonRpcId = z.infer<typeof JsonRpcIdSchema>;

export interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId | null;
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonRpcSuccess<T> {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId | null;
  readonly result: T;
}

export interface JsonRpcFailure {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId | null;
  readonly error: {
    readonly code: number;
    readonly message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse<T = unknown> = JsonRpcSuccess<T> | JsonRpcFailure;

const RequestShapeSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: JsonRpcIdSchema.nullable().optional(),
  method: z.string(),
  params: z.unknown().optional(),
});

/** Validates a raw payload as a JSON-RPC request; returns `null` when invalid. */
export function parseJsonRpcRequest(raw: unknown): JsonRpcRequest | null {
  const parsed = RequestShapeSchema.safeParse(raw);
  return parsed.success ? { ...parsed.data, id: parsed.data.id ?? null } : null;
}

export function successResponse<T>(id: JsonRpcId | null, result: T): JsonRpcSuccess<T> {
  return { jsonrpc: "2.0", id, result };
}

export function failureResponse(id: JsonRpcId | null, error: McpError): JsonRpcFailure {
  const body: JsonRpcFailure["error"] = { code: error.code, message: error.message };
  if (error.data !== undefined) body.data = error.data;
  return { jsonrpc: "2.0", id, error: body };
}

export function parseError(): JsonRpcFailure {
  return failureResponse(null, new McpError(JsonRpcErrorCode.ParseError, "Invalid JSON payload"));
}

export function invalidRequest(id: JsonRpcId | null): JsonRpcFailure {
  return failureResponse(id, new McpError(JsonRpcErrorCode.InvalidRequest, "Malformed JSON-RPC 2.0 request"));
}
