import { NextRequest, NextResponse } from "next/server";
import {
  getActiveUser,
  getAllProducts,
  getClosetItemsForUser,
  getFriendsForUser,
  getPublicFriendClosetFeed,
  getTelemetrySummary,
  grantFriendInviteBonus,
  updateUserProfile,
} from "@/lib/db/repository";
import { computeUserQuotaStatus } from "@/lib/tryon/budget-guard";

export async function GET() {
  const user = await getActiveUser("mila");
  const [products, myCloset, friends, friendFeed, telemetry] = await Promise.all([
    getAllProducts(),
    getClosetItemsForUser(user.id, true),
    getFriendsForUser(user.id),
    getPublicFriendClosetFeed(user.id),
    getTelemetrySummary(),
  ]);

  return NextResponse.json({
    user,
    quota: computeUserQuotaStatus(user),
    products,
    myCloset,
    friends,
    friendFeed,
    telemetry,
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === "claim_invite_bonus") {
      const user = await getActiveUser("mila");
      await grantFriendInviteBonus(user.id);
      const refreshed = await getActiveUser("mila");
      return NextResponse.json({
        user: refreshed,
        quota: computeUserQuotaStatus(refreshed),
        message: "+3 Bonus Free Try-Ons unlocked for sharing your GWO closet link!",
      });
    }

    const updated = await updateUserProfile("mila", body.patch || {});
    return NextResponse.json({
      user: updated,
      quota: computeUserQuotaStatus(updated),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to update profile" },
      { status: 400 }
    );
  }
}
