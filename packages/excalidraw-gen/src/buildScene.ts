import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { LayoutResult } from "@git-to-uml/layout";
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
 * Turns an elkjs-laid-out class diagram into a full Excalidraw scene: one
 * grouped box (rectangle + divider lines + compartment text) per class/
 * interface/enum, one bound arrow per relationship edge, styled per UML
 * convention (see relationshipStyle.ts).
 */
export function buildClassDiagramScene(layout: LayoutResult): ExcalidrawScene {
  const elements: ExcalidrawElement[] = [];
  const rectangleById = new Map<string, ExcalidrawElement>();

  for (const node of layout.nodes) {
    const boxElements = classBoxSkeleton(node);
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
