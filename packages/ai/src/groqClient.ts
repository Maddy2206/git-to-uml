import Groq from "groq-sdk";
import pTimeout from "p-timeout";
import type { z } from "zod";

const MODEL = "llama-3.3-70b-versatile";

/**
 * The only thing the reasoning functions in this package depend on — a
 * minimal chat-completion boundary, not the real groq-sdk client directly.
 * Tests inject a fake implementation here, so nothing in this package's
 * test suite ever makes a real network call.
 */
export interface GroqChatClient {
  chatJSON(params: { systemPrompt: string; userPrompt: string; maxCompletionTokens: number }): Promise<string>;
}

/** Wraps the real groq-sdk client behind the minimal GroqChatClient boundary. */
export function createGroqClient(apiKey: string): GroqChatClient {
  const client = new Groq({ apiKey });
  return {
    async chatJSON({ systemPrompt, userPrompt, maxCompletionTokens }) {
      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0,
        max_completion_tokens: maxCompletionTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      const content = completion.choices[0]?.message.content;
      if (!content) throw new Error("Groq response had no message content");
      return content;
    },
  };
}

function resolveClient(apiKey: string | undefined): GroqChatClient | null {
  const key = apiKey ?? process.env.GROQ_API_KEY;
  return key ? createGroqClient(key) : null;
}

export interface CallGroqSafelyParams<T> {
  /** Explicit key, falling back to `process.env.GROQ_API_KEY` — read lazily here, never at module load time (same pattern as GITHUB_TOKEN elsewhere in this repo). */
  apiKey?: string;
  /** Test-only injection point — bypasses `resolveClient`/env entirely when set. */
  client?: GroqChatClient;
  systemPrompt: string;
  userPrompt: string;
  maxCompletionTokens: number;
  timeoutMs: number;
  schema: z.ZodType<T>;
}

/**
 * The shared "never throw" boundary every AI reasoning function in this
 * package goes through: no API key and no injected test client -> `null`
 * without ever constructing a client or making a network call; any error
 * at all (network failure, timeout, non-JSON response, schema mismatch)
 * -> `null`. Callers always have a heuristic fallback ready for this —
 * diagram generation must never hard-depend on Groq being reachable.
 */
export async function callGroqSafely<T>(params: CallGroqSafelyParams<T>): Promise<T | null> {
  const client = params.client ?? resolveClient(params.apiKey);
  if (!client) return null;

  try {
    const raw = await pTimeout(
      client.chatJSON({
        systemPrompt: params.systemPrompt,
        userPrompt: params.userPrompt,
        maxCompletionTokens: params.maxCompletionTokens,
      }),
      { milliseconds: params.timeoutMs, message: "Groq request timed out" },
    );
    const parsed: unknown = JSON.parse(raw);
    const result = params.schema.safeParse(parsed);
    if (!result.success) {
      console.warn("[git-to-uml/ai] Groq response failed schema validation, falling back to heuristics:", result.error.message);
      return null;
    }
    return result.data;
  } catch (err) {
    console.warn("[git-to-uml/ai] Groq call failed, falling back to heuristics:", err instanceof Error ? err.message : err);
    return null;
  }
}
