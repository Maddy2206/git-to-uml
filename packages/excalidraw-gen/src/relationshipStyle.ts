import type { Arrowhead, StrokeStyle } from "@excalidraw/excalidraw/element/types";
import type { EdgeKind } from "@git-to-uml/ir";

export interface RelationshipStyle {
  startArrowhead: Arrowhead | null;
  endArrowhead: Arrowhead | null;
  strokeStyle: StrokeStyle;
  strokeColor: string;
}

const NEUTRAL = "#1e1e1e";
const IMPORT_COLOR = "#5c5f66";

/**
 * UML relationship kind -> Excalidraw arrowhead/stroke styling.
 * extends/implements both use a hollow triangle at the target end (the
 * dashed vs. solid line is the actual UML-spec differentiator between the
 * two, since both share the open-triangle head). Composition/aggregation
 * diamonds sit at the "whole" (from) end per UML convention, not the target.
 */
const STYLES: Record<EdgeKind, RelationshipStyle> = {
  extends: { startArrowhead: null, endArrowhead: "triangle_outline", strokeStyle: "solid", strokeColor: NEUTRAL },
  implements: { startArrowhead: null, endArrowhead: "triangle_outline", strokeStyle: "dashed", strokeColor: NEUTRAL },
  composes: { startArrowhead: "diamond", endArrowhead: null, strokeStyle: "solid", strokeColor: NEUTRAL },
  aggregates: { startArrowhead: "diamond_outline", endArrowhead: null, strokeStyle: "solid", strokeColor: NEUTRAL },
  imports: { startArrowhead: null, endArrowhead: "arrow", strokeStyle: "dashed", strokeColor: IMPORT_COLOR },
  calls: { startArrowhead: null, endArrowhead: "arrow", strokeStyle: "dotted", strokeColor: IMPORT_COLOR },
};

export function relationshipStyle(kind: EdgeKind): RelationshipStyle {
  return STYLES[kind];
}
