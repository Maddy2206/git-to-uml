import type { ModuleIR } from "@git-to-uml/ir";
import type { ComponentCategory } from "@git-to-uml/graph";
import { callGroqSafely, type GroqChatClient } from "./groqClient";
import { ClassificationsResponseSchema } from "./schemas";
import { buildClassificationUserPrompt, buildModuleAliases, CLASSIFICATION_SYSTEM_PROMPT } from "./prompts";

/** Above this many modules, skip the AI call entirely (predictable degrade to the heuristic for very large repos). */
const MAX_MODULES_FOR_AI = 300;
const TIMEOUT_MS = 15_000;
const MAX_COMPLETION_TOKENS = 2048;

export interface ClassifyComponentsOptions {
  apiKey?: string;
  /** Test-only injection point. */
  client?: GroqChatClient;
}

/**
 * AI-reasoned replacement for `classifyModule` (see @git-to-uml/graph):
 * given already-extracted modules (file paths + raw import specifiers,
 * never source code), asks Groq which logical architecture component each
 * one belongs to. Returns `null` — never throws — on a missing API key,
 * any network/timeout/parsing failure, or when `modules.length` exceeds
 * the size guardrail; callers fall back to `classifyModule` per-module in
 * that case. A partial response (some modules omitted) is not a failure —
 * missing modules just fall through to the heuristic individually.
 */
export async function classifyComponentsWithAI(
  modules: ModuleIR[],
  options: ClassifyComponentsOptions = {},
): Promise<Record<string, ComponentCategory> | null> {
  if (modules.length === 0) return {};
  if (modules.length > MAX_MODULES_FOR_AI) return null;

  const { aliasToId, payload } = buildModuleAliases(modules);

  const response = await callGroqSafely({
    apiKey: options.apiKey,
    client: options.client,
    systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
    userPrompt: buildClassificationUserPrompt(payload),
    maxCompletionTokens: MAX_COMPLETION_TOKENS,
    timeoutMs: TIMEOUT_MS,
    schema: ClassificationsResponseSchema,
  });
  if (!response) return null;

  const result: Record<string, ComponentCategory> = {};
  for (const item of response.classifications) {
    const moduleId = aliasToId.get(item.module);
    if (!moduleId) continue; // hallucinated alias — skip, heuristic covers it
    result[moduleId] = item.category;
  }
  return result;
}
