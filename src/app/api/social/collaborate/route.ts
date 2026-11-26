import { execFile } from "child_process";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { parseSocialProfileUrl } from "@/lib/social/social-style-dna";

const execFileAsync = promisify(execFile);

async function searchPublicSocialSnippets(query: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query, limit: 4 }),
        signal: AbortSignal.timeout(7500),
      });
      if (res.ok) {
        const j = await res.json();
        const arr = (j?.data?.web || j?.data || []) as Array<
          Record<string, unknown>
        >;
        return arr
          .map((x) => `${x.title || ""} ${x.description || ""}`)
          .join(" ");
      }
    } catch {
      // Fall through to CLI
    }
  }

  try {
    const isWin = process.platform === "win32";
    const cmd = isWin ? "cmd.exe" : "firecrawl";
    const args = isWin
      ? ["/d", "/s", "/c", "firecrawl", "search", query, "--limit", "4", "--json"]
      : ["search", query, "--limit", "4", "--json"];
    const { stdout } = await execFileAsync(cmd, args, {
      timeout: 8000,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, FIRECRAWL_NO_SEARCH_FEEDBACK: "1" },
    });
    const idx = stdout.indexOf("{");
    if (idx !== -1) {
      const parsed = JSON.parse(stdout.slice(idx));
      const web = (parsed?.data?.web || []) as Array<Record<string, unknown>>;
      return web
        .map((x) => `${x.title || ""} ${x.description || ""}`)
        .join(" ");
    }
  } catch {
    // Return empty if offline
  }

  return "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = String(body.url || "").trim();
    if (!rawUrl) {
      return NextResponse.json({ error: "Missing social URL" }, { status: 400 });
    }

    const parsed = parseSocialProfileUrl(rawUrl);
    const searchQuery =
      parsed.platform === "pinterest"
        ? `site:pinterest.com "${parsed.boardSlug || parsed.handle}" fashion outfit style`
        : `"${parsed.handle}" ${parsed.platform} fashion outfit style aesthetic`;

    const publicSnippet = await searchPublicSocialSnippets(searchQuery);
    const combined = `${parsed.inferredKeywords} ${publicSnippet}`.trim();

    return NextResponse.json({
      platform: parsed.platform,
      handle: parsed.handle,
      boardTitle: parsed.boardTitle,
      extractedKeywords:
        combined.slice(0, 260) ||
        parsed.inferredKeywords ||
        "#modeloffduty #tailored #datenight",
      suggestedGlam: parsed.suggestedGlam,
      suggestedEdge: parsed.suggestedEdge,
      suggestedPalette: parsed.suggestedPalette,
      liveIndexed: publicSnippet.length > 15,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Social sync failed" },
      { status: 400 }
    );
  }
}
