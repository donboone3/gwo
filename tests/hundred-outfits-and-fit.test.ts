import { describe, expect, it } from "vitest";
import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import {
  CURATED_100_OUTFIT_DESIGNS,
  getCuratedOutfitsForProduct,
} from "@/lib/stylist/curated-100-outfits";
import { buildAiRunwayOutfits } from "@/lib/stylist/runway-ai-outfits";
import { STUDIO_LOOKS } from "@/components/vell/vell-data";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import { buildSocialStyleDNA } from "@/lib/social/social-style-dna";
import {
  evaluateCreditSmart360Plan,
  routeProductTo360Tier,
} from "@/lib/higgsfield/credit-smart-360-pipeline";
import { generateStaticParams } from "@/app/product/[id]/page";

describe("100 Curated Outfits, 100% Physical Measurements, Acute Fit & MotionSites Pages", () => {
  const catalog = buildTopLineAliExpressDropshipCatalog(2.85);
  const byId = new Map(catalog.map((p) => [p.id, p]));

  it("provides 100 distinct, non-duplicate curated outfit designs across Runway and Closet", () => {
    expect(CURATED_100_OUTFIT_DESIGNS.length).toBe(100);
    expect(STUDIO_LOOKS.length).toBe(100);

    const uniqueKeys = new Set<string>();
    const uniqueTitles = new Set<string>();
    const uniquePieceCombos = new Set<string>();
    const coveredSkus = new Set<string>();

    for (const outfit of CURATED_100_OUTFIT_DESIGNS) {
      expect(uniqueKeys.has(outfit.key)).toBe(false);
      uniqueKeys.add(outfit.key);

      expect(uniqueTitles.has(outfit.title)).toBe(false);
      uniqueTitles.add(outfit.title);

      expect(outfit.productIds.length).toBeGreaterThanOrEqual(3);
      for (const pid of outfit.productIds) {
        expect(byId.has(pid)).toBe(true);
        coveredSkus.add(pid);
      }

      const comboSig = [...outfit.productIds].sort().join("|");
      expect(uniquePieceCombos.has(comboSig)).toBe(false);
      uniquePieceCombos.add(comboSig);
    }

    // Every single one of the 54 certified SKUs appears in at least 1 curated outfit!
    expect(coveredSkus.size).toBe(catalog.length);

    const dna = buildSocialStyleDNA({ instagramHandle: "@mila.nyc" });
    const runwayList = buildAiRunwayOutfits({
      catalog,
      avatar: {
        heightInches: 62,
        bustInches: 32.25,
        waistInches: 27,
        hipsInches: 34,
        shoeSize: "7.5",
      },
      socialDna: dna,
      extraGeneratedCount: 0,
    });
    expect(runwayList.length).toBe(100);
  });

  it("ensures 100% of products (Apparel, Shoes, Belts & Bags) have calibrated physical measurements & acute fit reports", () => {
    expect(catalog.length).toBe(54);

    const petiteScan = {
      heightInches: 61, // 5'1"
      shoulderInches: 14.3,
      bustInches: 31.8,
      waistInches: 24.6,
      hipsInches: 34.4,
      shoeSize: "6.5",
    };

    const tallCurvyScan = {
      heightInches: 69, // 5'9"
      shoulderInches: 15.9,
      bustInches: 37.5,
      waistInches: 30.2,
      hipsInches: 40.8,
      shoeSize: "8.5",
    };

    for (const prod of catalog) {
      const chartKeys = Object.keys(prod.sizeChartInches || {});
      expect(chartKeys.length).toBeGreaterThan(0);

      const firstSpec = prod.sizeChartInches[chartKeys[0]];
      if (prod.category === "shoes") {
        expect(firstSpec.footLengthIn).toBeGreaterThan(8.5);
        expect(firstSpec.heelHeightIn).toBeGreaterThan(0.5);
      } else if (prod.category === "accessory" && !/belt/i.test(prod.title)) {
        expect(firstSpec.widthIn).toBeGreaterThan(5);
        expect(firstSpec.heightIn).toBeGreaterThan(4);
        expect(firstSpec.strapDropIn).toBeGreaterThan(3);
      } else if (prod.category === "accessory") {
        expect(firstSpec.waistMin).toBeGreaterThan(20);
        expect(firstSpec.lengthIn).toBeGreaterThan(30);
      } else {
        expect(firstSpec.waistMin).toBeGreaterThan(20);
        expect(firstSpec.garmentWaistIn).toBeGreaterThan(20);
        expect(firstSpec.lengthIn).toBeGreaterThan(12);
      }

      const petiteFit = analyzeExactAvatarFit(petiteScan, prod);
      const tallFit = analyzeExactAvatarFit(tallCurvyScan, prod);

      expect(petiteFit.recommendedSize).toBeTruthy();
      expect(tallFit.recommendedSize).toBeTruthy();
      expect(petiteFit.acuteScanMetrics).toBeDefined();
      expect(petiteFit.acuteScanMetrics?.hemLandingLabel.length).toBeGreaterThan(4);

      if (prod.category !== "shoes" && prod.availableSizes.length > 1) {
        // Tall curvy scan (30.2" waist) must recommend a larger size than petite scan (24.6" waist)
        expect(prod.availableSizes.indexOf(tallFit.recommendedSize)).toBeGreaterThan(
          prod.availableSizes.indexOf(petiteFit.recommendedSize)
        );
      }
    }
  });

  it("guarantees 100% 360° readiness with $0.00 runtime Higgsfield spend and dedicated MotionSites routes", () => {
    const plan = evaluateCreditSmart360Plan({
      products: catalog,
      curatedOutfitsCount: CURATED_100_OUTFIT_DESIGNS.length,
      projectedShoppersCount: 100,
    });

    expect(plan.hundredPercent360Ready).toBe(true);
    expect(plan.tier0ZeroCostSkus).toBe(54);
    expect(plan.creditSmartRuntime100ShoppersUsd).toBe(0);
    expect(plan.savingsPct).toBe(100);

    for (const prod of catalog) {
      const dec = routeProductTo360Tier(prod);
      expect(dec.is360ReadyNow).toBe(true);
      expect(dec.estimatedCreditsUsd).toBe(0);
      expect(getCuratedOutfitsForProduct(prod.id).length).toBeGreaterThanOrEqual(1);
    }

    const staticRoutes = generateStaticParams();
    expect(staticRoutes.length).toBe(54);
    for (const r of staticRoutes) {
      expect(byId.has(r.id)).toBe(true);
    }
  });
});
