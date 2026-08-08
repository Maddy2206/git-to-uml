import type { ModuleIR } from "@git-to-uml/ir";

/**
 * A small, fixed set of the logical components a typical backend/fullstack
 * repo is built from — the boxes you'd actually draw on a whiteboard in a
 * system-design interview (API gateway, database, cache, ...), not a box
 * per source directory. `application` is the catch-all default for code
 * that doesn't match any more specific signal.
 */
export type ComponentCategory =
  | "client"
  | "api"
  | "application"
  | "database"
  | "cache"
  | "queue"
  | "auth"
  | "infra"
  | "shared";

export const CATEGORY_LABEL: Record<ComponentCategory, string> = {
  client: "Client / Frontend",
  api: "API Gateway",
  application: "Application Logic",
  database: "Database",
  cache: "Cache",
  queue: "Message Queue",
  auth: "Auth",
  infra: "Infra / Config",
  shared: "Shared / Utils",
};

/** Rough left-to-right/top-to-bottom presentation order — not load-bearing (elkjs auto-lays-out regardless), just keeps node order stable and sensible. */
export const CATEGORY_ORDER: ComponentCategory[] = [
  "client",
  "api",
  "application",
  "auth",
  "database",
  "cache",
  "queue",
  "shared",
  "infra",
];

/**
 * File-path signals, most specific/reliable first — checked as whole words
 * against the repo-relative path (see `normalizePath`), so both directory
 * conventions (`models/user.ts`) and filename-suffix conventions
 * (`user.model.ts`, `UserController.java`) match the same rule. Keeping `\b`
 * word boundaries (rather than bare substring matching) matters for short,
 * generic keywords like `api`/`ui`/`dao` — without it they'd false-positive
 * inside unrelated words.
 */
const PATH_RULES: { pattern: RegExp; category: ComponentCategory }[] = [
  { pattern: /\b(models?|entit(y|ies)|schema|migrations?|repositor(y|ies)|dao|mongo|postgres|mysql|sqlite)\b/, category: "database" },
  { pattern: /\b(middlewares?|auth|guards?|session|jwt)\b/, category: "auth" },
  { pattern: /\b(cach(e|ing)|redis|memcached?)\b/, category: "cache" },
  { pattern: /\b(queues?|jobs?|workers?|consumers?|producers?|kafka|rabbitmq|sqs)\b/, category: "queue" },
  { pattern: /\b(controllers?|routes?|routing|endpoints?|api)\b/, category: "api" },
  { pattern: /\b(services?|usecases?|use-cases?|domain)\b/, category: "application" },
  { pattern: /\b(components?|pages?|views?|screens?|ui)\b/, category: "client" },
  { pattern: /\b(config|infra|deploy|docker|k8s|terraform)\b/, category: "infra" },
  { pattern: /\b(shared|common|utils?|helpers?|lib)\b/, category: "shared" },
];

/**
 * Lowercases a file path and inserts a delimiter at camelCase/PascalCase
 * word transitions (`UserController.java` → `user-controller.java`), so the
 * `\b` word-boundary regexes above correctly treat fused-word filenames
 * (extremely common: `UserController`, `userService`, `user.model`) the
 * same as delimited ones (`user/controller`, `user_service`).
 */
function normalizePath(filePath: string): string {
  return filePath.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Import-based fallback for files whose path gives no signal: a well-known
 * package name is strong evidence of what role the importing file plays,
 * even with an unconventional directory layout.
 */
const PACKAGE_CATEGORY: Record<string, ComponentCategory> = {
  // API/web frameworks
  express: "api",
  fastify: "api",
  koa: "api",
  hapi: "api",
  "@hapi/hapi": "api",
  "@nestjs/core": "api",
  "@nestjs/common": "api",
  flask: "api",
  django: "api",
  fastapi: "api",
  "org.springframework.web": "api",
  // Database/ORM
  prisma: "database",
  "@prisma/client": "database",
  typeorm: "database",
  sequelize: "database",
  mongoose: "database",
  knex: "database",
  sqlalchemy: "database",
  pymongo: "database",
  psycopg2: "database",
  mysql: "database",
  mysql2: "database",
  pg: "database",
  mongodb: "database",
  "org.hibernate": "database",
  "javax.persistence": "database",
  "jakarta.persistence": "database",
  // Cache
  redis: "cache",
  ioredis: "cache",
  memcached: "cache",
  // Queue
  kafkajs: "queue",
  amqplib: "queue",
  bullmq: "queue",
  bull: "queue",
  celery: "queue",
  // Auth
  passport: "auth",
  jsonwebtoken: "auth",
  "next-auth": "auth",
  bcrypt: "auth",
  // Frontend
  react: "client",
  "react-dom": "client",
  vue: "client",
  "@angular/core": "client",
  svelte: "client",
};

/**
 * Classifies one module into a ComponentCategory using its file path first
 * (the more reliable signal — directory/filename naming conventions are
 * very consistent across real-world repos), falling back to the packages
 * it imports, and finally defaulting to `application` (plain business
 * logic) if nothing matches.
 */
export function classifyModule(mod: ModuleIR): ComponentCategory {
  const path = normalizePath(mod.filePath);
  for (const rule of PATH_RULES) {
    if (rule.pattern.test(path)) return rule.category;
  }

  for (const imp of mod.imports) {
    const category = PACKAGE_CATEGORY[imp.to.toLowerCase()];
    if (category) return category;
  }

  return "application";
}
