import { describe, expect, it } from "vitest";
import type { ClassIR } from "@git-to-uml/ir";
import type { GroqChatClient } from "./groqClient";
import { inferRelationshipsWithAI } from "./inferRelationshipsWithAI";

function makeClass(overrides: Partial<ClassIR> & Pick<ClassIR, "id" | "name" | "filePath">): ClassIR {
  return {
    kind: "class",
    fields: [],
    methods: [],
    position: { file: overrides.filePath, startLine: 1, endLine: 1 },
    language: "typescript",
    ...overrides,
  };
}

function makeClient(response: string): GroqChatClient {
  return { chatJSON: async () => response };
}

const carRepo = makeClass({ id: "car.ts#Car", name: "Car", filePath: "car.ts" });
const engineRepo = makeClass({ id: "engine.ts#Engine", name: "Engine", filePath: "engine.ts" });

describe("inferRelationshipsWithAI", () => {
  it("returns [] immediately for zero classes, without calling the client", async () => {
    const result = await inferRelationshipsWithAI([], { client: makeClient("{}") });
    expect(result).toEqual([]);
  });

  it("returns null without calling the client when over the size guardrail", async () => {
    let called = false;
    const client: GroqChatClient = { chatJSON: async () => ((called = true), "{}") };
    const manyClasses = Array.from({ length: 121 }, (_, i) => makeClass({ id: `c${i}.ts#C${i}`, name: `C${i}`, filePath: `c${i}.ts` }));
    const result = await inferRelationshipsWithAI(manyClasses, { client });
    expect(result).toBeNull();
    expect(called).toBe(false);
  });

  it("maps aliases back to real class ids on a well-formed response", async () => {
    const client = makeClient(JSON.stringify({ relationships: [{ from: "C1", to: "C2", kind: "composes", label: "engine" }] }));
    const result = await inferRelationshipsWithAI([carRepo, engineRepo], { client });
    expect(result).toEqual([{ id: "ai-edge-0", kind: "composes", from: "car.ts#Car", to: "engine.ts#Engine", label: "engine" }]);
  });

  it("drops relationships referencing an unknown (hallucinated) alias, keeping valid ones", async () => {
    const client = makeClient(
      JSON.stringify({
        relationships: [
          { from: "C1", to: "C99", kind: "composes" }, // C99 doesn't exist
          { from: "C1", to: "C2", kind: "aggregates" },
        ],
      }),
    );
    const result = await inferRelationshipsWithAI([carRepo, engineRepo], { client });
    expect(result).toEqual([{ id: "ai-edge-0", kind: "aggregates", from: "car.ts#Car", to: "engine.ts#Engine", label: undefined }]);
  });

  it("drops self-referencing relationships", async () => {
    const client = makeClient(JSON.stringify({ relationships: [{ from: "C1", to: "C1", kind: "composes" }] }));
    const result = await inferRelationshipsWithAI([carRepo, engineRepo], { client });
    expect(result).toEqual([]);
  });

  it("returns null when the model output fails schema validation (e.g. bad kind)", async () => {
    const client = makeClient(JSON.stringify({ relationships: [{ from: "C1", to: "C2", kind: "extends" }] }));
    const result = await inferRelationshipsWithAI([carRepo, engineRepo], { client });
    expect(result).toBeNull();
  });

  it("returns null (falls back to heuristic) when there's no API key and no injected client", async () => {
    const result = await inferRelationshipsWithAI([carRepo, engineRepo], {});
    expect(result).toBeNull();
  });
});
