import { describe, expect, it } from "vitest";
import type { ModuleIR } from "@git-to-uml/ir";
import { classifyModule } from "./componentClassifier";

function makeModule(filePath: string, importSpecifiers: string[] = []): ModuleIR {
  return {
    id: filePath,
    filePath,
    language: "typescript",
    imports: importSpecifiers.map((to) => ({ from: filePath, to, specifiers: [], resolved: false })),
    classes: [],
    functions: [],
    loc: 1,
  };
}

describe("classifyModule", () => {
  it("classifies by directory convention", () => {
    expect(classifyModule(makeModule("src/models/user.ts"))).toBe("database");
    expect(classifyModule(makeModule("src/controllers/userController.ts"))).toBe("api");
    expect(classifyModule(makeModule("src/services/userService.ts"))).toBe("application");
    expect(classifyModule(makeModule("src/components/Button.tsx"))).toBe("client");
    expect(classifyModule(makeModule("src/middleware/authGuard.ts"))).toBe("auth");
    expect(classifyModule(makeModule("src/cache/redisClient.ts"))).toBe("cache");
    expect(classifyModule(makeModule("src/queues/emailWorker.ts"))).toBe("queue");
    expect(classifyModule(makeModule("infra/docker-compose.ts"))).toBe("infra");
    expect(classifyModule(makeModule("src/shared/utils.ts"))).toBe("shared");
  });

  it("classifies by filename-suffix convention even outside a matching directory", () => {
    expect(classifyModule(makeModule("src/UserController.java"))).toBe("api");
    expect(classifyModule(makeModule("src/user.model.ts"))).toBe("database");
    expect(classifyModule(makeModule("src/user.repository.ts"))).toBe("database");
  });

  it("falls back to a known package import when the path gives no signal", () => {
    expect(classifyModule(makeModule("src/app.ts", ["express"]))).toBe("api");
    expect(classifyModule(makeModule("src/db.ts", ["@prisma/client"]))).toBe("database");
    expect(classifyModule(makeModule("src/index.ts", ["react"]))).toBe("client");
  });

  it("defaults to application logic when nothing matches", () => {
    expect(classifyModule(makeModule("src/index.ts", ["lodash"]))).toBe("application");
    expect(classifyModule(makeModule("main.py"))).toBe("application");
  });

  it("prefers path signals over import signals", () => {
    // A file under models/ that happens to import express (e.g. for typing) is still a database file.
    expect(classifyModule(makeModule("src/models/user.ts", ["express"]))).toBe("database");
  });

  it("recognizes common technology names, not just generic keywords", () => {
    // A file named after the tech (RedisClient.ts) rather than living under a literal cache/ folder.
    expect(classifyModule(makeModule("src/infra/RedisClient.ts"))).toBe("cache");
    expect(classifyModule(makeModule("src/infra/kafkaProducer.ts"))).toBe("queue");
    expect(classifyModule(makeModule("src/infra/mongoConnection.ts"))).toBe("database");
  });

  it("classifies Next.js App Router conventions ahead of the generic rules", () => {
    expect(classifyModule(makeModule("middleware.ts"))).toBe("infra");
    expect(classifyModule(makeModule("src/middleware.ts"))).toBe("infra");
    expect(classifyModule(makeModule("app/api/users/route.ts"))).toBe("api");
    expect(classifyModule(makeModule("app/(dashboard)/webhook/route.ts"))).toBe("api");
    expect(classifyModule(makeModule("app/dashboard/page.tsx"))).toBe("pages");
    expect(classifyModule(makeModule("app/layout.tsx"))).toBe("pages");
    expect(classifyModule(makeModule("app/loading.tsx"))).toBe("pages");
    expect(classifyModule(makeModule("app/error.tsx"))).toBe("pages");
  });

  it("classifies Pages Router conventions (pages/api vs plain pages/)", () => {
    expect(classifyModule(makeModule("pages/api/users.ts"))).toBe("api");
    expect(classifyModule(makeModule("pages/index.tsx"))).toBe("pages");
  });

  it("does not let the exact-filename middleware.ts rule false-positive on unrelated middleware files", () => {
    // A file merely living under a middleware/ directory (not literally named middleware.ts)
    // still falls through to the generic auth keyword rule, unaffected by the Next.js rule.
    expect(classifyModule(makeModule("src/middleware/authGuard.ts"))).toBe("auth");
  });
});
