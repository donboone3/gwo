import { NextRequest, NextResponse } from "next/server";
import {
  getActiveUser,
  getAllProducts,
  getClosetItemsForUser,
} from "@/lib/db/repository";
import { buildCuratedOutfits } from "@/lib/stylist/outfit-stylist";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getActiveUser("mila");
    const [products, myCloset] = await Promise.all([
      getAllProducts(),
      getClosetItemsForUser(user.id, true),
    ]);

    const outfits = buildCuratedOutfits(products, {
      occasion: body.occasion || "Coffee Run",
      maxBudget: Number(body.maxBudget || 250),
      maxDeliveryDays: Number(body.maxDeliveryDays || 5),
      storeFilter: body.storeFilter || "all",
      vibe: body.vibe || user.pinterestVibe,
      ownedProductIds: myCloset.map((c) => c.productId),
      includeClosetPieces: body.includeClosetPieces !== false,
    });

    return NextResponse.json({ outfits });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Could not generate outfits" },
      { status: 400 }
    );
  }
}
