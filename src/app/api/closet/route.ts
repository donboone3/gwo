import { NextRequest, NextResponse } from "next/server";
import {
  addClosetItemAndGrantBonus,
  getActiveUser,
  getClosetItemsForUser,
} from "@/lib/db/repository";
import { computeUserQuotaStatus } from "@/lib/tryon/budget-guard";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getActiveUser("mila");
    const { item, bonusGranted } = await addClosetItemAndGrantBonus({
      userId: user.id,
      productId: String(body.productId),
      purchasedSize: String(body.purchasedSize || "S"),
      fitRating: body.fitRating || "true_to_size",
      reviewNote: String(body.reviewNote || "Love the fit & fabric!"),
      isPublic: body.isPublic !== false,
    });

    const refreshedUser = await getActiveUser("mila");
    const myCloset = await getClosetItemsForUser(user.id, true);

    return NextResponse.json({
      item,
      bonusGranted,
      myCloset,
      quota: computeUserQuotaStatus(refreshedUser),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Could not add item to closet." },
      { status: 400 }
    );
  }
}
