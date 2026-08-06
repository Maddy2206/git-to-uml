import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { Octokit } from "@octokit/rest";
import fse from "fs-extra";
import { nanoid } from "nanoid";
import pTimeout from "p-timeout";
import * as tar from "tar";
import { parseGitHubUrl } from "./parseGitHubUrl";

export interface FetchRepoTarballOptions {
  /** A GitHub repo URL or `owner/repo` shorthand. */
  repoUrl: string;
  /** Branch, tag, or commit SHA. Defaults to the repo's default branch, or the ref embedded in a `/tree/<ref>` URL. */
  ref?: string;
  /** Server-side GitHub token (raises the unauthenticated 60/hr rate limit to 5000/hr). */
  githubToken?: string;
  /** Reject repos larger than this (GitHub's reported size is in KB). Default 150MB. */
  maxSizeKb?: number;
  timeoutMs?: number;
}

export interface FetchRepoTarballResult {
  /** Absolute path to the extracted repo root (tarball's own top-level folder is stripped). */
  dir: string;
  owner: string;
  repo: string;
  commitSha: string;
  ref: string;
  /** Always call this when done, even on error — removes the temp directory. */
  cleanup: () => Promise<void>;
}

const DEFAULT_MAX_SIZE_KB = 150_000; // ~150MB
const DEFAULT_TIMEOUT_MS = 60_000;

export class RepoTooLargeError extends Error {
  constructor(
    public readonly sizeKb: number,
    public readonly maxSizeKb: number,
  ) {
    super(`Repo is ${sizeKb}KB, which exceeds the ${maxSizeKb}KB limit for this tool.`);
    this.name = "RepoTooLargeError";
  }
}

/**
 * Fetches a public GitHub repo as a tarball (no git binary / clone needed)
 * and extracts it to a fresh temp directory. Always call the returned
 * `cleanup()` in a `finally` block.
 */
export async function fetchRepoTarball(options: FetchRepoTarballOptions): Promise<FetchRepoTarballResult> {
  const { owner, repo, ref: refFromUrl } = parseGitHubUrl(options.repoUrl);
  const maxSizeKb = options.maxSizeKb ?? DEFAULT_MAX_SIZE_KB;
  const octokit = new Octokit({ auth: options.githubToken ?? process.env.GITHUB_TOKEN });

  return pTimeout(
    (async () => {
      const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
      if (repoData.size > maxSizeKb) {
        throw new RepoTooLargeError(repoData.size, maxSizeKb);
      }
      const ref = options.ref ?? refFromUrl ?? repoData.default_branch;

      const { data: commitData } = await octokit.rest.repos.getCommit({ owner, repo, ref });
      const commitSha = commitData.sha;

      const tarballResponse = await octokit.rest.repos.downloadTarballArchive({ owner, repo, ref });
      const buffer = Buffer.from(tarballResponse.data as ArrayBuffer);

      const dir = path.join(os.tmpdir(), "git-to-uml", nanoid());
      await fse.ensureDir(dir);

      await new Promise<void>((resolve, reject) => {
        Readable.from(buffer)
          .pipe(tar.extract({ cwd: dir, strip: 1 }))
          .on("finish", resolve)
          .on("error", reject);
      });

      const cleanup = async () => {
        await fse.remove(dir);
      };

      return { dir, owner, repo, commitSha, ref, cleanup };
    })(),
    { milliseconds: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, message: `Fetching ${owner}/${repo} timed out` },
  );
}
