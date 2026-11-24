import { NextRequest, NextResponse } from "next/server";
import { runHiggsfieldStudioJob } from "@/lib/higgsfield/higgsfield-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await runHiggsfieldStudioJob({
      username: body.username || "mila",
      mode: body.mode === "orbit_360" ? "orbit_360" : "soul_tryon",
      modelImageUrl: String(body.modelImageUrl || ""),
      garmentImageUrl: body.garmentImageUrl ? String(body.garmentImageUrl) : undefined,
      prompt: body.prompt ? String(body.prompt) : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message || "Higgsfield studio error" },
      { status: 500 }
    );
  }
}
