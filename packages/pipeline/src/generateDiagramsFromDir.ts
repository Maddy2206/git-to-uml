import { buildRepoIR } from "@git-to-uml/ir";
import { parseTypeScriptProject } from "@git-to-uml/parser-ts";
import { buildClassDiagramGraph } from "@git-to-uml/graph";
import { layoutClassDiagram } from "@git-to-uml/layout";
import { buildClassDiagramScene, type ExcalidrawScene } from "@git-to-uml/excalidraw-gen";

export interface GenerateDiagramsFromDirOptions {
  repoUrl: string;
  commitSha: string;
  /** Only include classes whose filePath starts with this folder prefix. */
  scopeToFolder?: string;
}

export interface DiagramStats {
  fileCount: number;
  classCount: number;
  edgeCount: number;
}

export interface GenerateDiagramsResult {
  repoUrl: string;
  commitSha: string;
  classDiagram: ExcalidrawScene;
  stats: DiagramStats;
}

/**
 * Network-free core of the pipeline: parse -> IR -> class-diagram graph ->
 * elkjs layout -> Excalidraw scene, given an already-extracted repo
 * directory. Split out from `generateDiagrams` (which adds GitHub tarball
 * fetching) so it can be exercised in tests against local fixture
 * directories without depending on live external repos.
 */
export async function generateDiagramsFromDir(
  dir: string,
  options: GenerateDiagramsFromDirOptions,
): Promise<GenerateDiagramsResult> {
  const files = parseTypeScriptProject(dir);
  const repoIR = buildRepoIR({ repoUrl: options.repoUrl, commitSha: options.commitSha, files });
  const graph = buildClassDiagramGraph(repoIR, { scopeToFolder: options.scopeToFolder });
  const layout = await layoutClassDiagram(graph);
  const classDiagram = buildClassDiagramScene(layout);

  return {
    repoUrl: options.repoUrl,
    commitSha: options.commitSha,
    classDiagram,
    stats: {
      fileCount: Object.keys(repoIR.modules).length,
      classCount: Object.keys(repoIR.classes).length,
      edgeCount: repoIR.edges.length,
    },
  };
}
