import { describe, expect, it } from "vitest";
import type { DiagramNode } from "@git-to-uml/graph";
import { estimateClassBoxSize, headerBlockHeight } from "./nodeSize";

describe("headerBlockHeight", () => {
  it("reserves more height for a 2-line stereotyped header than a 1-line plain one", () => {
    expect(headerBlockHeight(2)).toBeGreaterThan(headerBlockHeight(1));
  });
});

describe("estimateClassBoxSize", () => {
  it("sizes a wide interface header (stereotype + name) wide enough to fit both lines", () => {
    const node: DiagramNode = {
      id: "1",
      label: "IVeryLongInterfaceNameThatIsQuiteWide",
      kind: "interface",
      headerLines: ["«interface»", "IVeryLongInterfaceNameThatIsQuiteWide"],
      compartments: { fields: [], methods: [] },
    };
    const size = estimateClassBoxSize(node);
    // Width must be driven by the longer of the two header lines, not just the class name.
    expect(size.width).toBeGreaterThan(node.label.length * 8);
  });

  it("reserves enough height for every field/method line at the real rendered line-height, not an under-estimate", () => {
    const node: DiagramNode = {
      id: "2",
      label: "Widget",
      kind: "class",
      headerLines: ["Widget"],
      compartments: { fields: ["- a: string", "- b: string", "- c: string"], methods: ["+ run(): void"] },
    };
    const size = estimateClassBoxSize(node);
    // header + 2 compartment paddings + 4 body lines, each with real (not 1.25x) line-height headroom.
    expect(size.height).toBeGreaterThan(headerBlockHeight(1) + 4 * 13 * 1.35);
  });
});
