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

  it("scores Maya (nearly identical measurements) as >=95% Body Twin to Mila", async () => {
    const mila = await getActiveUser("mila");
    const maya = await getActiveUser("maya");
    const sim = calculateBodyTwinSimilarity(mila, maya);
    expect(sim).toBeGreaterThanOrEqual(95);
  });

  it("adjusts recommended size using a close Body-Twin friend's real fit rating", async () => {
    const mila = await getActiveUser("mila");
    const friendFeed = await getPublicFriendClosetFeed(mila.id);

    // Maya (98% twin) marked Nike Oversized Phoenix Hoodie as runs_large (bought XS)
    const hoodie = (await getProductById("prod-nike-phoenix-hoodie"))!;
    const hoodieRec = recommendSizeForUser(mila, hoodie, friendFeed);
    expect(hoodieRec.recommendedSize).toBe("XS");
    expect(hoodieRec.bodyTwin?.friend.username).toBe("maya");

    // Maya marked SKIMS Cotton Jersey Baby Tee as runs_small (sized up to M)
    const skimsTee = (await getProductById("prod-skims-tee"))!;
    const teeRec = recommendSizeForUser(mila, skimsTee, friendFeed);
    expect(teeRec.recommendedSize).toBe("M");
  });
});
