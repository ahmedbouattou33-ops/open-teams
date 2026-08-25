/** Standard JSON-RPC 2.0 error codes. */
export const JsonRpcErrorCode = Object.freeze({
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const);

/** OpenTeams application error codes (server-defined range -32000..-32099). */
export const AppErrorCode = Object.freeze({
  Unauthorized: -32001,
  Forbidden: -32002,
  NotFound: -32003,
  Conflict: -32004,
} as const);

export class McpError extends Error {
  override readonly name = "McpError";

  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }

  static unauthorized(message = "Authentication required"): McpError {
    return new McpError(AppErrorCode.Unauthorized, message);
  }

  static forbidden(message = "Insufficient permissions"): McpError {
    return new McpError(AppErrorCode.Forbidden, message);
  }

  static notFound(message = "Resource not found"): McpError {
    return new McpError(AppErrorCode.NotFound, message);
  }

  static conflict(message = "Resource already exists"): McpError {
    return new McpError(AppErrorCode.Conflict, message);
  }
}
