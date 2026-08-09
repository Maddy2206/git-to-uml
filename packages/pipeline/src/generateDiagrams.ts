import { fetchRepoTarball } from "@git-to-uml/ingest";
import { generateDiagramsFromDir, type GenerateDiagramsResult } from "./generateDiagramsFromDir";

export interface GenerateDiagramsOptions {
  /** A GitHub repo URL or `owner/repo` shorthand. */
  repoUrl: string;
  /** Branch, tag, or commit SHA. Defaults to the repo's default branch. */
  ref?: string;
  githubToken?: string;
  /** Only include classes whose filePath starts with this folder prefix. */
  scopeToFolder?: string;
  /** Optional — enables Groq-reasoned relationships/component classification. Falls back to the existing heuristics when omitted or unavailable. */
  groqApiKey?: string;
}

export interface GenerateDiagramsFullResult extends GenerateDiagramsResult {
  owner: string;
  repo: string;
  ref: string;
}

/**
 * The full pipeline: fetch the repo tarball -> parse -> IR -> class-diagram
 * graph -> elkjs layout -> Excalidraw scene. A pure function of `repoUrl`,
 * decoupled from how it's invoked (sync API route today; a job queue can be
 * swapped in later — see the design plan — without changing this function).
 */
export async function generateDiagrams(options: GenerateDiagramsOptions): Promise<GenerateDiagramsFullResult> {
  const { dir, owner, repo, commitSha, ref, cleanup } = await fetchRepoTarball({
    repoUrl: options.repoUrl,
    ref: options.ref,
    githubToken: options.githubToken,
  });

  try {
    const result = await generateDiagramsFromDir(dir, {
      repoUrl: options.repoUrl,
      commitSha,
      scopeToFolder: options.scopeToFolder,
      groqApiKey: options.groqApiKey,
    });
    return { ...result, owner, repo, ref };
  } finally {
    await cleanup();
  }
}
