"use client";

import dynamic from "next/dynamic";
import type { ExcalidrawScene } from "@git-to-uml/excalidraw-gen";

// The Excalidraw component touches `window` at import time, so it must be
// loaded client-side only (see design plan section 8).
const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, { ssr: false });

export function ExcalidrawCanvas({
  scene,
  height = "85vh",
  bordered = true,
}: {
  scene: ExcalidrawScene;
  height?: string;
  bordered?: boolean;
}) {
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
        initialData={{
          elements: scene.elements as never,
          appState: scene.appState,
        }}
      />
    </div>
  );
}
