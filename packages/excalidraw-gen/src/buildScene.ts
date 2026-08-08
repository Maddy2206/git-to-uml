import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { LayoutNode, LayoutResult } from "@git-to-uml/layout";
import { classBoxSkeleton } from "./classBoxSkeleton";
import { arrowSkeleton } from "./arrowSkeleton";
import { addBoundElement } from "./elementFactory";

/** Matches the standalone `.excalidraw` file format, and doubles as the `initialData` shape for the `<Excalidraw>` component. */
export interface ExcalidrawScene {
  type: "excalidraw";
  version: 2;
  source: "git-to-uml";
  elements: ExcalidrawElement[];
  appState: { viewBackgroundColor: string };
  files: Record<string, never>;
}

/**
 * Shared assembly behind both scene builders below: place a box per node,
 * an arrow per edge, and wire up the two-way `boundElements` binding
 * between each arrow and the boxes it connects.
 */
function buildSceneFromLayout(layout: LayoutResult, boxSkeleton: (node: LayoutNode) => ExcalidrawElement[]): ExcalidrawScene {
  const elements: ExcalidrawElement[] = [];
  const rectangleById = new Map<string, ExcalidrawElement>();

  for (const node of layout.nodes) {
    const boxElements = boxSkeleton(node);
    elements.push(...boxElements);
    rectangleById.set(node.id, boxElements[0]); // rectangle is always pushed first
  }

  for (const edge of layout.edges) {
    const arrow = arrowSkeleton(edge);
    if (!arrow) continue;
    elements.push(arrow);

    const startRect = rectangleById.get(edge.from);
    const endRect = rectangleById.get(edge.to);
    if (startRect) addBoundElement(startRect as any, arrow.id, "arrow");
    if (endRect) addBoundElement(endRect as any, arrow.id, "arrow");
  }

  return {
    type: "excalidraw",
    version: 2,
    source: "git-to-uml",
    elements,
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  };
}

/**
 * Turns an elkjs-laid-out class diagram into a full Excalidraw scene: one
 * grouped box (rectangle + divider lines + compartment text) per class/
 * interface/enum, one bound arrow per relationship edge, styled per UML
 * convention (see relationshipStyle.ts).
 */
export function buildClassDiagramScene(layout: LayoutResult): ExcalidrawScene {
  return buildSceneFromLayout(layout, classBoxSkeleton);
}

/**
 * Turns an elkjs-laid-out system-architecture graph into a full Excalidraw
 * scene: one box per logical component (API gateway, database, cache, ...),
 * each optionally listing representative class/entity names as a
 * compartment (see architectureGraph.ts), one dashed arrow per aggregated
 * import relationship between components. Reuses classBoxSkeleton — with no
 * fields/methods it renders identically to a plain labeled box; with them,
 * the compartment shows up the same way a UML class's fields do.
 */
export function buildArchitectureDiagramScene(layout: LayoutResult): ExcalidrawScene {
  return buildSceneFromLayout(layout, classBoxSkeleton);
}
