import Fastify from "fastify";

const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });
const startedAt = Date.now();
const LLM_BASE_URL = (process.env.LLM_BASE_URL ?? "http://host.docker.internal:1234/v1").replace(/\/$/, "");

app.get("/health", async () => ({ status: "ok", service: "mcp-ai-agent", uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) }));
app.get("/metrics", async (_request, reply) => {
  reply.type("text/plain; version=0.0.4");
  return `openteams_ai_agent_up 1\nopenteams_ai_agent_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}\n`;
});

app.post("/summarize", async (request, reply) => {
  const body = (request.body ?? {}) as { text?: unknown };
  if (typeof body.text !== "string" || body.text.trim().length === 0) return reply.code(400).send({ error: "text is required" });
  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.LLM_MODEL ?? "local-model", temperature: 0.2, max_tokens: 600, messages: [
      { role: "system", content: "Summarize the supplied enterprise conversation faithfully with decisions, action items, risks, and open questions." },
      { role: "user", content: body.text.slice(0, 40_000) },
    ] }),
  });
  if (!response.ok) return reply.code(502).send({ error: `LLM endpoint returned ${response.status}` });
  const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return reply.send({ summary: result.choices?.[0]?.message?.content ?? "" });
});

app.post("/transcribe", async (request, reply) => {
  const body = (request.body ?? {}) as { audioUrl?: unknown; language?: unknown };
  if (typeof body.audioUrl !== "string" || body.audioUrl.length < 8) return reply.code(400).send({ error: "audioUrl is required" });
  const whisperUrl = (process.env.WHISPER_URL ?? "http://whisper:8080").replace(/\/$/, "");
  try {
    const response = await fetch(`${whisperUrl}/inference`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ audioUrl: body.audioUrl, language: body.language ?? "auto" }) });
    if (!response.ok) return reply.code(502).send({ error: `Whisper endpoint returned ${response.status}` });
    const result = await response.json() as { text?: string };
    return reply.send({ transcript: result.text ?? "", status: "completed" });
  } catch {
    return reply.code(503).send({ error: "Whisper endpoint unavailable", status: "pending" });
  }
});

const port = Number(process.env.PORT ?? 4005);
await app.listen({ port, host: "0.0.0.0" });
