import { buildRepoIR } from "@git-to-uml/ir";
import { parseTypeScriptProject } from "@git-to-uml/parser-ts";
import { parsePythonProject } from "@git-to-uml/parser-python";
import { parseJavaProject } from "@git-to-uml/parser-java";
import { buildArchitectureGraph, buildClassDiagramGraph } from "@git-to-uml/graph";
import { layoutArchitecture, layoutClassDiagram } from "@git-to-uml/layout";
import { buildArchitectureDiagramScene, buildClassDiagramScene, type ExcalidrawScene } from "@git-to-uml/excalidraw-gen";

export interface GenerateDiagramsFromDirOptions {
  repoUrl: string;
  commitSha: string;
  /** Only include classes whose filePath starts with this folder prefix. Applies to the class diagram only — the architecture diagram always covers the whole repo. */
  scopeToFolder?: string;
}

export interface DiagramStats {
  fileCount: number;
  classCount: number;
  edgeCount: number;
  /** Number of distinct logical components (API/database/cache/...) detected — see architectureGraph.ts. */
  componentCount: number;
}

export interface GenerateDiagramsResult {
  repoUrl: string;
  commitSha: string;
  classDiagram: ExcalidrawScene;
  architectureDiagram: ExcalidrawScene;
  stats: DiagramStats;
}

/**
 * Network-free core of the pipeline: parse -> IR -> both diagram graphs ->
 * elkjs layout -> Excalidraw scenes, given an already-extracted repo
 * directory. Split out from `generateDiagrams` (which adds GitHub tarball
 * fetching) so it can be exercised in tests against local fixture
 * directories without depending on live external repos.
 */
export async function generateDiagramsFromDir(
  dir: string,
  options: GenerateDiagramsFromDirOptions,
): Promise<GenerateDiagramsResult> {
  // Each language parser does its own file discovery and returns [] if none
  // of its extensions are present in the repo — safe (and cheap: the
  // tree-sitter grammar for a language with zero matching files is never
  // even loaded) to run all three unconditionally, whatever mix of
  // languages this particular repo actually uses. Files are merged into one
  // RepoIR; cross-language relationships (e.g. a Python class referencing a
  // Java class) are not resolved — see the design plan's documented limitation.
  const [tsFiles, pythonFiles, javaFiles] = await Promise.all([
    Promise.resolve(parseTypeScriptProject(dir)),
    parsePythonProject(dir),
    parseJavaProject(dir),
  ]);
  const files = [...tsFiles, ...pythonFiles, ...javaFiles];
  const repoIR = buildRepoIR({ repoUrl: options.repoUrl, commitSha: options.commitSha, files });

  const classGraph = buildClassDiagramGraph(repoIR, { scopeToFolder: options.scopeToFolder });
  const classLayout = await layoutClassDiagram(classGraph);
  const classDiagram = buildClassDiagramScene(classLayout);

  const architectureGraph = buildArchitectureGraph(repoIR);
  const architectureLayout = await layoutArchitecture(architectureGraph);
  const architectureDiagram = buildArchitectureDiagramScene(architectureLayout);

  return {
    repoUrl: options.repoUrl,
    commitSha: options.commitSha,
    classDiagram,
    architectureDiagram,
    stats: {
      fileCount: Object.keys(repoIR.modules).length,
      classCount: Object.keys(repoIR.classes).length,
      edgeCount: repoIR.edges.length,
      componentCount: architectureGraph.nodes.length,
    },
  };
}
