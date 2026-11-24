import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getProductById, resetTestMemoryDb } from "@/lib/db/repository";
import { buildCommissionSafeUrl } from "@/lib/catalog/affiliate";

describe("Commission-Safe Affiliate & Friend Attribution Builder", () => {
  const originalSkimlinks = process.env.SKIMLINKS_PUBLISHER_ID;

  beforeEach(() => {
    resetTestMemoryDb();
    delete process.env.SKIMLINKS_PUBLISHER_ID;
  });

  afterEach(() => {
    if (originalSkimlinks) {
      process.env.SKIMLINKS_PUBLISHER_ID = originalSkimlinks;
    } else {
      delete process.env.SKIMLINKS_PUBLISHER_ID;
    }
  });

  it("injects web-checkout flag and friend referral code on Nike links", async () => {
    const cortez = (await getProductById("prod-nike-cortez"))!;
    const link = buildCommissionSafeUrl(cortez, "MAYA-GWO");

    expect(link.destinationUrl).toContain("gwo_web=1");
    expect(link.destinationUrl).toContain("gwo_ref=MAYA-GWO");
    expect(link.referrerCode).toBe("MAYA-GWO");
  });

  it("wraps links automatically through Skimlinks when SKIMLINKS_PUBLISHER_ID is set", async () => {
    process.env.SKIMLINKS_PUBLISHER_ID = "99999X12345";
    const cortez = (await getProductById("prod-nike-cortez"))!;
    const link = buildCommissionSafeUrl(cortez, "CHLOE-GWO");

    expect(link.network).toBe("skimlinks");
    expect(link.destinationUrl).toContain("go.redirectingat.com");
    expect(link.destinationUrl).toContain("xcust=CHLOE-GWO");
  });
});
