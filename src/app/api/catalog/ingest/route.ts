import { NextRequest, NextResponse } from "next/server";
import { ingestProductUrlToSharedCatalog } from "@/lib/catalog/url-ingest";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = String(body.url || "").trim();
    if (!rawUrl) {
      return NextResponse.json(
        { error: "Please paste a valid store product URL." },
        { status: 400 }
      );
    }

    const result = await ingestProductUrlToSharedCatalog(
      rawUrl,
      body.username || "mila"
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Could not ingest store URL." },
      { status: 400 }
    );
  }
}
