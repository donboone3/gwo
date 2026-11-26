# GWO Master Avatar & Clothing Realism Specification (`MASTER_REALISM_SPEC.md`)

> **Runtime Authority File:** [`src/lib/realism/master-avatar-clothing-realism.ts`](./src/lib/realism/master-avatar-clothing-realism.ts)  
> **Enforced By:** [`src/lib/three/glb-character-engine.ts`](./src/lib/three/glb-character-engine.ts), [`src/components/three/Interactive3DAvatarStage.tsx`](./src/components/three/Interactive3DAvatarStage.tsx), [`src/components/product/GwoSpinProduct.tsx`](./src/components/product/GwoSpinProduct.tsx), [`src/components/admin/GwoMerchantAdmin.tsx`](./src/components/admin/GwoMerchantAdmin.tsx), and [`tests/master-realism.test.ts`](./tests/master-realism.test.ts)

This master document and its executable TypeScript counterpart guarantee that **every 3D human character avatar** and **every 3D clothing, footwear, belt, and handbag item** in GWO renders with true-to-life human proportions, calibrated US inch fit accuracy, physically based fabric optics, and immersive 360° boutique lighting.

---

## 1. Lifelike 3D Human Character Rules (`avatar_character.glb`)

1. **Zero Mannequins / Zero Flat Photo Swaps:** The avatar is always a persistent Three.js WebGL 3D human character (`public/models/glb/avatar_character.glb`) composed of two dedicated submeshes:
   - `AvatarBody` (`OPAQUE`): True-proportion cranium & coronal facial plane, slender neck, sloping trapezius/deltoid shoulders, welded arms/hands, sculpted torso/pelvis, and dainty legs/feet with Subsurface Scattering (SSS) warm skin wrap lighting.
   - `AvatarHair` (`MASK`): 3D layered wavy espresso hair mantle draping naturally around the crown, temples, neck, and collarbones without distorting neck or shoulder geometry.
2. **1.000:1.000 Craniofacial Lock (`craniofacialLockNormY = 0.848`):** Scaling height, shoulders, bust, waist, or hips on the GPU strictly preserves `1:1` facial aspect ratio above `yn = 0.848` so facial features never stretch or compress.
3. **Human Proportion Guardrails (`enforceRealisticAvatarAnatomy`):** Clamps and couples height (`58"–73"`), bust (`29"–46"`), waist (`22"–40"`), hips (`31"–49"`), and shoulders (`13.4"–18.4"`) to realistic human anthropometry.

---

## 2. Physical 3D Garment, Fabric & Fit Accuracy Rules

1. **Dual 3D `.glb` Asset Contract:** Every catalog SKU (`36/36`) ships with:
   - A **Standalone 3D Item Mesh** (`public/models/glb/standalone/<sku>.glb`) + studio WebGL render (`public/models/items_3d/<sku>.webp`) with `alpha = 0` isolated background.
   - A **Conformal Wearable 3D Mesh** (`public/models/glb/items/<sku>.glb`) calibrated in the character's exact coordinate space.
   - Any external URL or uploaded closet photo is automatically converted at runtime via `isolateProductBackgroundClient()` + `buildRuntime3DItemPrototype()`.
2. **10 Calibrated PBR Fabric Archetypes (`MASTER_FABRIC_PHYSICS_PROFILES`):**
   - `Mulberry Silk Charmeuse`, `Boned Duchesse Satin`, `Bouclé & Savile Tailored Weave`, `13.5oz Organic Vintage Denim`, `Double-Faced Wool & Faux-Fur`, `Sculpting Lyocell-Elastane Knit`, `Artisanal Combed Flax Linen`, `Full-Grain & Nappa Calfskin`, `Patent Lacquer & Metallic Kidskin`, and `18k Gold-Plated Hardware`.
3. **Anti-Clipping Radial Shell Z-Clearance (`MASTER_SLOT_Z_CLEARANCE_MM`):**
   - `shoes (2.8mm) < top (4.8mm) < dress (7.0mm) < bottom (7.4mm) < belt (9.8mm) < outerwear (13.4mm) < bag (42.0mm)`.
4. **Live Size-Ease GPU Drape (`computePhysicalEaseExpansionMeters`):** Selecting `XS`, `S`, `M`, or `L` dynamically adjusts radial ease on the 3D garment mesh and updates the Bust/Waist/Hip Fit Heatmap in real time.

---

## 3. Photometric Boutique Lighting & 7-Gate Certification

1. **Albedo-Preserving Photometric Exposure (`0.92–0.96`):** Prevents highlight blowout on warm human skin and satin/tweed textures across four selectable boutique lighting moods (`Editorial Daylight`, `Golden Hour Atelier`, `Paris Runway Spotlight`, `Candlelit Evening Soirée`).
2. **7-Gate Automated Certification (`auditMasterCatalogRealism`):** Every SKU must pass all 7 realism gates in `tests/master-realism.test.ts` and `/admin` before release.
