export const HIGGS_CDN =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/";

export function H(file: string, w: number, q = 82): string {
  return (
    "https://images.higgs.ai/?default=1&output=webp&url=" +
    encodeURIComponent(HIGGS_CDN + file) +
    "&w=" +
    w +
    "&q=" +
    q
  );
}

export const LOFT_BG_FILE =
  "hf_20261112_034551_6394b127-5366-40a8-9c82-3c416f1161f1.png";
export const LOFT_BG_URL = H(LOFT_BG_FILE, 1600, 80);

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

export const STUDIO_LOOKS: StudioLook[] = [
  {
    index: 0,
    name: "Denim Maxi",
    category: "everyday",
    file: "hf_20261112_034542_a6430ecf-9862-412c-8ef6-5745115bd78c.png",
    friendOwner: "maya",
    friendTwinPct: 97,
    pieces: {
      tops: [{ name: "Ribbed crop tank", color: "Charcoal", price: 38 }],
      bottoms: [{ name: "Washed denim maxi skirt", color: "Light wash", price: 96 }],
      full: [],
      shoes: [{ name: "Knee-high leather boots", color: "Black", price: 210 }],
      acc: [
        { name: "Leather belt", color: "Black", price: 42 },
        { name: "Gold hoops", color: "14k", price: 64 },
      ],
    },
  },
  {
    index: 1,
    name: "Cloud Set",
    category: "everyday",
    file: "hf_20261112_034738_73282737-acc8-41e9-a822-96c663e27b6c.png",
    friendOwner: "maya",
    friendTwinPct: 97,
    pieces: {
      tops: [{ name: "Half-zip sweatshirt", color: "Oat", price: 74 }],
      bottoms: [{ name: "Wide sweatpants", color: "Oat", price: 68 }],
      full: [],
      shoes: [{ name: "Chunky sneakers", color: "White", price: 120 }],
      acc: [{ name: "Gold hoops", color: "14k", price: 64 }],
    },
  },
  {
    index: 2,
    name: "Library Knit",
    category: "everyday",
    file: "hf_20261112_034742_9a8a92fd-79ae-4163-9ffa-14ae2a68717f.png",
    friendOwner: "chloe",
    friendTwinPct: 86,
    pieces: {
      tops: [
        { name: "Cable-knit cardigan", color: "Cream", price: 112 },
        { name: "Cotton tee", color: "White", price: 24 },
      ],
      bottoms: [{ name: "Pleated wide trousers", color: "Heather grey", price: 98 }],
      full: [],
      shoes: [{ name: "Penny loafers", color: "Brown", price: 150 }],
      acc: [],
    },
  },
  {
    index: 3,
    name: "Lilac Run",
    category: "athletic",
    file: "hf_20261112_034735_4e352e03-ad2b-44d1-9fcf-4b5b9454dc55.png",
    friendOwner: "maya",
    friendTwinPct: 97,
    pieces: {
      tops: [
        { name: "Zip training jacket", color: "Lilac", price: 88 },
        { name: "Sports crop top", color: "Lilac", price: 44 },
      ],
      bottoms: [{ name: "High-rise leggings", color: "Lilac", price: 72 }],
      full: [],
      shoes: [{ name: "Running sneakers", color: "White", price: 140 }],
      acc: [],
    },
  },
  {
    index: 4,
    name: "Satin Night",
    category: "sleep",
    file: "hf_20261112_034738_aeb8ea57-6399-4f3c-b54a-4a57d0bd971e.png",
    friendOwner: "sofia",
    friendTwinPct: 88,
    pieces: {
      tops: [{ name: "Satin pyjama shirt", color: "Powder blue", price: 66 }],
      bottoms: [{ name: "Satin pyjama trousers", color: "Powder blue", price: 58 }],
      full: [],
      shoes: [{ name: "Fluffy slippers", color: "Ivory", price: 34 }],
      acc: [],
    },
  },
  {
    index: 5,
    name: "Night Suit",
    category: "formal",
    file: "hf_20261112_034736_aace5c5f-8c14-4b00-83ba-744dbad2e337.png",
    friendOwner: "chloe",
    friendTwinPct: 86,
    pieces: {
      tops: [
        { name: "Oversized blazer", color: "Black", price: 240 },
        { name: "Silk camisole", color: "Ivory", price: 82 },
      ],
      bottoms: [{ name: "Straight suit trousers", color: "Black", price: 160 }],
      full: [],
      shoes: [{ name: "Pointed heels", color: "Black", price: 190 }],
      acc: [],
    },
  },
  {
    index: 6,
    name: "Sage Slip",
    category: "party",
    file: "hf_20261112_034735_3d9fb69e-b4e0-49f7-a2d4-e592bd616c27.png",
    friendOwner: "chloe",
    friendTwinPct: 86,
    pieces: {
      tops: [],
      bottoms: [],
      full: [{ name: "Satin slip midi dress", color: "Sage", price: 180 }],
      shoes: [{ name: "Strappy sandals", color: "Silver", price: 130 }],
      acc: [{ name: "Fine chain necklace", color: "Silver", price: 56 }],
    },
  },
  {
    index: 7,
    name: "Bomber Cargo",
    category: "street",
    file: "hf_20261112_034740_3e3c5ad7-689b-46a2-8e09-c7d36a569b9c.png",
    friendOwner: "sofia",
    friendTwinPct: 88,
    pieces: {
      tops: [
        { name: "Leather bomber", color: "Black", price: 260 },
        { name: "Crop tee", color: "White", price: 22 },
      ],
      bottoms: [{ name: "Parachute cargo pants", color: "Khaki", price: 94 }],
      full: [],
      shoes: [{ name: "Platform sneakers", color: "Black", price: 150 }],
      acc: [],
    },
  },
];

