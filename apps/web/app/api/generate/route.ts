import { NextRequest, NextResponse } from "next/server";
import { generateDiagrams } from "@git-to-uml/pipeline";
import { parseGitHubUrl, RepoTooLargeError } from "@git-to-uml/ingest";

// Extends the serverless function timeout for larger repos. MVP is
// synchronous (see design plan section 9) — a job queue is a Phase 4
// addition once real repo-size/latency data justifies it.
export const maxDuration = 60;

interface GenerateRequestBody {
  repoUrl?: string;
  ref?: string;
  scopeToFolder?: string;
}

export async function POST(req: NextRequest) {
  let body: GenerateRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.repoUrl || typeof body.repoUrl !== "string") {
    return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
  }

  try {
    parseGitHubUrl(body.repoUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not a recognizable GitHub repo URL";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await generateDiagrams({
      repoUrl: body.repoUrl,
      ref: body.ref,
      scopeToFolder: body.scopeToFolder,
      githubToken: process.env.GITHUB_TOKEN,
      groqApiKey: process.env.GROQ_API_KEY,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RepoTooLargeError) {
      return NextResponse.json({ error: err.message }, { status: 413 });
    }
    const message = err instanceof Error ? err.message : "Unknown error generating diagrams";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
