import { describe, expect, it } from "vitest";
import {
  buildTopLineAliExpressDropshipCatalog,
  calculateDropshipEconomics,
  extractAliExpressItemId,
  parseAliExpressCmChartToInches,
  parseScrapedAliExpressSearchHits,
  searchTopLineAliExpressFeed,
} from "../src/lib/dropship/aliexpress-dropship";
import { buildDropshipOrderFromBag } from "../src/lib/dropship/dropship-fulfillment";
import {
  buildSocialStyleDNA,
  parseSocialProfileUrl,
  reinforceSocialDnaFromOutfit,
} from "../src/lib/social/social-style-dna";
import { buildIgStoryCardSpec } from "../src/lib/social/ig-story-card";
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

    // Also test every single product in INITIAL_SEED_DB (including all 14 AliExpress luxury SKUs)
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

  it("calculates AliExpress Top-Line Dropship margins, 14-SKU catalog integrity, and live search hit parsing", () => {
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
    expect(cmChart!.S).toBeDefined();

    const aeCatalog = buildTopLineAliExpressDropshipCatalog(2.85);
    expect(aeCatalog.length).toBe(14);
    for (const item of aeCatalog) {
      expect(item.imageUrl).toBeTruthy();
      expect(item.price).toBeGreaterThan(item.dropship!.wholesaleCostUsd);
      expect(item.fitMetadata?.fabricComposition).toBeTruthy();
      expect(item.fitMetadata?.descriptionSummary).toBeTruthy();
    }

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

    // Live search hit parser (Firecrawl web + AliExpress CDN image join)
    const liveParsed = parseScrapedAliExpressSearchHits(
      [
        {
          url: "https://www.aliexpress.com/item/1005009988776655.html",
          title: "Emerald Mulberry Silk Draped Maxi Dress - AliExpress 2026",
          description:
            "US $28.50 • Heavyweight mulberry silk satin bias dress. S Bust: 80cm Waist: 64cm Hip: 88cm; M Bust: 85cm Waist: 68cm Hip: 93cm",
        },
        {
          url: "https://www.aliexpress.com/item/1005009988776655.html",
          imageUrl:
            "https://ae-pic-a1.aliexpress-media.com/kf/S1234567890abcdef.jpg_960x960q75.jpg_.avif",
        },
      ],
      2.85
    );
    expect(liveParsed.length).toBe(1);
    expect(liveParsed[0].dropship?.wholesaleCostUsd).toBe(28.5);
    expect(liveParsed[0].price).toBeGreaterThan(75);
    expect(liveParsed[0].imageUrl).toContain("wsrv.nl");
    expect(liveParsed[0].imageUrl).not.toContain("_.avif");
  });

  it("builds GWO Boutique Dropship Orders with hidden wholesale cost & Supplier CN/EU Tag mapping", () => {
    const order = buildDropshipOrderFromBag({
      bagItems: [
        {
          id: "b1",
          productId: "prod-ae-champagne-blazer-dress",
          title: "Champagne Satin Boned Corset Lapel Blazer Mini Dress",
          brand: "GWO × Couture",
          price: 76,
          size: "S",
        },
        {
          id: "b2",
          productId: "prod-ae-meotina-leather-boots",
          title: "Meotina Genuine Leather Split-Toe Block-Heel Knee Boots",
          brand: "GWO × Noir",
          price: 106,
          size: "7.5",
        },
        {
          id: "b3",
          productId: "prod-babyboo-cornelia-red",
          title: "Cornelia Mini Dress - Red",
          brand: "Babyboo Fashion",
          price: 132,
          size: "S",
          storeUrl:
            "https://babyboofashion-com-au.myshopify.com/products/cornelia-mini-dress-red",
        },
      ],
      catalog: INITIAL_SEED_DB.products,
      customerName: "Mila Vance",
      customerEmail: "mila@goodwithonline.com",
      shippingAddress: "458 Mercer St",
      cityPostal: "New York, NY 10013",
    });

    expect(order.lines.length).toBe(3);
    expect(order.lines[0].isDropship).toBe(true);
    expect(order.lines[0].supplierFulfillmentTag).toBe("CN Tag M");
    expect(order.lines[1].isDropship).toBe(true);
    expect(order.lines[1].supplierFulfillmentTag).toBe("EU 38");
    expect(order.lines[2].isDropship).toBe(false);
    expect(order.totalRetailCollectedUsd).toBe(314);
    expect(order.totalNetStoreProfitUsd).toBeGreaterThan(100);
  });

  it("collaborates with Instagram / TikTok / Pinterest URLs, reinforces likes, and builds 1080×1920 IG Story cards", () => {
    const parsedPin = parseSocialProfileUrl(
      "https://www.pinterest.com/chloe/old-money-capsule/"
    );
    expect(parsedPin.platform).toBe("pinterest");
    expect(parsedPin.handle).toBe("@chloe");
    expect(parsedPin.boardTitle).toBe("Old Money Capsule");

    const parsedIg = parseSocialProfileUrl(
      "https://www.instagram.com/haileybieber/"
    );
    expect(parsedIg.platform).toBe("instagram");
    expect(parsedIg.handle).toBe("@haileybieber");

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

    const outfits = generateEndlessOutfitBatch({
      catalog: INITIAL_SEED_DB.products,
      avatar,
      socialDna: sirenDna,
      batchIndex: 0,
      batchSize: 2,
    });
    const storySpec = buildIgStoryCardSpec(outfits[0], sirenDna, "5'2\"");
    expect(storySpec.width).toBe(1080);
    expect(storySpec.height).toBe(1920);
    expect(storySpec.handleBadge).toContain("@mila.nyc");
    expect(storySpec.pieces.length).toBeGreaterThanOrEqual(2);
  });

  it("generates endless non-repeating AI outfits across batches and adapts to custom AI Vibe Prompts", () => {
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

    // Custom AI Vibe Collaborator Prompt re-ranks & customizes rationale
    const parisBatch = generateEndlessOutfitBatch({
      catalog: INITIAL_SEED_DB.products,
      avatar,
      socialDna: dna,
      batchIndex: 0,
      batchSize: 4,
      customVibePrompt: "Old Money Paris Brunch",
    });
    expect(parisBatch[0].stylistRationale).toContain("Old Money Paris Brunch");
    const topTitles = parisBatch[0].items.map((x) => x.title.toLowerCase()).join(" ");
    expect(
      /blazer|tweed|camel|trousers|ivory|linen|silk|slingback|tote/.test(topTitles)
    ).toBe(true);

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
