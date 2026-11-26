import { describe, expect, it } from "vitest";
import {
  buildParametric3DFitScene,
  ellipseAxesFromCircumference,
} from "../src/lib/catalog/parametric-3d-garment";
import { parseShopifyJsonProduct } from "../src/lib/catalog/client-url-scraper";
import { INITIAL_SEED_DB } from "../src/lib/db/seed-data";
import { deriveFullBodyDimensionsFromProfile } from "../src/lib/three/body-scan-analyzer";
import {
  buildInteractive3DAvatarScene,
  buildStandalone3DProductScene,
  solveEllipseSemiAxesUnits,
} from "../src/lib/three/parametric-3d-engine";

function numericEllipsePerimeter(a: number, b: number, steps = 720): number {
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const u0 = (i / steps) * Math.PI * 2;
    const u1 = ((i + 1) / steps) * Math.PI * 2;
    const dx = Math.cos(u1) * a - Math.cos(u0) * a;
    const dz = Math.sin(u1) * b - Math.sin(u0) * b;
    sum += Math.hypot(dx, dz);
  }
  return sum;
}

describe("3D Parametric Body & Garment Fit Engine + Direct Shopify JSON Parser", () => {
  it("recovers exact anatomical circumferences (32.25 B, 27 W, 34 H) within <0.15 inch", () => {
    for (const [circ, k] of [
      [32.25, 0.79],
      [27.0, 0.68],
      [34.0, 0.73],
    ] as const) {
      const { a, b } = ellipseAxesFromCircumference(circ, k);
      const measured = numericEllipsePerimeter(a, b);
      expect(Math.abs(measured - circ)).toBeLessThan(0.02);
    }
  });

  it("models Size S as tailored fit and Size XS as rigid waist pinch on 5'2\" (32.25/27/34) avatar for Crimson Corset Mini Dress + builds Three.js 3D Avatar & 3D Product meshes", () => {
    const avatar = INITIAL_SEED_DB.profiles[0];
    const crimsonDress = INITIAL_SEED_DB.products.find(
      (p) => p.id === "prod-ae-crimson-corset-mini"
    )!;
    const bag = INITIAL_SEED_DB.products.find(
      (p) => p.id === "prod-ae-noir-quilted-bag"
    )!;
    const heels = INITIAL_SEED_DB.products.find(
      (p) => p.id === "prod-ae-gold-strappy-heels"
    )!;
    expect(crimsonDress).toBeDefined();

    const sceneS = buildParametric3DFitScene({
      avatar,
      product: crimsonDress,
      selectedSize: "S",
    });
    expect(sceneS.hasCorsetBack).toBe(true);
    expect(sceneS.quads.length).toBeGreaterThan(800);
    expect(sceneS.storeModelRelativeHemYInches).toBeDefined();
    expect(sceneS.customerHemYInches).toBeLessThan(
      sceneS.storeModelRelativeHemYInches!
    );

    const waistS = sceneS.caliperRings.find((r) => r.label === "Waist")!;
    expect(waistS.status).not.toBe("too_tight");

    const sceneXS = buildParametric3DFitScene({
      avatar,
      product: crimsonDress,
      selectedSize: "XS",
    });
    const waistXS = sceneXS.caliperRings.find((r) => r.label === "Waist")!;
    expect(waistXS.status).toBe("too_tight");

    // Verify Three.js WebGL Parametric 3D Body + Held 3D Bag + Standalone 3D Product Object
    const dims = deriveFullBodyDimensionsFromProfile(avatar, null);
    const semi = solveEllipseSemiAxesUnits(27.0, 1.32);
    expect(numericEllipsePerimeter(semi.rx * 10, semi.rz * 10)).toBeCloseTo(27.0, 1);

    const avatar3D = buildInteractive3DAvatarScene({
      dimensions: dims,
      wornPieces: [
        { product: crimsonDress, selectedSize: "S" },
        { product: heels, selectedSize: "7.5" },
        { product: bag },
      ],
      visualMode: "heatmap",
      showMeasurementRings: true,
    });
    expect(avatar3D.interactiveMeshes.length).toBeGreaterThanOrEqual(6);
    expect(avatar3D.fitByProductId.get(crimsonDress.id)?.recommendedSize).toBe("S");

    const standaloneBag = buildStandalone3DProductScene({
      product: bag,
      dimensions: dims,
    });
    expect(standaloneBag.cameraDistance).toBeGreaterThan(1.0);
  });

  it("parses raw Shopify /products/<handle>.json payloads into exact-fit GWO Products", () => {
    const parsed = parseShopifyJsonProduct(
      {
        id: 889900,
        title: "Cornelia Mini Dress - Red",
        handle: "cornelia-mini-dress-red",
        product_type: "Mini Dresses",
        tags: ["Corset", "Mini", "Red"],
        body_html:
          "<p>Structured non-stretch crepe corset mini dress with lace-up back and adjustable straps.</p><ul><li>X-Small: 22.4in</li><li>Small: 22.8in</li><li>Model wears XS • 170cm</li></ul>",
        variants: [
          { title: "XS", price: "199.95", available: true },
          { title: "S", price: "199.95", available: true },
          { title: "M", price: "199.95", available: true },
        ],
        images: [
          { src: "https://cdn.shopify.com/s/files/1/cornelia_front.jpg", alt: "Model Front" },
          { src: "https://cdn.shopify.com/s/files/1/cornelia_back.jpg", alt: "Back View" },
        ],
      },
      "babyboofashion-com-au.myshopify.com",
      "https://babyboofashion-com-au.myshopify.com"
    );

    expect(parsed.brand).toBe("Babyboo Fashion");
    expect(parsed.price).toBe(132);
    expect(parsed.colorHex).toBe("#C80815");
    expect(parsed.category).toBe("dress");
    expect(parsed.fitMetadata?.hasAdjustableBack).toBe(true);
    expect(parsed.fitMetadata?.garmentLengthBySizeInches?.XS).toBe(22.4);
    expect(parsed.fitMetadata?.garmentLengthBySizeInches?.S).toBe(22.8);
    expect(parsed.fitMetadata?.galleryImages?.length).toBe(2);
  });
});
