import { z } from "zod";
import { CATEGORY_ORDER, type ComponentCategory } from "@git-to-uml/graph";

// Derived from the single source of truth (CATEGORY_ORDER) rather than a
// hand-duplicated string list, so this can never drift from the real
// ComponentCategory union.
export const ComponentCategorySchema = z.enum(CATEGORY_ORDER as unknown as [ComponentCategory, ...ComponentCategory[]]);

export const RelationshipsResponseSchema = z.object({
  relationships: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      kind: z.enum(["composes", "aggregates"]),
      label: z.string().optional(),
    }),
  ),
});
export type RelationshipsResponse = z.infer<typeof RelationshipsResponseSchema>;

export const ClassificationsResponseSchema = z.object({
  classifications: z.array(
    z.object({
      module: z.string(),
      category: ComponentCategorySchema,
    }),
  ),
});
export type ClassificationsResponse = z.infer<typeof ClassificationsResponseSchema>;
