import type { ExcalidrawScene } from "@git-to-uml/excalidraw-gen";

/**
 * Hands a generated diagram off to the full-screen `/view` tab via
 * localStorage (shared across all same-origin tabs, unlike sessionStorage,
 * which only reliably carries over to `window.open`-created tabs at the
 * moment they're created). Scene JSON for even a large repo (hundreds of
 * classes) is a few MB at most, comfortably inside localStorage's ~5-10MB
 * per-origin quota — this is a client-side handoff only, nothing is sent
 * anywhere.
 */
const STORAGE_KEY = "git-to-uml:scene";

export interface StoredScene {
  owner: string;
  repo: string;
  ref: string;
  scene: ExcalidrawScene;
}

export function saveSceneForFullScreen(data: StoredScene): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadSceneForFullScreen(): StoredScene | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredScene;
  } catch {
    return null;
  }
}
