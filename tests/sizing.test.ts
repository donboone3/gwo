import { beforeEach, describe, expect, it } from "vitest";
import {
  getActiveUser,
  getProductById,
  getPublicFriendClosetFeed,
  resetTestMemoryDb,
} from "@/lib/db/repository";
import {
  calculateBodyTwinSimilarity,
  recommendSizeForUser,
} from "@/lib/catalog/sizing";

describe("Exact Profile Sizing & Body-Twin Friend Engine", () => {
  beforeEach(() => {
    resetTestMemoryDb();
  });

  it("defaults the Signature Avatar profile to 5'2\" (62 in), 32.25 bust, 27 waist, and 34 hips", async () => {
    const mila = await getActiveUser("mila");
    expect(mila.heightInches).toBe(62);
    expect(mila.bustInches).toBe(32.25);
    expect(mila.waistInches).toBe(27);
    expect(mila.hipsInches).toBe(34);
  });

  it("scores Maya (nearly identical measurements) as >=95% Body Twin to Mila", async () => {
    const mila = await getActiveUser("mila");
    const maya = await getActiveUser("maya");
    const sim = calculateBodyTwinSimilarity(mila, maya);
    expect(sim).toBeGreaterThanOrEqual(95);
  });

  it("adjusts recommended size using a close Body-Twin friend's real fit rating", async () => {
    const mila = await getActiveUser("mila");
    const friendFeed = await getPublicFriendClosetFeed(mila.id);

    // Maya (98% twin) marked Noir Double-Breasted Tailored Blazer as runs_large (bought XS)
    const blazer = (await getProductById("prod-ae-noir-tailored-blazer"))!;
    const blazerRec = recommendSizeForUser(mila, blazer, friendFeed);
    expect(blazerRec.recommendedSize).toBe("XS");
    expect(blazerRec.bodyTwin?.friend.username).toBe("maya");

    // Maya marked Ribbed Lyocell-Acetate Tank as runs_small (sized up to M)
    const tank = (await getProductById("prod-ae-acetate-beaded-tank"))!;
    const tankRec = recommendSizeForUser(mila, tank, friendFeed);
    expect(tankRec.recommendedSize).toBe("M");
  });
});
