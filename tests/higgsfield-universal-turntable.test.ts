import { describe, expect, it } from "vitest";
import {
  NUM_TURNTABLE_FRAMES,
  resolveTurntableSpecForOutfit,
} from "@/lib/three/higgsfield-turntable-engine";
import { computeVisualSizeFitMorph } from "@/lib/three/size-fit-morph";
import { Product } from "@/lib/types";

function makeScrapedProduct(overrides: Partial<Product>): Product {
  return {
    id: `prod_url_${Math.random().toString(36).slice(2, 8)}`,
    canonicalUrl: "https://us.princesspolly.com/products/test-item",
    brand: "Princess Polly",
    storeDomain: "us.princesspolly.com",
    title: "Selby Satin Slip Midi Dress",
    category: "dress",
    silhouette: "slip-dress",
    colorName: "Soft Blush",
    colorHex: "#DFB8BE",
    accentHex: "#181615",
    price: 68,
    currency: "USD",
    imageUrl: "https://cdn.shopify.com/s/files/1/test.jpg",
    occasions: ["Party"],
    vibes: ["Siren Glam"],
    availableSizes: ["XS", "S", "M", "L"],
    sizeChartInches: {},
    estDeliveryDays: 4,
    inStock: true,
    sourceType: "scraped_url",
    lastScrapedAt: new Date().toISOString(),
    staleAfter: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

describe("Universal Dual-Sheet 1024p HD Higgsfield 360° Turntable Engine (Store Pulls, URL Submits & Custom Avatars)", () => {
  it("resolves customer-submitted external URL dresses, blazers, leggings, and bags to true-360° HD turntables", () => {
    expect(NUM_TURNTABLE_FRAMES).toBe(72);

    const blushSlip = makeScrapedProduct({
      title: "Juliette Bias Satin Midi Slip Dress",
      category: "dress",
      silhouette: "slip-dress",
      colorName: "Soft Blush",
      colorHex: "#DFB8BE",
    });
    const slipSpec = resolveTurntableSpecForOutfit([blushSlip], [blushSlip]);
    expect(slipSpec.kind).toBe("higgsfield_mp4");
    expect(slipSpec.lookIdx).toBe(2);
    expect(slipSpec.fastAtlasUrl).toContain("ae_outfit_2_fast.webp");
    expect(slipSpec.atlasUrl).toContain("ae_outfit_2_qhd.webp");
    expect(slipSpec.colorwayShifts?.length).toBeGreaterThan(0);

    const navyBlazer = makeScrapedProduct({
      title: "Oversized Double-Breasted Tailored Blazer",
      category: "outerwear",
      silhouette: "cropped-jacket",
      colorName: "Vintage Indigo",
      colorHex: "#243B5A",
    });
    const blazerSpec = resolveTurntableSpecForOutfit([navyBlazer], [navyBlazer]);
    expect(blazerSpec.kind).toBe("higgsfield_mp4");
    expect(blazerSpec.lookIdx).toBe(7);
    expect(blazerSpec.colorwayShifts?.[0]?.sourceMask).toBe("noir_dark");

    const lilacLeggings = makeScrapedProduct({
      title: "Airbrush High-Waist Yoga Flare Leggings",
      category: "bottom",
      silhouette: "leggings",
      colorName: "Lilac",
      colorHex: "#B79CED",
    });
    const legSpec = resolveTurntableSpecForOutfit(
      [lilacLeggings],
      [lilacLeggings]
    );
    expect(legSpec.kind).toBe("higgsfield_mp4");
    expect(legSpec.lookIdx).toBe(8);
    expect(legSpec.colorwayShifts?.[0]?.sourceMask).toBe("sage_green");

    const quiltedBag = makeScrapedProduct({
      title: "Burgundy Quilted Chain Crossbody Flap Bag",
      category: "accessory",
      silhouette: "shoulder-bag",
      colorName: "Deep Burgundy",
      colorHex: "#6E1423",
    });
    const bagSpec = resolveTurntableSpecForOutfit([quiltedBag], [quiltedBag]);
    expect(bagSpec.kind).toBe("higgsfield_mp4");
    expect(bagSpec.lookIdx).toBe(9);
  });

  it("supports custom customer avatar skin-tone harmonization and dedicated customer avatar 360° MP4s", () => {
    const baseWithSkin = resolveTurntableSpecForOutfit([], [], {
      skinToneHex: "#F3D3BE",
    });
    expect(baseWithSkin.kind).toBe("higgsfield_mp4");
    expect(baseWithSkin.lookIdx).toBe("base");
    expect(baseWithSkin.skinToneTargetHex).toBe("#F3D3BE");

    const dedicatedAvatar = resolveTurntableSpecForOutfit([], [], {
      customTurntableMp4Url: "/models/turntables/custom_customer_360.mp4",
    });
    expect(dedicatedAvatar.kind).toBe("higgsfield_mp4");
    expect(dedicatedAvatar.lookIdx).toBe("custom");
    expect(dedicatedAvatar.mp4Url).toBe(
      "/models/turntables/custom_customer_360.mp4"
    );
  });

  it("switches Closet tops, skirts, bags, and shoes accurately without unwanted outerwear contamination", () => {
    const corset = makeScrapedProduct({
      id: "prod-ae-espresso-corset",
      title: "Sculpted Espresso Boned Satin Basque Corset Top",
      category: "top",
      silhouette: "crop-tank",
      colorName: "Espresso Mocha",
      colorHex: "#4B3531",
      sourceType: "aliexpress_dropship",
    });
    const pleatedMini = makeScrapedProduct({
      id: "prod-ae-noir-pleated-mini",
      title: "Noir Belted Knife-Pleated Mini Skirt",
      category: "bottom",
      silhouette: "mini-skirt",
      colorName: "Studio Noir",
      colorHex: "#1D1E22",
      sourceType: "aliexpress_dropship",
    });
    const silverBag = makeScrapedProduct({
      id: "prod-ae-silver-metallic-shoulder-bag",
      title: "Liquid-Silver Ruched Metallic Crescent Shoulder Bag",
      category: "accessory",
      silhouette: "shoulder-bag",
      colorName: "Liquid Silver",
      colorHex: "#D4D8DF",
      sourceType: "aliexpress_dropship",
    });

    // Equipping Silver Bag with Espresso Corset + Noir Pleated Mini preserves BOTH the Mini/Short silhouette (15) AND Corset/Skirt colors without swapping to Cobalt Dress!
    const bagFocusSpec = resolveTurntableSpecForOutfit(
      [corset, pleatedMini, silverBag],
      [corset, pleatedMini, silverBag],
      { focusProductId: silverBag.id }
    );
    expect(bagFocusSpec.lookIdx).toBe(15);
    expect(bagFocusSpec.isCustomMix).toBe(true);
    expect(bagFocusSpec.hasBagEquipped).toBe(true);

    // Espresso Corset + Noir Pleated Mini (no jacket) uses jacket-free mini/short separates donor (15) with zero unwanted blazer!
    const miniFocusSpec = resolveTurntableSpecForOutfit(
      [corset, pleatedMini],
      [corset, pleatedMini],
      { focusProductId: pleatedMini.id }
    );
    expect(miniFocusSpec.lookIdx).toBe(15);
    expect(miniFocusSpec.hasBagEquipped).toBe(false);

    // Pairing Espresso Corset + Vintage Wide Denim matches Canonical Capsule 9 natively!
    const vintageDenim = makeScrapedProduct({
      id: "prod-ae-vintage-wide-denim",
      title: "High-Rise Vintage Indigo Wide-Leg Denim Jeans",
      category: "bottom",
      silhouette: "wide-denim",
      colorName: "Vintage Indigo",
      colorHex: "#4F6B8E",
      sourceType: "aliexpress_dropship",
    });
    const denimPairSpec = resolveTurntableSpecForOutfit(
      [corset, vintageDenim],
      [corset, vintageDenim],
      { focusProductId: vintageDenim.id }
    );
    expect(denimPairSpec.lookIdx).toBe(9);
    expect(denimPairSpec.upperOverlay).toBeUndefined();
  });

  it("layers jackets over dresses and swaps shirts in Closet without changing unselected clothes, and morphs XS vs L fit", () => {
    const emeraldDress = makeScrapedProduct({
      id: "prod-ae-emerald-satin-midi",
      title: "Emerald Cowl-Neck Bias Satin Midi Slip Dress",
      category: "dress",
      silhouette: "slip-dress",
      colorName: "Emerald",
      colorHex: "#1F5441",
      sourceType: "aliexpress_dropship",
    });
    const noirBlazer = makeScrapedProduct({
      id: "prod-ae-noir-tailored-blazer",
      title: "Double-Breasted Noir Tailored Boyfriend Blazer",
      category: "outerwear",
      silhouette: "cropped-jacket",
      colorName: "Studio Noir",
      colorHex: "#18191D",
      sourceType: "aliexpress_dropship",
    });
    const blushTop = makeScrapedProduct({
      id: "prod-ae-blush-ruched-offshoulder",
      title: "Blush Rose Ruched Off-Shoulder Mesh Top",
      category: "top",
      silhouette: "crop-tank",
      colorName: "Blush Rose",
      colorHex: "#D8ACB4",
      sourceType: "aliexpress_dropship",
    });
    const champagnePants = makeScrapedProduct({
      id: "prod-ae-champagne-trousers",
      title: "Champagne High-Waist Pleated Wide-Leg Trousers",
      category: "bottom",
      silhouette: "wide-denim",
      colorName: "Champagne Oat",
      colorHex: "#D9CEBE",
      sourceType: "aliexpress_dropship",
    });

    // Jacket over Dress: uses coherent Jacket-Over-Dress donor (14) with independent Noir Blazer + Emerald Dress GPU shifts and 4K modular studio mix!
    const jacketOverDress = resolveTurntableSpecForOutfit(
      [emeraldDress, noirBlazer],
      [emeraldDress, noirBlazer]
    );
    expect(jacketOverDress.lookIdx).toBe(14);
    expect(jacketOverDress.isCustomMix).toBe(true);
    expect(
      jacketOverDress.colorwayShifts?.some((s) => s.targetHex === "#18191D")
    ).toBe(true);
    expect(
      jacketOverDress.colorwayShifts?.some((s) => s.targetHex === "#1F5441")
    ).toBe(true);

    // Shirt Swap: keeps Champagne Trousers on coherent donor (0) and shifts ONLY the top zone to Blush Rose!
    const shirtSwap = resolveTurntableSpecForOutfit(
      [blushTop, champagnePants],
      [blushTop, champagnePants]
    );
    expect(shirtSwap.lookIdx).toBe(0);
    expect(shirtSwap.isCustomMix).toBe(true);
    expect(
      shirtSwap.colorwayShifts?.some((s) => s.targetHex === "#D8ACB4")
    ).toBe(true);

    // Live Visual Size-Fit Morphing: XS < S < M < L < XL in both width ease and hem length!
    const xsFit = computeVisualSizeFitMorph({
      product: emeraldDress,
      selectedSize: "XS",
      recommendedSize: "S",
    });
    const sFit = computeVisualSizeFitMorph({
      product: emeraldDress,
      selectedSize: "S",
      recommendedSize: "S",
    });
    const lFit = computeVisualSizeFitMorph({
      product: emeraldDress,
      selectedSize: "L",
      recommendedSize: "S",
    });
    const xlFit = computeVisualSizeFitMorph({
      product: emeraldDress,
      selectedSize: "XL",
      recommendedSize: "S",
    });
    expect(xsFit.widthEaseScale).toBeLessThan(sFit.widthEaseScale);
    expect(sFit.widthEaseScale).toBeCloseTo(1.0, 4);
    expect(lFit.widthEaseScale).toBeGreaterThan(1.12);
    expect(xlFit.widthEaseScale).toBeGreaterThan(lFit.widthEaseScale);
    expect(xsFit.hemDropLocal).toBeLessThan(0);
    expect(lFit.hemDropLocal).toBeGreaterThan(0.02);
  });
});
