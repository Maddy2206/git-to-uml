import { nanoid } from "nanoid";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { LayoutNode } from "@git-to-uml/layout";
import {
  BODY_FONT_SIZE,
  COMPARTMENT_PADDING,
  HEADER_FONT_SIZE,
  LINE_HEIGHT,
  LINE_HEIGHT_MULTIPLIER,
  headerBlockHeight,
} from "@git-to-uml/layout";
import { FONT_FAMILY, makeLine, makeRectangle, makeText } from "./elementFactory";

const STROKE_COLOR = "#1e1e1e";
const LEFT_PADDING = 10;

const KIND_FILL: Record<LayoutNode["kind"], string> = {
  class: "#a5d8ff",
  interface: "#b2f2bb",
  enum: "#ffec99",
  folder: "#e9ecef",
  component: "#d0bfff",
  hook: "#ffc9c9",
  handler: "#99e9f2",
  function: "#ced4da",
};

/**
 * Builds the grouped elements (outer rectangle, divider lines, header /
 * fields / methods text blocks) for one UML class box, positioned per the
 * elkjs-computed LayoutNode geometry. All pieces share one groupIds entry so
 * the whole box drags as a unit in the interactive canvas.
 *
 * Sizing (header line count, per-line width/height) is computed once in
 * @git-to-uml/layout's nodeSize.ts and consumed identically here and by the
 * elkjs layout pass, so the box a class was laid out into and the box its
 * text is drawn into can never drift apart.
 */
export function classBoxSkeleton(node: LayoutNode): ExcalidrawElement[] {
  const groupId = `group-${node.id}-${nanoid(6)}`;
  const groupIds = [groupId];
  const fields = node.compartments?.fields ?? [];
  const methods = node.compartments?.methods ?? [];
  const elements: ExcalidrawElement[] = [];

  elements.push(
    makeRectangle({
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      groupIds,
      strokeColor: STROKE_COLOR,
      backgroundColor: KIND_FILL[node.kind],
      fillStyle: "solid",
      roughness: 1,
      roundness: null,
    }),
  );

  const headerHeight = headerBlockHeight(node.headerLines.length);
  elements.push(
    makeText({
      id: `${node.id}-header`,
      x: node.x,
      y: node.y + (headerHeight - node.headerLines.length * HEADER_FONT_SIZE * LINE_HEIGHT_MULTIPLIER) / 2,
      width: node.width,
      height: node.headerLines.length * HEADER_FONT_SIZE * LINE_HEIGHT_MULTIPLIER,
      text: node.headerLines.join("\n"),
      fontSize: HEADER_FONT_SIZE,
      fontFamily: FONT_FAMILY.Excalifont,
      textAlign: "center",
      verticalAlign: "top",
      lineHeight: LINE_HEIGHT_MULTIPLIER,
      groupIds,
      strokeColor: STROKE_COLOR,
    }),
  );

  let cursorY = node.y + headerHeight;

  if (fields.length > 0) {
    elements.push(dividerLine(node.id, groupIds, node.x, cursorY, node.width));
    const blockHeight = fields.length * LINE_HEIGHT;
    elements.push(
      makeText({
        id: `${node.id}-fields`,
        x: node.x + LEFT_PADDING,
        y: cursorY + COMPARTMENT_PADDING / 2,
        width: node.width - LEFT_PADDING * 2,
        height: blockHeight,
        text: fields.join("\n"),
        fontSize: BODY_FONT_SIZE,
        fontFamily: FONT_FAMILY.Cascadia,
        textAlign: "left",
        verticalAlign: "top",
        lineHeight: LINE_HEIGHT_MULTIPLIER,
        groupIds,
        strokeColor: STROKE_COLOR,
      }),
    );
    cursorY += COMPARTMENT_PADDING + blockHeight;
  }

  if (methods.length > 0) {
    elements.push(dividerLine(node.id, groupIds, node.x, cursorY, node.width));
    const blockHeight = methods.length * LINE_HEIGHT;
    elements.push(
      makeText({
        id: `${node.id}-methods`,
        x: node.x + LEFT_PADDING,
        y: cursorY + COMPARTMENT_PADDING / 2,
        width: node.width - LEFT_PADDING * 2,
        height: blockHeight,
        text: methods.join("\n"),
        fontSize: BODY_FONT_SIZE,
        fontFamily: FONT_FAMILY.Cascadia,
        textAlign: "left",
        verticalAlign: "top",
        lineHeight: LINE_HEIGHT_MULTIPLIER,
        groupIds,
        strokeColor: STROKE_COLOR,
      }),
    );
  }

  return elements;
}

function dividerLine(nodeId: string, groupIds: string[], x: number, y: number, width: number): ExcalidrawElement {
  return makeLine({
    id: `${nodeId}-divider-${Math.round(y)}`,
    x,
    y,
    width,
    height: 0,
    points: [
      [0, 0],
      [width, 0],
    ],
    groupIds,
    strokeColor: STROKE_COLOR,
    roughness: 1,
  });
}
