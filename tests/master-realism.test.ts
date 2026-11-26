import { describe, expect, it } from "vitest";
import {
  MASTER_AVATAR_ANATOMY_STANDARD,
  MASTER_FABRIC_PHYSICS_PROFILES,
  MASTER_IMMERSIVE_LIGHTING_PRESETS,
  MASTER_SLOT_Z_CLEARANCE_MM,
  auditMasterCatalogRealism,
  certifyAvatarRealism,
  certifyClothingItemRealism,
  computePhysicalEaseExpansionMeters,
  enforceRealisticAvatarAnatomy,
  resolveGarmentFabricPhysics,
} from "@/lib/realism/master-avatar-clothing-realism";
import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import { Product } from "@/lib/types";

const INITIAL_PRODUCTS: Product[] = buildTopLineAliExpressDropshipCatalog(2.85);

describe("GWO Master Avatar & Clothing Realism Authority", () => {
  const baselineDims = {
    heightInches: 64,
    shoulderInches: 15.2,
    bustInches: 36,
    waistInches: 27.5,
    hipsInches: 38.5,
    shoeSize: "8",
  };

  it("enforces realistic human proportions and locks craniofacial 1:1 aspect", () => {
    expect(MASTER_AVATAR_ANATOMY_STANDARD.craniofacialLockNormY).toBeCloseTo(
      0.848,
      3
    );

    const extreme = enforceRealisticAvatarAnatomy({
      heightInches: 95,
      shoulderInches: 25,
      bustInches: 32,
      waistInches: 39,
      hipsInches: 30,
      shoeSize: "8",
    });

    expect(extreme.heightInches).toBeLessThanOrEqual(73);
    expect(extreme.shoulderInches).toBeLessThanOrEqual(18.4);
    expect(extreme.waistInches).toBeLessThanOrEqual(
      extreme.bustInches * MASTER_AVATAR_ANATOMY_STANDARD.bounds.maxWaistToBustRatio + 0.1
    );
    expect(extreme.hipsInches).toBeGreaterThanOrEqual(
      extreme.waistInches * MASTER_AVATAR_ANATOMY_STANDARD.bounds.minHipToWaistRatio - 0.1
    );

    const cert = certifyAvatarRealism(baselineDims);
    expect(cert.realismScorePct).toBe(100);
    expect(cert.gates.craniofacialAspectLocked1To1).toBe(true);
    expect(cert.gates.dualSubmeshBodyAndHairActive).toBe(true);
  });

  it("certifies 100% of store SKUs across all 7 physical & 3D realism gates", () => {
    expect(INITIAL_PRODUCTS.length).toBeGreaterThanOrEqual(36);
    const audit = auditMasterCatalogRealism(INITIAL_PRODUCTS, baselineDims);

    expect(audit.totalItems).toBe(INITIAL_PRODUCTS.length);
    expect(audit.certifiedCount).toBe(INITIAL_PRODUCTS.length);
    expect(audit.averageRealismPct).toBeGreaterThanOrEqual(98);

    for (const itemCert of audit.itemCertifications) {
      expect(itemCert.passedAllGates).toBe(true);
      expect(itemCert.gates.isolatedTransparentCutout).toBe(true);
      expect(itemCert.gates.wearable3DGlbReady).toBe(true);
      expect(itemCert.gates.standalone3DGlbReady).toBe(true);
      expect(itemCert.gates.antiClippingZClearanceValid).toBe(true);
      expect(itemCert.gates.pbrFabricOpticsCalibrated).toBe(true);
      expect(itemCert.gates.inchSizeChartCalibrated).toBe(true);
      expect(itemCert.gates.full360OrbitCertified).toBe(true);
    }
  });

  it("maintains strictly increasing Z-clearance shells from footwear/tops to outerwear/bags", () => {
    expect(MASTER_SLOT_Z_CLEARANCE_MM.shoes).toBeLessThan(
      MASTER_SLOT_Z_CLEARANCE_MM.top
    );
    expect(MASTER_SLOT_Z_CLEARANCE_MM.top).toBeLessThan(
      MASTER_SLOT_Z_CLEARANCE_MM.bottom
    );
    expect(MASTER_SLOT_Z_CLEARANCE_MM.bottom).toBeLessThan(
      MASTER_SLOT_Z_CLEARANCE_MM.belt
    );
    expect(MASTER_SLOT_Z_CLEARANCE_MM.belt).toBeLessThan(
      MASTER_SLOT_Z_CLEARANCE_MM.outerwear
    );
    expect(MASTER_SLOT_Z_CLEARANCE_MM.outerwear).toBeLessThan(
      MASTER_SLOT_Z_CLEARANCE_MM.bag
    );
  });

  it("maps fabrics to calibrated PBR profiles and expands radial drape ease when sizing up", () => {
    expect(Object.keys(MASTER_FABRIC_PHYSICS_PROFILES).length).toBe(10);
    expect(Object.keys(MASTER_IMMERSIVE_LIGHTING_PRESETS).length).toBe(4);

    const silkDress = INITIAL_PRODUCTS.find((p) =>
      p.id.includes("emerald-satin-midi")
    )!;
    const fabric = resolveGarmentFabricPhysics(silkDress);
    expect(fabric.id).toBe("mulberry_silk_charmeuse");

    const snugCert = certifyClothingItemRealism(silkDress, baselineDims, "XS");
    const roomyCert = certifyClothingItemRealism(silkDress, baselineDims, "L");
    const snugEase = computePhysicalEaseExpansionMeters(
      snugCert.fitReport,
      fabric,
      false
    );
    const roomyEase = computePhysicalEaseExpansionMeters(
      roomyCert.fitReport,
      fabric,
      false
    );
    expect(roomyEase).toBeGreaterThanOrEqual(snugEase);
  });
});
