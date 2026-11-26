export const HIGGS_CDN =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const SIGNATURE_BADGE_URL = `${BASE_PATH}/models/signature/badge.webp`;

export function H(file: string, w: number, q = 82): string {
  if (file.startsWith("ae:")) {
    const idx = file.slice(3);
    return w <= 360
      ? `${BASE_PATH}/models/runway_ai/ae_outfit_${idx}_thumb.webp?v=mod7`
      : `${BASE_PATH}/models/runway_ai/ae_outfit_${idx}_front.webp?v=mod7`;
  }
  if (file.startsWith("sig:")) {
    const idx = file.slice(4);
    return w <= 360
      ? `${BASE_PATH}/models/signature/look_${idx}_thumb.webp`
      : `${BASE_PATH}/models/signature/look_${idx}.webp`;
  }
  if (
    file.startsWith("data:") ||
    file.startsWith("http://") ||
    file.startsWith("https://") ||
    file.startsWith("/")
  ) {
    return file;
  }
  return (
    "https://images.higgs.ai/?default=1&output=webp&url=" +
    encodeURIComponent(HIGGS_CDN + file) +
    "&w=" +
    w +
    "&q=" +
    q
  );
}

export function H_BACK(file: string): string {
  if (file.startsWith("ae:")) {
    const idx = file.slice(3);
    return `${BASE_PATH}/models/runway_ai/ae_outfit_${idx}_back.webp?v=mod7`;
  }
  if (file.startsWith("sig:")) {
    const idx = file.slice(4);
    return `${BASE_PATH}/models/signature/look_${idx}_back.webp`;
  }
  return H(file, 900);
}

export const LOFT_BG_URL = `${BASE_PATH}/models/signature/loft_bg.webp`;

export interface PieceItem {
  id: string;
  name: string;
  color: string;
  price: number;
  group: "tops" | "bottoms" | "full" | "shoes" | "acc";
  lookIndex: number;
}

export interface StudioLook {
  index: number;
  name: string;
  category: "everyday" | "athletic" | "sleep" | "formal" | "party" | "street";
  file: string;
  productId?: string;
  relatedProductIds?: string[];
  friendOwner?: string;
  friendTwinPct?: number;
  pieces: {
    tops: Array<{ name: string; color: string; price: number }>;
    bottoms: Array<{ name: string; color: string; price: number }>;
    full: Array<{ name: string; color: string; price: number }>;
    shoes: Array<{ name: string; color: string; price: number }>;
    acc: Array<{ name: string; color: string; price: number }>;
  };
}

/**
 * 100% Pure AliExpress-Backed GWO Boutique Outfits (0..9) — Zero Demo/Starter Clothing!
 * Every outfit's pieces (including Bags, Belts & Shoes) match 1-to-1 with the lifelike avatar cutout.
 */
