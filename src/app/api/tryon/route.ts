import { NextRequest, NextResponse } from "next/server";
import { executeVirtualTryOn } from "@/lib/tryon/vton-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const productIds = Array.isArray(body.productIds)
      ? body.productIds.map(String)
      : [];
    const result = await executeVirtualTryOn({
      username: body.username || "mila",
      productIds,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Try-on failed" },
      { status: 500 }
    );
  }
}
