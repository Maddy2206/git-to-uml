import type { ExcalidrawArrowElement } from "@excalidraw/excalidraw/element/types";
import type { LayoutEdge } from "@git-to-uml/layout";
import { makeArrow } from "./elementFactory";
import { relationshipStyle } from "./relationshipStyle";

/**
 * Builds an arrow element from an elkjs-routed LayoutEdge. `startBinding`/
 * `endBinding` reference the class-box rectangle ids directly so the arrow
 * stays attached if the user drags a box in the interactive canvas
 * afterward, while the explicit `points` preserve elkjs's orthogonal routing.
 */
export function arrowSkeleton(edge: LayoutEdge): ExcalidrawArrowElement | null {
  if (edge.points.length < 2) return null;

  const style = relationshipStyle(edge.kind);
  const origin = edge.points[0];
  const points = edge.points.map((p) => [p.x - origin.x, p.y - origin.y] as [number, number]);
  const minX = Math.min(0, ...points.map((p) => p[0]));
  const maxX = Math.max(0, ...points.map((p) => p[0]));
  const minY = Math.min(0, ...points.map((p) => p[1]));
  const maxY = Math.max(0, ...points.map((p) => p[1]));

  return makeArrow({
    id: edge.id,
    x: origin.x,
    y: origin.y,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    points,
    startElementId: edge.from,
    endElementId: edge.to,
    startArrowhead: style.startArrowhead,
    endArrowhead: style.endArrowhead,
    strokeStyle: style.strokeStyle,
    strokeColor: style.strokeColor,
    roughness: 1,
  });
}
