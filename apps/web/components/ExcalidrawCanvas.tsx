"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawScene } from "@git-to-uml/excalidraw-gen";
import { downloadAsExcalidrawFile, downloadAsPng, downloadAsSvg } from "../lib/exportScene";

// The Excalidraw component touches `window` at import time, so it must be
// loaded client-side only (see design plan section 8).
const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, { ssr: false });

const buttonStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 12,
  border: "1px solid #ccc",
  borderRadius: 6,
  backgroundColor: "white",
  color: "#333",
  cursor: "pointer",
};

export function ExcalidrawCanvas({
  scene,
  height = "85vh",
  bordered = true,
  filenameBase = "diagram",
}: {
  scene: ExcalidrawScene;
  height?: string;
  bordered?: boolean;
  /** Base filename (no extension) used for the download buttons, e.g. "owner-repo-class-diagram". */
  filenameBase?: string;
}) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [exporting, setExporting] = useState<"svg" | "png" | null>(null);

  async function handleExport(kind: "excalidraw" | "svg" | "png") {
    if (!excalidrawAPI) return;
    try {
      if (kind === "excalidraw") {
        downloadAsExcalidrawFile(excalidrawAPI, filenameBase);
      } else if (kind === "svg") {
        setExporting("svg");
        await downloadAsSvg(excalidrawAPI, filenameBase);
      } else {
        setExporting("png");
        await downloadAsPng(excalidrawAPI, filenameBase);
      }
    } finally {
      setExporting(null);
    }
  }

  return (
    <div
      style={{
        height,
        width: "100%",
        border: bordered ? "1px solid #d0d0d0" : undefined,
        borderRadius: bordered ? 8 : undefined,
        overflow: "hidden",
      }}
    >
      <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
        initialData={{
          elements: scene.elements as never,
          appState: scene.appState,
        }}
        renderTopRightUI={() => (
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" style={buttonStyle} onClick={() => handleExport("excalidraw")} title="Download the raw scene — open it in the Excalidraw app">
              .excalidraw
            </button>
            <button type="button" style={buttonStyle} disabled={exporting === "svg"} onClick={() => handleExport("svg")}>
              {exporting === "svg" ? "Exporting…" : "SVG"}
            </button>
            <button type="button" style={buttonStyle} disabled={exporting === "png"} onClick={() => handleExport("png")}>
              {exporting === "png" ? "Exporting…" : "PNG"}
            </button>
          </div>
        )}
      />
    </div>
  );
}
