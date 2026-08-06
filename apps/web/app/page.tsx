"use client";

import { useState, type FormEvent } from "react";
import type { ExcalidrawScene } from "@git-to-uml/excalidraw-gen";
import { ExcalidrawCanvas } from "../components/ExcalidrawCanvas";
import { saveSceneForFullScreen } from "../lib/sceneStorage";

interface GenerateApiResult {
  owner: string;
  repo: string;
  ref: string;
  commitSha: string;
  classDiagram: ExcalidrawScene;
  stats: { fileCount: number; classCount: number; edgeCount: number };
}

export default function HomePage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateApiResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate diagram");
      setResult(data as GenerateApiResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenFullScreen() {
    if (!result) return;
    saveSceneForFullScreen({ owner: result.owner, repo: result.repo, ref: result.ref, scene: result.classDiagram });
    window.open("/view", "_blank");
  }

  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 1400, margin: "0 auto" }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>git_to_uml</h1>
        <p style={{ color: "#555", margin: 0 }}>
          Paste a public GitHub repo URL to generate a UML class diagram, rendered as an interactive, editable
          Excalidraw canvas.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          required
          style={{ flex: 1, padding: "10px 12px", fontSize: 14, border: "1px solid #ccc", borderRadius: 6 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 20px",
            fontSize: 14,
            border: "none",
            borderRadius: 6,
            backgroundColor: "#1971c2",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Generating…" : "Generate"}
        </button>
      </form>

      {error && (
        <p style={{ color: "#c92a2a", background: "#fff5f5", padding: 12, borderRadius: 6 }}>{error}</p>
      )}

      {result && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <p style={{ color: "#555", margin: 0 }}>
              <strong>
                {result.owner}/{result.repo}
              </strong>{" "}
              @ {result.ref} ({result.commitSha.slice(0, 7)}) — {result.stats.classCount} classes,{" "}
              {result.stats.fileCount} files, {result.stats.edgeCount} relationships
            </p>
            <button
              type="button"
              onClick={handleOpenFullScreen}
              style={{
                padding: "8px 16px",
                fontSize: 14,
                border: "1px solid #1971c2",
                borderRadius: 6,
                backgroundColor: "white",
                color: "#1971c2",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Open Full Screen ↗
            </button>
          </div>
          <ExcalidrawCanvas scene={result.classDiagram} />
        </>
      )}
    </main>
  );
}
