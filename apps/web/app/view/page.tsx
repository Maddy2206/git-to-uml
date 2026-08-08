"use client";

import { useEffect, useState } from "react";
import { ExcalidrawCanvas } from "../../components/ExcalidrawCanvas";
import { loadSceneForFullScreen, type StoredScene } from "../../lib/sceneStorage";

/**
 * Full-screen, chrome-free rendering of the most recently generated
 * diagram — opened as a new tab from the home page's "Open Full Screen"
 * button (see lib/sceneStorage.ts for how the scene gets handed off).
 */
export default function ViewPage() {
  const [stored, setStored] = useState<StoredScene | null | undefined>(undefined);

  useEffect(() => {
    setStored(loadSceneForFullScreen());
  }, []);

  if (stored === undefined) return null; // avoid a flash before localStorage is read

  if (stored === null) {
    return (
      <main style={{ padding: 24 }}>
        <p>
          No diagram to show yet. Go back to <a href="/">git_to_uml</a>, generate one, then click
          &ldquo;Open Full Screen&rdquo;.
        </p>
      </main>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <ExcalidrawCanvas
        scene={stored.scene}
        height="100vh"
        bordered={false}
        filenameBase={`${stored.owner}-${stored.repo}-${stored.diagramKind}-diagram`}
      />
    </div>
  );
}