export const IDENTITIES = [
  { name: "Han Seo-yeon", age: 23, city: "Seoul, KR", temp: "14°C" },
  { name: "Kim Ha-eun", age: 22, city: "Busan, KR", temp: "17°C" },
  { name: "Yoon Ji-woo", age: 25, city: "Seoul, KR", temp: "12°C" },
  { name: "Park Min-ji", age: 24, city: "Incheon, KR", temp: "13°C" },
  { name: "Lee Soo-ah", age: 21, city: "Daegu, KR", temp: "15°C" },
];

export const SCENE_FILTERS = [
  { name: "Daylight", grade: "none", tint: "transparent" },
  {
    name: "Soft Film",
    grade: "contrast(.92) saturate(.85) brightness(1.06)",
    tint: "linear-gradient(180deg, rgba(255,226,214,.35), rgba(180,200,220,.35))",
  },
  {
    name: "Cool Studio",
    grade: "saturate(.9) brightness(1.06) contrast(1.04)",
    tint: "linear-gradient(180deg, rgba(150,190,255,.55), rgba(200,220,225,.3))",
  },
  {
    name: "Blue Hour",
    grade: "brightness(.82) contrast(1.1) saturate(1.1)",
    tint: "linear-gradient(180deg, rgba(70,60,170,.75), rgba(150,90,170,.55))",
  },
  {
    name: "Mono",
    grade: "grayscale(1) contrast(1.12) brightness(1.03)",
    tint: "transparent",
  },
  {
    name: "Golden Hour",
    grade: "saturate(1.1) brightness(1.02)",
    tint: "linear-gradient(180deg, rgba(255,180,90,.6), rgba(255,140,80,.4))",
  },
];

export const ACCESSORY_CATALOG = [
  { id: "acc-hoops", name: "Gold hoops", color: "14k Gold", price: 64, x: 55, y: 11 },
  { id: "acc-chain", name: "Silver chain", color: "Sterling", price: 56, x: 50, y: 17 },
  { id: "acc-bag", name: "Shoulder bag", color: "Espresso Leather", price: 195, x: 64, y: 36 },
  { id: "acc-shades", name: "Sunglasses", color: "Tortoise Acetate", price: 145, x: 50, y: 7 },
  { id: "acc-watch", name: "Watch", color: "Brushed Steel", price: 220, x: 34, y: 49 },
  { id: "acc-clip", name: "Hair clip", color: "Pearl Claw", price: 28, x: 47, y: 4 },
];

export const PERSONALITY_TRAITS = [
  "Curious",
  "Bold",
  "Calm",
  "Witty",
  "Romantic",
  "Driven",
  "Playful",
  "Gentle",
  "Creative",
  "Loyal",
];
