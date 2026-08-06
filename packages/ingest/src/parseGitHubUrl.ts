export interface ParsedGitHubRepo {
  owner: string;
  repo: string;
  /** Branch, tag, or commit SHA explicitly present in the URL, if any (e.g. from a /tree/<ref> path). */
  ref?: string;
}

const GITHUB_URL_PATTERNS = [
  // https://github.com/owner/repo(.git)?(/tree/<ref>)?
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+))?\/?$/,
  // owner/repo shorthand
  /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/,
];

/** Parses a GitHub repo URL (or `owner/repo` shorthand) into {owner, repo, ref?}. Throws on anything else. */
export function parseGitHubUrl(input: string): ParsedGitHubRepo {
  const trimmed = input.trim();
  for (const pattern of GITHUB_URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const [, owner, repo, ref] = match;
      return { owner, repo, ref: ref || undefined };
    }
  }
  throw new Error(`Not a recognizable GitHub repo URL: "${input}"`);
}
