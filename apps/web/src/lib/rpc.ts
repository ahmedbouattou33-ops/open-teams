export const APP_ERROR_CODE = {
  Unauthorized: -32001,
  Forbidden: -32002,
  NotFound: -32003,
  Conflict: -32004,
} as const;

export class RpcError extends Error {
  override readonly name = "RpcError";

  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }

  get isUnauthorized(): boolean {
    return this.code === APP_ERROR_CODE.Unauthorized;
  }
}

interface JsonRpcResponseBody<T> {
  readonly jsonrpc: "2.0";
  readonly id: number | string | null;
  readonly result?: T;
  readonly error?: { readonly code: number; readonly message: string; readonly data?: unknown };
}

let nextId = 1;

export async function rpc<T>(
  baseUrl: string,
  method: string,
  params?: unknown,
  accessToken?: string | null,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params: params ?? {} }),
      cache: "no-store",
      signal,
    });
  } catch (cause) {
    throw new RpcError(-32603, `Cannot reach service at ${baseUrl}`, cause);
  }

  let body: JsonRpcResponseBody<T>;
  try {
    body = (await response.json()) as JsonRpcResponseBody<T>;
  } catch {
    throw new RpcError(-32603, `${method}: malformed server response (HTTP ${response.status})`);
  }

  if (body.error) {
    throw new RpcError(body.error.code, body.error.message, body.error.data);
  }
  return body.result as T;
}
