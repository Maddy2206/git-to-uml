import { describe, expect, it } from "vitest";
import type { ModuleIR } from "@git-to-uml/ir";
import type { GroqChatClient } from "./groqClient";
import { classifyComponentsWithAI } from "./classifyComponentsWithAI";

function makeModule(id: string, imports: string[] = []): ModuleIR {
  return {
    id,
    filePath: id,
    language: "typescript",
    imports: imports.map((to) => ({ from: id, to, specifiers: [], resolved: false })),
    classes: [],
    functions: [],
    loc: 1,
  };
}

function makeClient(response: string): GroqChatClient {
  return { chatJSON: async () => response };
}

const controllerMod = makeModule("src/api/userController.ts", ["express"]);
const modelMod = makeModule("src/models/user.ts");

describe("classifyComponentsWithAI", () => {
  it("returns {} immediately for zero modules, without calling the client", async () => {
    const result = await classifyComponentsWithAI([], { client: makeClient("{}") });
    expect(result).toEqual({});
  });

  it("returns null without calling the client when over the size guardrail", async () => {
    let called = false;
    const client: GroqChatClient = { chatJSON: async () => ((called = true), "{}") };
    const manyModules = Array.from({ length: 301 }, (_, i) => makeModule(`m${i}.ts`));
    const result = await classifyComponentsWithAI(manyModules, { client });
    expect(result).toBeNull();
    expect(called).toBe(false);
  });

  it("maps aliases back to real module ids on a well-formed response", async () => {
    const client = makeClient(
      JSON.stringify({
        classifications: [
          { module: "M1", category: "api" },
          { module: "M2", category: "database" },
        ],
      }),
    );
    const result = await classifyComponentsWithAI([controllerMod, modelMod], { client });
    expect(result).toEqual({ "src/api/userController.ts": "api", "src/models/user.ts": "database" });
  });

  it("drops classifications referencing an unknown (hallucinated) alias, keeping the rest", async () => {
    const client = makeClient(
      JSON.stringify({
        classifications: [
          { module: "M99", category: "api" }, // doesn't exist
          { module: "M2", category: "database" },
        ],
      }),
    );
    const result = await classifyComponentsWithAI([controllerMod, modelMod], { client });
    expect(result).toEqual({ "src/models/user.ts": "database" });
  });

  it("returns null when the model output fails schema validation (e.g. unknown category)", async () => {
    const client = makeClient(JSON.stringify({ classifications: [{ module: "M1", category: "not-a-real-category" }] }));
    const result = await classifyComponentsWithAI([controllerMod, modelMod], { client });
    expect(result).toBeNull();
  });

  it("a partial response (some modules omitted) is not a failure — just an incomplete map", async () => {
    const client = makeClient(JSON.stringify({ classifications: [{ module: "M1", category: "api" }] }));
    const result = await classifyComponentsWithAI([controllerMod, modelMod], { client });
    expect(result).toEqual({ "src/api/userController.ts": "api" });
  });

  it("returns null (falls back to heuristic) when there's no API key and no injected client", async () => {
    const result = await classifyComponentsWithAI([controllerMod, modelMod], {});
    expect(result).toBeNull();
  });
});
