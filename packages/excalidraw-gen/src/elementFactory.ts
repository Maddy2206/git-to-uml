import type {
  Arrowhead,
  ExcalidrawArrowElement,
  ExcalidrawLinearElement,
  ExcalidrawRectangleElement,
  ExcalidrawTextElement,
  FillStyle,
  StrokeStyle,
  TextAlign,
  VerticalAlign,
} from "@excalidraw/excalidraw/element/types";

/**
 * Hand-builds plain Excalidraw scene-element JSON objects, deliberately
 * *without* importing any runtime code from the `@excalidraw/excalidraw`
 * package (only `import type` above, which TypeScript fully erases). The
 * package's root entry point pulls in its whole React UI bundle — including
 * `.scss`/`.json` imports meant to be handled by a bundler's loaders — which
 * breaks when evaluated directly under plain Node (as this scene-generation
 * code is, in the API route / tests). The browser-side `<Excalidraw>`
 * component's own `restore()` step normalizes/fills any gaps in this JSON,
 * so hand-built objects are sufficient without going through the package's
 * `convertToExcalidrawElements` helper.
 *
 * These well-known numeric font family ids are part of Excalidraw's
 * serialized-scene format and are stable across versions (backward
 * compatibility guarantee) — see FONT_FAMILY in excalidraw's constants.ts.
 */
export const FONT_FAMILY = {
  Virgil: 1,
  Helvetica: 2,
  Cascadia: 3,
  Excalifont: 5,
  Nunito: 6,
} as const;

function randomInt(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

interface BaseOpts {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  groupIds?: string[];
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: FillStyle;
  strokeStyle?: StrokeStyle;
  roughness?: number;
  roundness?: ExcalidrawRectangleElement["roundness"];
}

function baseFields(opts: BaseOpts) {
  return {
    id: opts.id,
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    angle: 0,
    strokeColor: opts.strokeColor ?? "#1e1e1e",
    backgroundColor: opts.backgroundColor ?? "transparent",
    fillStyle: opts.fillStyle ?? "solid",
    strokeWidth: 2,
    strokeStyle: opts.strokeStyle ?? "solid",
    roundness: opts.roundness ?? null,
    roughness: opts.roughness ?? 1,
    opacity: 100,
    seed: randomInt(),
    version: 1,
    versionNonce: randomInt(),
    index: null,
    isDeleted: false,
    groupIds: opts.groupIds ?? [],
    frameId: null,
    boundElements: null as { id: string; type: "arrow" | "text" }[] | null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

export function makeRectangle(opts: BaseOpts): ExcalidrawRectangleElement {
  return { ...baseFields(opts), type: "rectangle" } as ExcalidrawRectangleElement;
}

export interface TextOpts extends Omit<BaseOpts, "height"> {
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign?: TextAlign;
  verticalAlign?: VerticalAlign;
  lineHeight?: number;
  height: number;
}

export function makeText(opts: TextOpts): ExcalidrawTextElement {
  return {
    ...baseFields(opts),
    type: "text",
    text: opts.text,
    originalText: opts.text,
    fontSize: opts.fontSize,
    fontFamily: opts.fontFamily as ExcalidrawTextElement["fontFamily"],
    textAlign: opts.textAlign ?? "left",
    verticalAlign: opts.verticalAlign ?? "top",
    containerId: null,
    autoResize: false,
    lineHeight: (opts.lineHeight ?? 1.25) as ExcalidrawTextElement["lineHeight"],
  } as ExcalidrawTextElement;
}

export interface LineOpts extends BaseOpts {
  points: [number, number][];
}

export function makeLine(opts: LineOpts): ExcalidrawLinearElement {
  return {
    ...baseFields(opts),
    type: "line",
    points: opts.points,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
  } as unknown as ExcalidrawLinearElement;
}

export interface ArrowOpts extends BaseOpts {
  points: [number, number][];
  startElementId: string;
  endElementId: string;
  startArrowhead: Arrowhead | null;
  endArrowhead: Arrowhead | null;
}

export function makeArrow(opts: ArrowOpts): ExcalidrawArrowElement {
  return {
    ...baseFields(opts),
    type: "arrow",
    elbowed: false,
    points: opts.points,
    lastCommittedPoint: null,
    startBinding: { elementId: opts.startElementId, focus: 0, gap: 4 },
    endBinding: { elementId: opts.endElementId, focus: 0, gap: 4 },
    startArrowhead: opts.startArrowhead,
    endArrowhead: opts.endArrowhead,
  } as unknown as ExcalidrawArrowElement;
}

/** Records that `boundElementId` (an arrow or bound text) is attached to `target`, matching Excalidraw's two-way binding invariant. */
export function addBoundElement(
  target: { boundElements: { id: string; type: "arrow" | "text" }[] | null },
  boundElementId: string,
  type: "arrow" | "text",
): void {
  if (!target.boundElements) target.boundElements = [];
  target.boundElements.push({ id: boundElementId, type });
}
