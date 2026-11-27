import { describe, expect, it } from "vitest";
import {
  NUM_TURNTABLE_FRAMES,
  resolveTurntableSpecForOutfit,
} from "@/lib/three/higgsfield-turntable-engine";
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
    expect(slipSpec.atlasUrl).toContain("ae_outfit_2_hd_a.webp");
    expect(slipSpec.atlasUrlB).toContain("ae_outfit_2_hd_b.webp");
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

    // Focusing on Silver Metallic Shoulder Bag in Closet routes cleanly to pure photographed Outfit 12!
    const bagFocusSpec = resolveTurntableSpecForOutfit(
      [corset, pleatedMini, silverBag],
      [corset, pleatedMini, silverBag],
      { focusProductId: silverBag.id }
    );
    expect(bagFocusSpec.lookIdx).toBe(12);
    expect(bagFocusSpec.colorwayShifts).toBeUndefined();

    // Focusing on Noir Pleated Mini Skirt routes cleanly to pure photographed Outfit 1!
    const miniFocusSpec = resolveTurntableSpecForOutfit(
      [corset, pleatedMini],
      [corset, pleatedMini],
      { focusProductId: pleatedMini.id }
    );
    expect(miniFocusSpec.lookIdx).toBe(1);

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
  });
});
