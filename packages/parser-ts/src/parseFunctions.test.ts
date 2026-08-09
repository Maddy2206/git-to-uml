import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseTypeScriptProject } from "./parseProject";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__/functions");

function functionsById(files: ReturnType<typeof parseTypeScriptProject>) {
  const byId: Record<string, ReturnType<typeof parseTypeScriptProject>[number]["functions"][number]> = {};
  for (const file of files) for (const fn of file.functions) byId[fn.id] = fn;
  return byId;
}

describe("parseTypeScriptProject — function/component/hook/handler extraction", () => {
  it("captures a const-arrow-function React component, tagging it with role 'component'", () => {
    const files = parseTypeScriptProject(fixturesDir);
    const fns = functionsById(files);

    const header = fns["Header.tsx#Header"];
    expect(header).toBeDefined();
    expect(header.role).toBe("component");
    expect(header.isExported).toBe(true);
  });

  it("captures a const-arrow-function hook, tagging it with role 'hook'", () => {
    const files = parseTypeScriptProject(fixturesDir);
    const fns = functionsById(files);

    const useCounter = fns["useCounter.ts#useCounter"];
    expect(useCounter).toBeDefined();
    expect(useCounter.role).toBe("hook");
  });

  it("records usesNames for identifiers referenced from the function's own imports, including JSX tag usage", () => {
    const files = parseTypeScriptProject(fixturesDir);
    const fns = functionsById(files);

    const app = fns["App.tsx#App"];
    expect(app).toBeDefined();
    expect(app.role).toBe("component");
    expect(app.usesNames).toEqual(expect.arrayContaining(["Header", "useCounter"]));
  });

  it("does not assign a role to a plain, non-component, non-hook function", () => {
    const files = parseTypeScriptProject(fixturesDir);
    const fns = functionsById(files);

    const add = fns["plainHelper.ts#add"];
    expect(add).toBeDefined();
    expect(add.role).toBeUndefined();
  });

  it("tags an exported HTTP-method function in a Next.js route.ts file with role 'handler'", () => {
    const files = parseTypeScriptProject(fixturesDir);
    const fns = functionsById(files);

    const get = fns["app/api/users/route.ts#GET"];
    expect(get).toBeDefined();
    expect(get.role).toBe("handler");
  });

  it("unwraps a higher-order-call-wrapped route handler (e.g. `export const GET = auth((req) => {...})`)", () => {
    const files = parseTypeScriptProject(fixturesDir);
    const fns = functionsById(files);

    const get = fns["app/api/protected/route.ts#GET"];
    expect(get).toBeDefined();
    expect(get.role).toBe("handler");
  });

  it("synthesizes a name for an anonymous default-exported function in a known Next.js special file", () => {
    const files = parseTypeScriptProject(fixturesDir);
    const fns = functionsById(files);

    const page = fns["app/page.tsx#Page"];
    expect(page).toBeDefined();
    expect(page.role).toBe("component");
  });
});
