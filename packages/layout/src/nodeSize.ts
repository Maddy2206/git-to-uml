import type { DiagramNode } from "@git-to-uml/graph";

/**
 * Font/layout constants shared between this sizing estimate and the
 * Excalidraw renderer (packages/excalidraw-gen/src/classBoxSkeleton.ts) —
 * both import these from here so the box a class is laid out into and the
 * box its text is actually drawn into can never disagree (that mismatch was
 * exactly what caused text to overflow/underflow the box: excalidraw-gen
 * used to default `lineHeight` to 1.25 while this file assumed a much
 * larger per-line pixel height, and the header height was a flat constant
 * that didn't account for the 2-line "«interface»\nFoo" stereotype header).
 *
 * There's still no real text-measurement API available server-side, so
 * character width is an estimate (`*_CHAR_WIDTH_RATIO`, in em) rather than a
 * true measurement — tuned generously so the rare miss errs on a slightly
 * roomier box (harmless) rather than a clipped one (broken).
 */
export const HEADER_FONT_SIZE = 16;
export const BODY_FONT_SIZE = 13;
/** Unitless line-height, in the same units as Excalidraw's `TextElement.lineHeight` — pass this straight through when constructing text elements. */
export const LINE_HEIGHT_MULTIPLIER = 1.35;
/** Average character advance width, as a fraction of font size (em). Both the hand-drawn header font and the monospace body font land close enough to the same ratio to share one constant. */
const CHAR_WIDTH_RATIO = 0.62;

export const HEADER_LINE_HEIGHT = Math.ceil(HEADER_FONT_SIZE * LINE_HEIGHT_MULTIPLIER);
export const LINE_HEIGHT = Math.ceil(BODY_FONT_SIZE * LINE_HEIGHT_MULTIPLIER);
export const HEADER_VERTICAL_PADDING = 12;
export const COMPARTMENT_PADDING = 14;
export const HORIZONTAL_PADDING = 32;
export const MIN_WIDTH = 180;
export const MIN_HEIGHT = 60;

export interface BoxSize {
  width: number;
  height: number;
}

function textWidthPx(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_WIDTH_RATIO;
}

function longestLineWidth(lines: string[], fontSize: number): number {
  return lines.reduce((max, line) => Math.max(max, textWidthPx(line, fontSize)), 0);
}

/** Pixel height of the header block for a box with `lineCount` header lines (1 for a plain class, 2 for "«interface»\nFoo"-style stereotyped headers). */
export function headerBlockHeight(lineCount: number): number {
  return lineCount * HEADER_LINE_HEIGHT + HEADER_VERTICAL_PADDING;
}

/** Estimated size of a UML class box, sized to fit its header, longest compartment line, and member count. */
export function estimateClassBoxSize(node: DiagramNode): BoxSize {
  const fields = node.compartments?.fields ?? [];
  const methods = node.compartments?.methods ?? [];

  const headerWidth = longestLineWidth(node.headerLines, HEADER_FONT_SIZE);
  const bodyWidth = Math.max(longestLineWidth(fields, BODY_FONT_SIZE), longestLineWidth(methods, BODY_FONT_SIZE));
  const width = Math.max(MIN_WIDTH, headerWidth + HORIZONTAL_PADDING, bodyWidth + HORIZONTAL_PADDING);

  let height = headerBlockHeight(node.headerLines.length);
  if (fields.length > 0) height += COMPARTMENT_PADDING + fields.length * LINE_HEIGHT;
  if (methods.length > 0) height += COMPARTMENT_PADDING + methods.length * LINE_HEIGHT;

  return { width, height: Math.max(MIN_HEIGHT, height) };
}

/** Estimated size of a plain folder/module box for the architecture diagram. */
export function estimateFolderBoxSize(node: DiagramNode): BoxSize {
  const width = Math.max(MIN_WIDTH, textWidthPx(node.label, HEADER_FONT_SIZE) + HORIZONTAL_PADDING);
  return { width, height: 48 };
}
