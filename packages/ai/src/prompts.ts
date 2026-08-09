import type { ClassIR, ModuleIR } from "@git-to-uml/ir";
import { CATEGORY_LABEL, type ComponentCategory } from "@git-to-uml/graph";

/** Compact, alias-keyed representation of a class for the relationships prompt — no source code, just already-extracted structure. */
export interface ClassPayload {
  alias: string;
  name: string;
  kind: string;
  fields: { name: string; type: string }[];
  methods: { name: string; params: string[]; returnType?: string }[];
  extends: string[];
  implements: string[];
}

/** Builds short `C1..Cn` aliases (position-based, order is otherwise irrelevant) so the model's JSON output stays compact and unambiguous rather than needing to reproduce real `filePath#ClassName` ids verbatim. */
export function buildClassAliases(classes: ClassIR[]): { aliasToId: Map<string, string>; payload: ClassPayload[] } {
  const aliasToId = new Map<string, string>();
  const payload: ClassPayload[] = classes.map((cls, i) => {
    const alias = `C${i + 1}`;
    aliasToId.set(alias, cls.id);
    return {
      alias,
      name: cls.name,
      kind: cls.kind,
      fields: cls.fields.filter((f) => f.type).map((f) => ({ name: f.name, type: f.type! })),
      methods: cls.methods.map((m) => ({
        name: m.name,
        params: m.params.filter((p) => p.type).map((p) => p.type!),
        returnType: m.returnType,
      })),
      extends: cls.extends ?? [],
      implements: cls.implements ?? [],
    };
  });
  return { aliasToId, payload };
}

export const RELATIONSHIPS_SYSTEM_PROMPT = `You are a senior software architect reviewing a codebase's class structure to build an accurate UML class diagram.

You will receive a JSON array of classes, each with an alias (e.g. "C1"), name, kind, fields (with types), methods (with parameter/return types), and their already-known extends/implements base types (for context only).

Identify which classes have a genuine COMPOSITION or AGGREGATION relationship with another class in the SAME list:
- "composes": this class owns/contains an instance of the other class as a field — the field's type IS or references the other class.
- "aggregates": this class merely USES/references the other class via a method parameter or return type, without owning it as a field.

Rules:
- Only report relationships between two classes that are BOTH present in the input (reference them by alias).
- Do NOT re-report extends/implements as composition/aggregation — those are already known and shown only for context, not to be repeated.
- Do NOT invent a relationship that isn't evidenced by an actual field, parameter, or return type in the input.
- Prefer precision over recall: when genuinely unsure, omit the relationship rather than guess.
- Respond with ONLY a JSON object, no prose, of exactly this shape:
{"relationships": [{"from": "C1", "to": "C2", "kind": "composes", "label": "optional short field name"}]}`;

export function buildRelationshipsUserPrompt(payload: ClassPayload[]): string {
  return `Classes (JSON):\n${JSON.stringify(payload)}\n\nRespond with the JSON object described in the system prompt.`;
}

/** Compact, alias-keyed representation of a module for the classification prompt. */
export interface ModulePayload {
  alias: string;
  filePath: string;
  imports: string[];
}

const MAX_IMPORTS_PER_MODULE = 8;

export function buildModuleAliases(modules: ModuleIR[]): { aliasToId: Map<string, string>; payload: ModulePayload[] } {
  const aliasToId = new Map<string, string>();
  const payload: ModulePayload[] = modules.map((mod, i) => {
    const alias = `M${i + 1}`;
    aliasToId.set(alias, mod.id);
    return {
      alias,
      filePath: mod.filePath,
      imports: mod.imports.slice(0, MAX_IMPORTS_PER_MODULE).map((imp) => imp.to),
    };
  });
  return { aliasToId, payload };
}

const CATEGORY_HINT: Record<ComponentCategory, string> = {
  client: "frontend UI — reusable components, views, screens (not the routing/page shells themselves — see \"pages\")",
  pages: "routing/page shells — Next.js (or similar framework) page/layout/template/route-group files that define what renders at a URL, as opposed to the reusable components they render",
  api: "API/HTTP layer — controllers, route handlers, endpoints, the API gateway itself",
  application: "business logic — services, use cases, domain logic that isn't a controller or data model",
  database: "data layer — models, entities, ORM schemas, migrations, repositories/DAOs",
  cache: "caching layer — Redis/Memcached clients and cache-management code",
  queue: "async messaging — message queues, background jobs/workers, event consumers/producers",
  auth: "authentication/authorization — middleware, guards, session/JWT handling",
  infra: "infrastructure/config — deployment, containerization, environment/config files",
  shared: "cross-cutting shared code — generic utilities/helpers used by multiple other layers",
};

function buildClassificationSystemPrompt(): string {
  const taxonomy = (Object.entries(CATEGORY_LABEL) as [ComponentCategory, string][])
    .map(([key, label]) => `- "${key}" (${label}): ${CATEGORY_HINT[key]}`)
    .join("\n");

  return `You are a senior software architect classifying files in a codebase into the handful of logical components you'd draw as boxes in a system-design interview.

You will receive a JSON array of modules, each with an alias (e.g. "M1"), its file path, and the specifiers it imports (relative paths to other repo files, or third-party package names).

Classify EVERY module into exactly one of these components:
${taxonomy}

Rules:
- Use the file path (directory/filename conventions) as your primary signal, and the imports (e.g. a module importing "express" is almost certainly "api"; "prisma" or "mongoose" is almost certainly "database") as a secondary signal.
- Default to "application" only when nothing else clearly fits — don't force a module into a more specific category without real evidence.
- Classify every module you're given; do not skip any.
- Respond with ONLY a JSON object, no prose, of exactly this shape:
{"classifications": [{"module": "M1", "category": "api"}]}`;
}

export const CLASSIFICATION_SYSTEM_PROMPT = buildClassificationSystemPrompt();

export function buildClassificationUserPrompt(payload: ModulePayload[]): string {
  return `Modules (JSON):\n${JSON.stringify(payload)}\n\nRespond with the JSON object described in the system prompt.`;
}
