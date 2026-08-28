const DEFAULT_BASE_URL = "http://host.docker.internal:1234/v1";

export interface ChatMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

export async function completeLocalLlm(messages: readonly ChatMessage[], options?: { timeoutMs?: number }): Promise<string> {
  const baseUrl = (process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.LLM_MODEL ?? "local-model";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 20_000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(process.env.LLM_API_KEY ? { authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}) },
      body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 600 }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`LLM request failed with status ${response.status}`);
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) throw new Error("LLM returned no content");
    return content.slice(0, 10_000);
  } finally {
    clearTimeout(timeout);
  }
}