export const STUDIO_LOOKS: StudioLook[] = [
  {
    index: 0,
    name: "Espresso Corset",
    category: "party",
    file: "ae:0",
    productId: "prod-ae-espresso-corset",
    relatedProductIds: [
      "prod-ae-espresso-corset",
      "prod-ae-champagne-trousers",
      "prod-ae-noir-slingbacks",
      "prod-ae-burgundy-crescent-bag",
    ],
    friendOwner: "maya",
    friendTwinPct: 98,
    pieces: {
      tops: [{ name: "Sculpted Espresso Boned Satin Basque Corset Top", color: "Espresso Mocha", price: 52 }],
      bottoms: [{ name: "High-Waist Champagne Pleated Fluid Wide-Leg Trousers", color: "Champagne Oat", price: 54 }],
      full: [],
      shoes: [{ name: "Noir Patent Pointed-Toe Gold-Buckle Kitten Slingbacks", color: "Patent Noir", price: 56 }],
      acc: [{ name: "Deep Merlot Smooth Leather Crescent Shoulder Bag", color: "Deep Merlot", price: 46 }],
    },
  },
  {
    index: 1,
    name: "Bouclé Capsule",
    category: "formal",
    file: "ae:1",
    productId: "prod-ae-ivory-tweed-blazer",
    relatedProductIds: [
      "prod-ae-ivory-tweed-blazer",
      "prod-ae-acetate-beaded-tank",
      "prod-ae-noir-pleated-mini",
      "prod-ae-meotina-leather-boots",
      "prod-ae-camel-turnlock-tote",
    ],
    friendOwner: "chloe",
    friendTwinPct: 95,
    pieces: {
      tops: [
        { name: "Old-Money Ivory Bouclé Gold-Button Cropped Blazer", color: "Studio Ivory", price: 72 },
        { name: "Ivory Ribbed Lyocell-Acetate Crystal-Collar Tank Top", color: "Pearl Ivory", price: 48 },
      ],
      bottoms: [{ name: "Noir Belted Knife-Pleat Tailored Micro Mini Skirt", color: "Jet Noir", price: 42 }],
      full: [],
      shoes: [{ name: "Meotina Genuine Leather Split-Toe Block-Heel Knee Boots", color: "Obsidian Leather", price: 104 }],
      acc: [{ name: "Camel & Sage Gold-Turnlock Smooth Leather Trapezium Tote", color: "Warm Camel", price: 72 }],
    },
  },
  {
    index: 2,
    name: "Emerald Silk",
    category: "party",
    file: "ae:2",
    productId: "prod-ae-emerald-satin-midi",
    relatedProductIds: [
      "prod-ae-emerald-satin-midi",
      "prod-ae-gold-strappy-heels",
      "prod-ae-burgundy-crescent-bag",
    ],
    friendOwner: "maya",
    friendTwinPct: 97,
    pieces: {
      tops: [],
      bottoms: [],
      full: [{ name: "Emerald Bias-Cut Cowl-Neck Satin Midi Slip Dress", color: "Deep Emerald", price: 62 }],
      shoes: [{ name: "14k Champagne Metallic Square-Toe Strappy Stilettos", color: "14k Champagne Gold", price: 62 }],
      acc: [{ name: "Deep Merlot Smooth Leather Crescent Shoulder Bag", color: "Deep Merlot", price: 46 }],
    },
  },
  {
    index: 3,
    name: "Blazer Dress",
    category: "party",
    file: "ae:3",
    productId: "prod-ae-champagne-blazer-dress",
    relatedProductIds: [
      "prod-ae-champagne-blazer-dress",
      "prod-ae-gold-strappy-heels",
      "prod-ae-ivory-mini-bag",
    ],
    friendOwner: "sofia",
    friendTwinPct: 94,
    pieces: {
      tops: [],
      bottoms: [],
      full: [{ name: "Champagne Satin Boned Corset Lapel Blazer Mini Dress", color: "Champagne Blush", price: 76 }],
      shoes: [{ name: "14k Champagne Metallic Square-Toe Strappy Stilettos", color: "14k Champagne Gold", price: 62 }],
      acc: [{ name: "Pearl Ivory Sculpted Top-Handle Gold-Clasp Mini Bag", color: "Pearl Ivory", price: 52 }],
    },
  },
  {
    index: 4,
    name: "Camel Wool Edit",
    category: "formal",
    file: "ae:4",
    productId: "prod-ae-camel-silk-wool-coat",
    relatedProductIds: [
      "prod-ae-camel-silk-wool-coat",
      "prod-ae-acetate-beaded-tank",
      "prod-ae-champagne-trousers",
      "prod-ae-noir-slingbacks",
      "prod-ae-camel-turnlock-tote",
    ],
    friendOwner: "chloe",
    friendTwinPct: 96,
    pieces: {
      tops: [
        { name: "Espresso-Taupe Mulberry Silk & Camel Wool Belted Coat", color: "Espresso Taupe", price: 126 },
        { name: "Ivory Ribbed Lyocell-Acetate Crystal-Collar Tank Top", color: "Pearl Ivory", price: 48 },
      ],
      bottoms: [{ name: "High-Waist Champagne Pleated Fluid Wide-Leg Trousers", color: "Champagne Oat", price: 54 }],
      full: [],
      shoes: [{ name: "Noir Patent Pointed-Toe Gold-Buckle Kitten Slingbacks", color: "Patent Noir", price: 56 }],
      acc: [{ name: "Camel & Sage Gold-Turnlock Smooth Leather Trapezium Tote", color: "Warm Camel", price: 72 }],
    },
  },
  {
    index: 5,
    name: "Linen Off-Duty",
    category: "everyday",
    file: "ae:5",
    productId: "prod-ae-linen-cinch-cardigan",
    relatedProductIds: [
      "prod-ae-linen-cinch-cardigan",
      "prod-ae-acetate-beaded-tank",
      "prod-ae-noir-pleated-mini",
      "prod-ae-noir-slingbacks",
      "prod-ae-camel-turnlock-tote",
    ],
    friendOwner: "sofia",
    friendTwinPct: 93,
    pieces: {
      tops: [
        { name: "Oatmeal Open-Weave Belted Linen Shawl Knit Cardigan", color: "Oatmeal Linen", price: 68 },
        { name: "Ivory Ribbed Lyocell-Acetate Crystal-Collar Tank Top", color: "Pearl Ivory", price: 48 },
      ],
      bottoms: [{ name: "Noir Belted Knife-Pleat Tailored Micro Mini Skirt", color: "Jet Noir", price: 42 }],
      full: [],
      shoes: [{ name: "Noir Patent Pointed-Toe Gold-Buckle Kitten Slingbacks", color: "Patent Noir", price: 56 }],
      acc: [{ name: "Camel & Sage Gold-Turnlock Smooth Leather Trapezium Tote", color: "Warm Camel", price: 72 }],
    },
  },
  {
    index: 6,
    name: "Crimson Corset",
    category: "party",
    file: "ae:6",
    productId: "prod-ae-crimson-corset-mini",
    relatedProductIds: [
      "prod-ae-crimson-corset-mini",
      "prod-ae-gold-strappy-heels",
      "prod-ae-noir-quilted-bag",
    ],
    friendOwner: "maya",
    friendTwinPct: 98,
    pieces: {
      tops: [],
      bottoms: [],
      full: [{ name: "Crimson Boned Crepe Corset Draped Cowl Mini Dress", color: "Crimson Red", price: 68 }],
      shoes: [{ name: "14k Champagne Metallic Square-Toe Strappy Stilettos", color: "14k Champagne Gold", price: 62 }],
      acc: [{ name: "Noir Quilted Lambskin Gold-Chain Flap Shoulder Bag", color: "Jet Noir", price: 58 }],
    },
  },
  {
    index: 7,
    name: "Noir Blazer Denim",
    category: "everyday",
    file: "ae:7",
    productId: "prod-ae-noir-tailored-blazer",
    relatedProductIds: [
      "prod-ae-noir-tailored-blazer",
      "prod-ae-acetate-beaded-tank",
      "prod-ae-vintage-wide-denim",
      "prod-ae-gold-sculpted-belt",
      "prod-ae-noir-slingbacks",
      "prod-ae-burgundy-crescent-bag",
    ],
    friendOwner: "chloe",
    friendTwinPct: 95,
    pieces: {
      tops: [
        { name: "Oversized Noir Double-Breasted Satin-Lapel Suiting Blazer", color: "Jet Noir", price: 84 },
        { name: "Ivory Ribbed Lyocell-Acetate Crystal-Collar Tank Top", color: "Pearl Ivory", price: 48 },
      ],
      bottoms: [{ name: "High-Rise Washed Vintage Indigo Straight-Leg Jeans", color: "Vintage Indigo", price: 58 }],
      full: [],
      shoes: [{ name: "Noir Patent Pointed-Toe Gold-Buckle Kitten Slingbacks", color: "Patent Noir", price: 56 }],
      acc: [
        { name: "18k Gold-Buckle Smooth Calfskin Cincher Waist Belt", color: "Noir & 18k Gold", price: 34 },
        { name: "Deep Merlot Smooth Leather Crescent Shoulder Bag", color: "Deep Merlot", price: 46 },
      ],
    },
  },
  {
    index: 8,
    name: "Sage Sculpt Set",
    category: "athletic",
    file: "ae:8",
    productId: "prod-ae-sage-zip-jacket",
    relatedProductIds: [
      "prod-ae-sage-zip-jacket",
      "prod-ae-sage-flare-leggings",
      "prod-ae-cloud-platform-sneakers",
      "prod-ae-ivory-mini-bag",
    ],
    friendOwner: "maya",
    friendTwinPct: 98,
    pieces: {
      tops: [{ name: "Sage-Olive Contour Seam Mock-Neck Zip Studio Jacket", color: "Sage Olive", price: 46 }],
      bottoms: [{ name: "Sage-Olive Crossover High-Waist Petite Flare Leggings", color: "Sage Olive", price: 44 }],
      full: [],
      shoes: [{ name: "Cloud-White Smooth Leather Minimalist Platform Sneakers", color: "Cloud White", price: 64 }],
      acc: [{ name: "Pearl Ivory Sculpted Top-Handle Gold-Clasp Mini Bag", color: "Pearl Ivory", price: 52 }],
    },
  },
  {
    index: 9,
    name: "Corset & Denim",
    category: "street",
    file: "ae:9",
    productId: "prod-ae-espresso-corset",
    relatedProductIds: [
      "prod-ae-espresso-corset",
      "prod-ae-vintage-wide-denim",
      "prod-ae-meotina-leather-boots",
      "prod-ae-noir-quilted-bag",
    ],
    friendOwner: "sofia",
    friendTwinPct: 94,
    pieces: {
      tops: [{ name: "Sculpted Espresso Boned Satin Basque Corset Top", color: "Espresso Mocha", price: 52 }],
      bottoms: [{ name: "High-Rise Washed Vintage Indigo Straight-Leg Jeans", color: "Vintage Indigo", price: 58 }],
      full: [],
      shoes: [{ name: "Meotina Genuine Leather Split-Toe Block-Heel Knee Boots", color: "Obsidian Leather", price: 104 }],
      acc: [{ name: "Noir Quilted Lambskin Gold-Chain Flap Shoulder Bag", color: "Jet Noir", price: 58 }],
    },
  },
  {
    index: 10,
    name: "Blush & Ivory Satin",
    category: "party",
    file: "ae:10",
    productId: "prod-ae-blush-ruched-offshoulder",
    relatedProductIds: [
      "prod-ae-blush-ruched-offshoulder",
      "prod-ae-ivory-satin-bias-midi",
      "prod-ae-gold-strappy-heels",
      "prod-ae-ivory-mini-bag",
    ],
    friendOwner: "maya",
    friendTwinPct: 98,
    pieces: {
      tops: [{ name: "Blush-Rose Off-Shoulder Ruched Mesh Boned Corset Top", color: "Blush Rose", price: 46 }],
      bottoms: [{ name: "Pearl-Ivory High-Waist Bias-Cut Fluid Satin Midi Skirt", color: "Pearl Ivory", price: 54 }],
      full: [],
      shoes: [{ name: "14k Champagne Metallic Square-Toe Strappy Stilettos", color: "14k Champagne Gold", price: 62 }],
      acc: [{ name: "Pearl Ivory Sculpted Top-Handle Gold-Clasp Mini Bag", color: "Pearl Ivory", price: 52 }],
    },
  },
  {
    index: 11,
    name: "Noir Halter Pinstripe",
    category: "formal",
    file: "ae:11",
    productId: "prod-ae-noir-halter-vest",
    relatedProductIds: [
      "prod-ae-noir-halter-vest",
      "prod-ae-charcoal-pinstripe-trousers",
      "prod-ae-gold-sculpted-belt",
      "prod-ae-noir-slingbacks",
      "prod-ae-noir-quilted-bag",
    ],
    friendOwner: "chloe",
    friendTwinPct: 97,
    pieces: {
      tops: [{ name: "Jet-Noir Open-Back Tailored Suiting Halter Waistcoat Vest", color: "Jet Noir", price: 52 }],
      bottoms: [{ name: "Charcoal Pinstripe High-Waist Pleated Wide-Leg Trousers", color: "Charcoal Pinstripe", price: 58 }],
      full: [],
      shoes: [{ name: "Noir Patent Pointed-Toe Gold-Buckle Kitten Slingbacks", color: "Patent Noir", price: 56 }],
      acc: [
        { name: "18k Gold-Buckle Smooth Calfskin Cincher Waist Belt", color: "Noir & 18k Gold", price: 34 },
        { name: "Noir Quilted Lambskin Gold-Chain Flap Shoulder Bag", color: "Jet Noir", price: 58 },
      ],
    },
  },
  {
    index: 12,
    name: "Midnight Cobalt Mini",
    category: "party",
    file: "ae:12",
    productId: "prod-ae-cobalt-draped-mini",
    relatedProductIds: [
      "prod-ae-cobalt-draped-mini",
      "prod-ae-silver-crystal-heels",
      "prod-ae-silver-metallic-shoulder-bag",
    ],
    friendOwner: "maya",
    friendTwinPct: 98,
    pieces: {
      tops: [],
      bottoms: [],
      full: [{ name: "Midnight-Cobalt Asymmetric Draped Satin Cocktail Mini Dress", color: "Midnight Cobalt", price: 68 }],
      shoes: [{ name: "Liquid-Silver Crystal-Bow Pointed Kitten Slingback Heels", color: "Liquid Silver", price: 64 }],
      acc: [{ name: "Liquid-Silver Ruched Metallic Leather Crescent Shoulder Bag", color: "Liquid Silver", price: 50 }],
    },
  },
  {
    index: 13,
    name: "Merlot Leather Trench",
    category: "street",
    file: "ae:13",
    productId: "prod-ae-burgundy-leather-trench",
    relatedProductIds: [
      "prod-ae-burgundy-leather-trench",
      "prod-ae-butter-silk-cami",
      "prod-ae-espresso-tailored-shorts",
      "prod-ae-meotina-leather-boots",
      "prod-ae-burgundy-crescent-bag",
    ],
    friendOwner: "sofia",
    friendTwinPct: 96,
    pieces: {
      tops: [
        { name: "Deep Merlot Belted Faux-Leather Cropped Moto Trench Jacket", color: "Deep Merlot", price: 86 },
        { name: "Buttercream Cowl-Neck Mulberry Satin Camisole Top", color: "Buttercream Silk", price: 44 },
      ],
      bottoms: [{ name: "Espresso High-Waist Double-Pleat Tailored Suiting Shorts", color: "Espresso Mocha", price: 46 }],
      full: [],
      shoes: [{ name: "Meotina Genuine Leather Split-Toe Block-Heel Knee Boots", color: "Obsidian Leather", price: 104 }],
      acc: [{ name: "Deep Merlot Smooth Leather Crescent Shoulder Bag", color: "Deep Merlot", price: 46 }],
    },
  },
  {
    index: 14,
    name: "Buttercream Lace & Mink",
    category: "party",
    file: "ae:14",
    productId: "prod-ae-butter-lace-slip-midi",
    relatedProductIds: [
      "prod-ae-cream-cropped-fur-jacket",
      "prod-ae-butter-lace-slip-midi",
      "prod-ae-gold-strappy-heels",
      "prod-ae-camel-turnlock-tote",
    ],
    friendOwner: "chloe",
    friendTwinPct: 97,
    pieces: {
      tops: [{ name: "Pearl-Cream Plush Faux-Mink Cropped Evening Bolero Jacket", color: "Pearl Cream", price: 78 }],
      bottoms: [],
      full: [{ name: "Buttercream Chantilly-Lace V-Neck Bias Satin Midi Dress", color: "Buttercream Ivory", price: 66 }],
      shoes: [{ name: "14k Champagne Metallic Square-Toe Strappy Stilettos", color: "14k Champagne Gold", price: 62 }],
      acc: [{ name: "Camel & Sage Gold-Turnlock Smooth Leather Trapezium Tote", color: "Warm Camel", price: 72 }],
    },
  },
  {
    index: 15,
    name: "Silk Cami & Tailored Shorts",
    category: "everyday",
    file: "ae:15",
    productId: "prod-ae-butter-silk-cami",
    relatedProductIds: [
      "prod-ae-butter-silk-cami",
      "prod-ae-espresso-tailored-shorts",
      "prod-ae-burgundy-patent-heels",
      "prod-ae-burgundy-crescent-bag",
    ],
    friendOwner: "maya",
    friendTwinPct: 97,
    pieces: {
      tops: [{ name: "Buttercream Cowl-Neck Mulberry Satin Camisole Top", color: "Buttercream Silk", price: 44 }],
      bottoms: [{ name: "Espresso High-Waist Double-Pleat Tailored Suiting Shorts", color: "Espresso Mocha", price: 46 }],
      full: [],
      shoes: [{ name: "Deep Merlot Glossy Patent Ankle-Strap Pointed Stilettos", color: "Merlot Patent", price: 60 }],
      acc: [{ name: "Deep Merlot Smooth Leather Crescent Shoulder Bag", color: "Deep Merlot", price: 46 }],
    },
  },
];

export const ACCESSORY_CATALOG = [
  {
    id: "prod-ae-burgundy-crescent-bag",
    name: "Deep Merlot Smooth Leather Crescent Shoulder Bag",
    color: "Deep Merlot",
    price: 46,
    x: 64,
    y: 36,
  },
  {
    id: "prod-ae-camel-turnlock-tote",
    name: "Camel & Sage Gold-Turnlock Smooth Leather Trapezium Tote",
    color: "Warm Camel",
    price: 72,
    x: 34,
    y: 56,
  },
  {
    id: "prod-ae-noir-quilted-bag",
    name: "Noir Quilted Lambskin Gold-Chain Flap Shoulder Bag",
    color: "Jet Noir",
    price: 58,
    x: 64,
    y: 44,
  },
  {
    id: "prod-ae-ivory-mini-bag",
    name: "Pearl Ivory Sculpted Top-Handle Gold-Clasp Mini Bag",
    color: "Pearl Ivory",
    price: 52,
    x: 34,
    y: 56,
  },
  {
    id: "prod-ae-gold-sculpted-belt",
    name: "18k Gold-Buckle Smooth Calfskin Cincher Waist Belt",
    color: "Noir & 18k Gold",
    price: 34,
    x: 50,
    y: 42,
  },
];
