import { describe, expect, it } from "vitest";
import { parseGitHubUrl } from "./parseGitHubUrl";

describe("parseGitHubUrl", () => {
  it("parses a plain https URL", () => {
    expect(parseGitHubUrl("https://github.com/facebook/react")).toEqual({
      owner: "facebook",
      repo: "react",
      ref: undefined,
    });
  });

  it("parses a URL with a trailing .git", () => {
    expect(parseGitHubUrl("https://github.com/facebook/react.git")).toEqual({
      owner: "facebook",
      repo: "react",
      ref: undefined,
    });
  });

  it("parses a URL with a /tree/<ref> suffix", () => {
    expect(parseGitHubUrl("https://github.com/facebook/react/tree/main")).toEqual({
      owner: "facebook",
      repo: "react",
      ref: "main",
    });
  });

  it("parses owner/repo shorthand", () => {
    expect(parseGitHubUrl("facebook/react")).toEqual({ owner: "facebook", repo: "react", ref: undefined });
  });

  it("throws on an unrecognizable input", () => {
    expect(() => parseGitHubUrl("not a url at all!!")).toThrow();
  });
});
