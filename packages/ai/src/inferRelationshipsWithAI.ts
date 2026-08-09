import type { ClassIR, GraphEdge } from "@git-to-uml/ir";
import { callGroqSafely, type GroqChatClient } from "./groqClient";
import { RelationshipsResponseSchema } from "./schemas";
import { buildClassAliases, buildRelationshipsUserPrompt, RELATIONSHIPS_SYSTEM_PROMPT } from "./prompts";

/** Above this many classes, skip the AI call entirely (predictable degrade to the heuristic for very large repos, rather than an oversized/truncated prompt). */
const MAX_CLASSES_FOR_AI = 120;
const TIMEOUT_MS = 15_000;
const MAX_COMPLETION_TOKENS = 4096;

export interface InferRelationshipsOptions {
  apiKey?: string;
  /** Test-only injection point. */
  client?: GroqChatClient;
}

/**
 * AI-reasoned replacement for `inferComposition` (see @git-to-uml/ir): given
 * already-extracted classes (never raw source), asks Groq which
 * composition/aggregation relationships actually matter, rather than the
 * heuristic's token-matching. Returns `null` — never throws — on a missing
 * API key, any network/timeout/parsing failure, or when `classes.length`
 * exceeds the size guardrail; callers fall back to `inferComposition` in
 * that case.
 */
export async function inferRelationshipsWithAI(classes: ClassIR[], options: InferRelationshipsOptions = {}): Promise<GraphEdge[] | null> {
  if (classes.length === 0) return [];
  if (classes.length > MAX_CLASSES_FOR_AI) return null;

  const { aliasToId, payload } = buildClassAliases(classes);

  const response = await callGroqSafely({
    apiKey: options.apiKey,
    client: options.client,
    systemPrompt: RELATIONSHIPS_SYSTEM_PROMPT,
    userPrompt: buildRelationshipsUserPrompt(payload),
    maxCompletionTokens: MAX_COMPLETION_TOKENS,
    timeoutMs: TIMEOUT_MS,
    schema: RelationshipsResponseSchema,
  });
  if (!response) return null;

  const edges: GraphEdge[] = [];
  let edgeSeq = 0;
  const seen = new Set<string>();

  for (const rel of response.relationships) {
    const from = aliasToId.get(rel.from);
    const to = aliasToId.get(rel.to);
    // Drop individual items referencing a hallucinated alias or a self-loop
    // rather than discarding the whole response — salvage what's valid.
    if (!from || !to || from === to) continue;
    const key = `${rel.kind}:${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ id: `ai-edge-${edgeSeq++}`, kind: rel.kind, from, to, label: rel.label });
  }

  return edges;
}
