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

describe("Universal 96-Frame Higgsfield 360° Turntable Engine (Store Pulls, URL Submits & Custom Avatars)", () => {
  it("resolves customer-submitted external URL dresses, blazers, leggings, and bags to 96-frame Higgsfield MP4 turntables", () => {
    expect(NUM_TURNTABLE_FRAMES).toBe(96);

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
    expect(slipSpec.mp4Url).toContain("ae_outfit_2_360.mp4");
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
});
