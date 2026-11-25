import { describe, expect, it } from "vitest";
import {
  analyzeExactAvatarFit,
  extractProductFitProfile,
  upgradeCdnImageResolution,
} from "@/lib/catalog/fit-intelligence";
import { Product } from "@/lib/types";

const SIGNATURE_AVATAR = {
  bustInches: 32.25,
  waistInches: 27,
  hipsInches: 34,
  heightInches: 65, // 5'5"
  shoeSize: "7.5",
};

describe("Live Store PDP Fit, Model Stats & Exact Avatar Fit Engine", () => {
  it("extracts store model height/size, fiber stretch %, and fit notes from PDP markdown", () => {
    const samplePdp = `
      # Women's Halo Performance Hoodie
      Our signature buttery hoodie that hits right at the natural waist. Fits true to size.
      * Model is 5'8" / Size S
      * 89% Recycled Polyester, 11% Elastane
      * 4-way stretch knit
      ## Complete the Look
      Mens Boxer Brief 95% Cotton
    `;

    const { fitMetadata } = extractProductFitProfile({
      rawText: samplePdp,
      title: "Halo Performance Hoodie",
      brand: "Vuori",
      category: "outerwear",
      silhouette: "oversized-hoodie",
    });

    expect(fitMetadata.modelStats?.heightInches).toBe(68);
    expect(fitMetadata.modelStats?.heightDisplay).toBe('5\'8"');
    expect(fitMetadata.modelStats?.wornSize).toBe("S");
    expect(fitMetadata.elastanePct).toBe(11);
    expect(fitMetadata.stretchLevel).toBe("high");
    expect(fitMetadata.hemLanding).toBe("natural-waist");
  });

  it("upgrades low-res Shopify and Imgix CDN thumbnail URLs to 1200px HD", () => {
    const shopifyThumb =
      "https://cdn.shopify.com/s/files/1/0022/4008/6074/products/VW201PHG_1.jpg?v=1623991870&width=100&height=125&crop=center";
    const upgraded = upgradeCdnImageResolution(shopifyThumb);
    expect(upgraded).toContain("width=1200");
    expect(upgraded).not.toContain("height=125");
    expect(upgraded).not.toContain("crop=center");
  });

  it("protects a 27-inch waist from rigid XS pinching while modeling stretch on knits", () => {
    const rigidDress: Product = {
      id: "test-rigid-silk",
      canonicalUrl: "https://thereformation.com/products/silk-dress",
      brand: "Reformation",
      storeDomain: "thereformation.com",
      title: "Casette Silk Midi Dress",
      category: "dress",
      silhouette: "slip-dress",
      colorName: "Champagne",
      colorHex: "#D4C6B6",
      accentHex: "#141518",
      price: 248,
      currency: "USD",
      fitMetadata: {
        fitNotes: ["Non-stretch bias silk"],
        fabricComposition: "100% Silk",
        stretchLevel: "rigid",
        cutType: "fitted",
        storeFitTendency: "true_to_size",
        modelStats: {
          rawText: 'Model is 5\'9" wearing Size S',
          heightInches: 69,
          heightDisplay: '5\'9"',
          wornSize: "S",
        },
      },
      occasions: ["Date Night"],
      vibes: ["Romantic"],
      availableSizes: ["XS", "S", "M", "L"],
      sizeChartInches: {
        XS: { bustMin: 31, bustMax: 32.5, waistMin: 24, waistMax: 25.25, hipsMin: 34.5, hipsMax: 35.75 },
        S: { bustMin: 32.75, bustMax: 34.5, waistMin: 25.75, waistMax: 27.25, hipsMin: 36.25, hipsMax: 37.75 },
        M: { bustMin: 35, bustMax: 36.75, waistMin: 28, waistMax: 29.75, hipsMin: 38.5, hipsMax: 40.25 },
      },
      estDeliveryDays: 4,
      inStock: true,
      sourceType: "scraped_url",
      lastScrapedAt: "",
      staleAfter: "",
    };

    // Recommended size must be S (fits 27" waist inside 25.75-27.25" spec)
    const recReport = analyzeExactAvatarFit(SIGNATURE_AVATAR, rigidDress);
    expect(recReport.recommendedSize).toBe("S");
    expect(recReport.lengthComparison.heightDiffInches).toBe(-4);

    // Simulating XS on rigid silk must flag Waist as too_tight!
    const xsReport = analyzeExactAvatarFit(SIGNATURE_AVATAR, rigidDress, "XS");
    const waistZone = xsReport.zones.find((z) => z.zone === "Waist");
    expect(waistZone?.feel).toBe("too_tight");
  });

  it("parses Babyboo Cornelia Mini Dress multi-line model stats and lace-up corset physics", () => {
    const babybooHtml = `
      The Cornelia Mini Dress in red combines structured elegance with refined details.
      Non-stretch crepe & woven lyocell. Boning in bodice. Lace up back. Corset bodice.
      Dress Lengths:
      X-Small: 57cm/22.4in
      Small: 58cm/22.8in
      Model’s Measurements:
      Dress size: XS
      Height: 170cm/66.9in
      Bust: 79cm/31.1in
      Waist: 60cm/23.6in
      Hips: 90cm/35.4in
    `;

    const { fitMetadata, calibratedChart } = extractProductFitProfile({
      rawText: babybooHtml,
      title: "Cornelia Mini Dress - Red",
      brand: "Babyboo Fashion",
      category: "dress",
      silhouette: "mini-dress",
    });

    expect(fitMetadata.modelStats?.wornSize).toBe("XS");
    expect(fitMetadata.modelStats?.heightInches).toBe(67);
    expect(fitMetadata.modelStats?.bustInches).toBe(31.1);
    expect(fitMetadata.modelStats?.waistInches).toBe(23.6);
    expect(fitMetadata.modelStats?.hipsInches).toBe(35.4);
    expect(fitMetadata.hasAdjustableBack).toBe(true);
    expect(fitMetadata.garmentLengthBySizeInches?.S).toBe(22.8);

    const corneliaProduct: Product = {
      id: "prod-babyboo-cornelia-red",
      canonicalUrl:
        "https://babyboofashion-com-au.myshopify.com/products/cornelia-mini-dress-red",
      brand: "Babyboo Fashion",
      storeDomain: "babyboofashion-com-au.myshopify.com",
      title: "Cornelia Mini Dress - Red",
      category: "dress",
      silhouette: "mini-dress",
      colorName: "Crimson Red",
      colorHex: "#C80815",
      accentHex: "#FAF8F5",
      price: 132,
      currency: "USD",
      fitMetadata,
      occasions: ["Party"],
      vibes: ["Romantic"],
      availableSizes: ["XS", "S", "M", "L", "XL"],
      sizeChartInches: calibratedChart,
      estDeliveryDays: 4,
      inStock: true,
      sourceType: "scraped_url",
      lastScrapedAt: "",
      staleAfter: "",
    };

    const rec = analyzeExactAvatarFit(SIGNATURE_AVATAR, corneliaProduct);
    expect(rec.recommendedSize).toBe("S");
    const bustS = rec.zones.find((z) => z.zone === "Bust");
    const waistS = rec.zones.find((z) => z.zone === "Waist");
    expect(waistS?.feel).toBe("tailored_ideal");
    expect(bustS?.feelLabel).toBe("Corset Cinches Flush");

    const xsCheck = analyzeExactAvatarFit(SIGNATURE_AVATAR, corneliaProduct, "XS");
    expect(xsCheck.zones.find((z) => z.zone === "Waist")?.feel).toBe("too_tight");
  });
});
