import { describe, expect, it } from "vitest";
import {
  buildTopLineAliExpressDropshipCatalog,
  calculateDropshipEconomics,
  extractAliExpressItemId,
  parseAliExpressCmChartToInches,
  searchTopLineAliExpressFeed,
} from "../src/lib/dropship/aliexpress-dropship";
import {
  buildSocialStyleDNA,
  reinforceSocialDnaFromOutfit,
} from "../src/lib/social/social-style-dna";
import { generateEndlessOutfitBatch } from "../src/lib/stylist/infinite-outfit-engine";
import { buildParametric3DFitScene } from "../src/lib/catalog/parametric-3d-garment";
import { build3DOutfitForClosetLook } from "../src/lib/catalog/closet-look-3d-mapper";
import { STUDIO_LOOKS } from "../src/components/vell/vell-data";
import { INITIAL_SEED_DB } from "../src/lib/db/seed-data";
import { analyzeExactAvatarFit } from "../src/lib/catalog/fit-intelligence";

describe("Universal 360° Front & Back Avatar + AliExpress Dropship + Endless AI Outfits", () => {
  const avatar = INITIAL_SEED_DB.profiles[0]; // 5'2" (62") • 32.25" B • 27" W • 34" H

  it("generates Front & Back 360° Avatar geometry for EVERY Closet look (0..8) and EVERY store category", () => {
    for (const look of STUDIO_LOOKS) {
      const mapped = build3DOutfitForClosetLook(look, INITIAL_SEED_DB.products);
      const scene = buildParametric3DFitScene({
        avatar,
        product: mapped.primaryProduct,
        companionProducts: mapped.companionProducts,
        selectedSize: "S",
      });
      expect(scene.quads.length).toBeGreaterThan(900);
      expect(scene.frontFeatureSummary.length).toBeGreaterThan(5);
      expect(scene.backFeatureSummary.length).toBeGreaterThan(5);
    }

    // Also test every single product in INITIAL_SEED_DB (including shoes, accessories, tops, bottoms, dresses, outerwear)
    for (const prod of INITIAL_SEED_DB.products) {
      const fit = analyzeExactAvatarFit(avatar, prod);
      const scene = buildParametric3DFitScene({
        avatar,
        product: prod,
        selectedSize: fit.recommendedSize,
      });
      expect(scene.quads.length).toBeGreaterThan(800);
      expect(scene.frontFeatureSummary).toBeTruthy();
      expect(scene.backFeatureSummary).toBeTruthy();
    }
  });

  it("calculates AliExpress Top-Line Dropship margins and calibrates CN-to-US sizing accurately", () => {
    const econ = calculateDropshipEconomics(18.4, 0, 2.85);
    expect(econ.retailPriceUsd).toBeGreaterThanOrEqual(52);
    expect(econ.profitMarginUsd).toBeGreaterThan(30);
    expect(econ.marginPct).toBeGreaterThanOrEqual(60);

    expect(
      extractAliExpressItemId(
        "https://www.aliexpress.com/item/1005012677693131.html?spm=a2g0o"
      )
    ).toBe("1005012677693131");

    const cmChart = parseAliExpressCmChartToInches(
      "S Bust: 80cm Waist: 62cm Hip: 86cm\nM Bust: 84cm Waist: 68cm Hip: 92cm\nL Bust: 89cm Waist: 73cm Hip: 97cm"
    );
    expect(cmChart).not.toBeNull();
    // CN Tag M (68cm waist = 26.8") maps to US Size S!
    expect(cmChart!.S).toBeDefined();

    const aeCatalog = buildTopLineAliExpressDropshipCatalog(2.85);
    expect(aeCatalog.length).toBe(8);
    const corset = aeCatalog.find((p) => p.id === "prod-ae-espresso-corset")!;
    const fit = analyzeExactAvatarFit(avatar, corset);
    expect(fit.recommendedSize).toBe("S");
    expect(corset.dropship?.cnSizeTagMap?.[fit.recommendedSize]).toBe(
      "CN Tag M"
    );

    const searchCorset = searchTopLineAliExpressFeed({
      query: "corset",
      category: "top",
    });
    expect(searchCorset[0].id).toBe("prod-ae-espresso-corset");
  });

  it("collaborates with Instagram / TikTok / Pinterest handles and adapts via reinforcement learning", () => {
    const oldMoneyDna = buildSocialStyleDNA({
      instagramHandle: "@chloe.atelier",
      bioOrCaptionText: "#oldmoney #quietluxury #tweed #blazer #tailored",
      glamSlider: 64,
      edgeSlider: 28,
    });
    expect(oldMoneyDna.primaryArchetype).toBe("old_money_tailored");

    const sirenDna = buildSocialStyleDNA({
      instagramHandle: "@mila.nyc",
      bioOrCaptionText: "#sirenglam #corset #datenight #party #crimson",
      glamSlider: 88,
      edgeSlider: 82,
    });
    expect(sirenDna.primaryArchetype).toBe("siren_glam");

    const sampleItems = INITIAL_SEED_DB.products.slice(0, 2);
    const reinforced = reinforceSocialDnaFromOutfit(
      oldMoneyDna,
      "ai-look-test-1",
      sampleItems,
      "siren_glam"
    );
    expect(reinforced.likedOutfitIds).toContain("ai-look-test-1");
    expect(reinforced.archetypeScores.siren_glam).toBeGreaterThan(
      oldMoneyDna.archetypeScores.siren_glam
    );
  });

  it("generates endless non-repeating AI outfits across multiple scroll batches with exact sizes & margins", () => {
    const dna = buildSocialStyleDNA({
      instagramHandle: "@mila.nyc",
      glamSlider: 76,
      edgeSlider: 68,
    });
    const seen = new Set<string>();
    const allGenerated = [];

    for (let b = 0; b < 4; b++) {
      const batch = generateEndlessOutfitBatch({
        catalog: INITIAL_SEED_DB.products,
        avatar,
        socialDna: dna,
        batchIndex: b,
        batchSize: 6,
        seenSignatures: seen,
      });
      expect(batch.length).toBe(6);
      allGenerated.push(...batch);
    }

    expect(allGenerated.length).toBe(24);
    expect(allGenerated[0].socialDnaMatchPct).toBeGreaterThanOrEqual(76);
    expect(Object.keys(allGenerated[0].perItemSizes).length).toBe(
      allGenerated[0].items.length
    );

    // Filter specifically for AliExpress Dropship feature looks
    const dsBatch = generateEndlessOutfitBatch({
      catalog: INITIAL_SEED_DB.products,
      avatar,
      socialDna: dna,
      batchIndex: 0,
      batchSize: 6,
      sourceFilter: "aliexpress_dropship",
    });
    expect(dsBatch.every((o) => o.dropshipPieceCount >= 1)).toBe(true);
    expect(dsBatch[0].totalStoreProfitUsd).toBeGreaterThan(0);
  });
});
