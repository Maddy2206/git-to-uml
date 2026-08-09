import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { callGroqSafely, type GroqChatClient } from "./groqClient";

const schema = z.object({ value: z.number() });

function makeClient(chatJSON: GroqChatClient["chatJSON"]): GroqChatClient {
  return { chatJSON };
}

describe("callGroqSafely", () => {
  it("returns null without calling the client when there's no API key and no injected client", async () => {
    const chatJSON = vi.fn();
    const result = await callGroqSafely({
      apiKey: undefined,
      systemPrompt: "s",
      userPrompt: "u",
      maxCompletionTokens: 100,
      timeoutMs: 1000,
      schema,
    });
    expect(result).toBeNull();
    expect(chatJSON).not.toHaveBeenCalled();
  });

  it("parses and validates a well-formed JSON response", async () => {
    const client = makeClient(async () => JSON.stringify({ value: 42 }));
    const result = await callGroqSafely({ client, systemPrompt: "s", userPrompt: "u", maxCompletionTokens: 100, timeoutMs: 1000, schema });
    expect(result).toEqual({ value: 42 });
  });

  it("returns null on non-JSON output", async () => {
    const client = makeClient(async () => "not json at all");
    const result = await callGroqSafely({ client, systemPrompt: "s", userPrompt: "u", maxCompletionTokens: 100, timeoutMs: 1000, schema });
    expect(result).toBeNull();
  });

  it("returns null when JSON is valid but fails the schema", async () => {
    const client = makeClient(async () => JSON.stringify({ value: "not a number" }));
    const result = await callGroqSafely({ client, systemPrompt: "s", userPrompt: "u", maxCompletionTokens: 100, timeoutMs: 1000, schema });
    expect(result).toBeNull();
  });

  it("returns null when the client throws", async () => {
    const client = makeClient(async () => {
      throw new Error("network error");
    });
    const result = await callGroqSafely({ client, systemPrompt: "s", userPrompt: "u", maxCompletionTokens: 100, timeoutMs: 1000, schema });
    expect(result).toBeNull();
  });

  it("returns null when the client hangs past the timeout", async () => {
    const client = makeClient(() => new Promise(() => {})); // never resolves
    const result = await callGroqSafely({ client, systemPrompt: "s", userPrompt: "u", maxCompletionTokens: 100, timeoutMs: 50, schema });
    expect(result).toBeNull();
  });
});
