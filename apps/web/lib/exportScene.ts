import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Export helpers, called from click handlers (guaranteed to run in the
 * browser). `@excalidraw/excalidraw`'s export utilities are dynamically
 * imported here rather than statically at module scope — same reasoning as
 * dynamically loading the `<Excalidraw>` component itself in
 * ExcalidrawCanvas.tsx: the package can have browser-only top-level side
 * effects that break if evaluated during SSR.
 */

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** The live scene, JSON-serialized exactly as a standalone `.excalidraw` file — openable in the real Excalidraw app. */
export function downloadAsExcalidrawFile(api: ExcalidrawImperativeAPI, filenameBase: string): void {
  const scene = {
    type: "excalidraw",
    version: 2,
    source: "git-to-uml",
    elements: api.getSceneElements(),
    appState: api.getAppState(),
    files: api.getFiles(),
  };
  const blob = new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" });
  triggerDownload(blob, `${filenameBase}.excalidraw`);
}

export async function downloadAsSvg(api: ExcalidrawImperativeAPI, filenameBase: string): Promise<void> {
  const { exportToSvg } = await import("@excalidraw/excalidraw");
  const svg = await exportToSvg({
    elements: api.getSceneElements(),
    appState: api.getAppState(),
    files: api.getFiles(),
  });
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
  triggerDownload(blob, `${filenameBase}.svg`);
}

export async function downloadAsPng(api: ExcalidrawImperativeAPI, filenameBase: string): Promise<void> {
  const { exportToBlob } = await import("@excalidraw/excalidraw");
  const blob = await exportToBlob({
    elements: api.getSceneElements(),
    appState: api.getAppState(),
    files: api.getFiles(),
    mimeType: "image/png",
  });
  triggerDownload(blob, `${filenameBase}.png`);
}
