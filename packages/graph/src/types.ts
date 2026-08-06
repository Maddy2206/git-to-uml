import type { EdgeKind } from "@git-to-uml/ir";

/**
 * A layout-agnostic diagram graph — the shared input to both the elkjs
 * layout stage and, eventually, the Excalidraw scene generator. Two builders
 * (classDiagramGraph, architectureGraph) produce this shape from one RepoIR.
 */
export interface DiagramNode {
  id: string;
  label: string;
  kind: "class" | "interface" | "enum" | "folder";
  /**
   * The exact lines the box header renders (e.g. `["«interface»", "Foo"]` or
   * just `["Foo"]` for a plain class) — computed once here so the layout
   * sizing pass and the Excalidraw renderer can never disagree about how
   * many header lines there are or how wide they are.
   */
  headerLines: string[];
  /** UML-style formatted compartment lines, pre-rendered as display strings (e.g. "+ name: string"). */
  compartments?: { fields: string[]; methods: string[] };
  /** Node ids nested inside this node (compound/hierarchical nodes, e.g. a folder containing modules). */
  children?: string[];
}

export interface DiagramEdgeView {
  id: string;
  kind: EdgeKind;
  from: string;
  to: string;
  label?: string;
}

export interface DiagramGraph {
  nodes: DiagramNode[];
  edges: DiagramEdgeView[];
}
