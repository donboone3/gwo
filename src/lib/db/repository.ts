import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  AffiliateClick,
  ClosetItem,
  ComputeBudgetLedger,
  EnrichedClosetItem,
  LocalDatabaseSchema,
  Product,
  TryOnRender,
  UserProfile,
} from "../types";
import { INITIAL_SEED_DB } from "./seed-data";

const DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_DB_PATH = path.join(DATA_DIR, "local-db.json");

let memoryFallback: LocalDatabaseSchema | null = null;

function cloneSeed(): LocalDatabaseSchema {
  return JSON.parse(JSON.stringify(INITIAL_SEED_DB)) as LocalDatabaseSchema;
}

export function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function readLocalDb(): LocalDatabaseSchema {
  if (process.env.VITEST) {
    if (!memoryFallback) memoryFallback = cloneSeed();
    return memoryFallback;
  }
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
      const parsed = JSON.parse(raw) as LocalDatabaseSchema;
      // Sync localized WebP asset paths & pure AliExpress seed catalog onto persisted local DB
      const seedById = new Map(INITIAL_SEED_DB.products.map((p) => [p.id, p]));
      parsed.products = parsed.products
        .filter(
          (p) =>
            seedById.has(p.id) ||
            (p.sourceType !== "affiliate_feed" &&
              p.id !== "prod-babyboo-cornelia-red")
        )
        .map((p) => {
          const seedMatch = seedById.get(p.id);
          if (!seedMatch) return p;
          return {
            ...p,
            imageUrl: seedMatch.imageUrl,
            studioLookIndex: seedMatch.studioLookIndex ?? p.studioLookIndex,
            fitMetadata: seedMatch.fitMetadata ?? p.fitMetadata,
            availableSizes: seedMatch.availableSizes ?? p.availableSizes,
            sizeChartInches: seedMatch.sizeChartInches ?? p.sizeChartInches,
            sourceType: seedMatch.sourceType ?? p.sourceType,
            dropship: seedMatch.dropship ?? p.dropship,
          };
        });
      const existingIds = new Set(parsed.products.map((p) => p.id));
      for (const sp of INITIAL_SEED_DB.products) {
        if (!existingIds.has(sp.id)) {
          parsed.products.push(sp);
          existingIds.add(sp.id);
        }
      }
      parsed.closetItems = INITIAL_SEED_DB.closetItems.filter((ci) =>
        existingIds.has(ci.productId)
      );
      return parsed;
    }
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const seeded = cloneSeed();
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(seeded, null, 2), "utf-8");
    return seeded;
  } catch {
    if (!memoryFallback) memoryFallback = cloneSeed();
    return memoryFallback;
  }
}

export function writeLocalDb(db: LocalDatabaseSchema): void {
  if (process.env.VITEST) {
    memoryFallback = db;
    return;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch {
    memoryFallback = db;
  }
}

export function resetTestMemoryDb(): void {
  memoryFallback = cloneSeed();
}

// ==================== REPOSITORY OPERATIONS ====================

export async function getActiveUser(username = "mila"): Promise<UserProfile> {
  const db = readLocalDb();
  const found = db.profiles.find(
    (p) => p.username.toLowerCase() === username.toLowerCase()
  );
  return found || db.profiles[0];
}

export async function getProfileByUsername(
  username: string
): Promise<UserProfile | null> {
  const db = readLocalDb();
  return (
    db.profiles.find(
      (p) => p.username.toLowerCase() === username.toLowerCase()
    ) || null
  );
}

export async function getAllProfiles(): Promise<UserProfile[]> {
  return readLocalDb().profiles;
}

export async function updateUserProfile(
  username: string,
  patch: Partial<UserProfile>
): Promise<UserProfile> {
  const db = readLocalDb();
  const idx = db.profiles.findIndex(
    (p) => p.username.toLowerCase() === username.toLowerCase()
  );
  if (idx === -1) throw new Error("Profile not found");
  db.profiles[idx] = { ...db.profiles[idx], ...patch };
  writeLocalDb(db);
  return db.profiles[idx];
}

export async function getFriendsForUser(userId: string): Promise<UserProfile[]> {
  const db = readLocalDb();
  const friendIds = new Set(
    db.friendships
      .filter((f) => f.userId === userId || f.friendId === userId)
      .map((f) => (f.userId === userId ? f.friendId : f.userId))
  );
  return db.profiles.filter((p) => friendIds.has(p.id));
}

export async function getAllProducts(): Promise<Product[]> {
  const db = readLocalDb();
  return [...db.products].sort(
    (a, b) =>
      new Date(b.lastScrapedAt).getTime() - new Date(a.lastScrapedAt).getTime()
  );
}

export async function getProductById(id: string): Promise<Product | null> {
  const db = readLocalDb();
  return db.products.find((p) => p.id === id) || null;
}

export async function getProductByCanonicalUrl(
  canonicalUrl: string
): Promise<Product | null> {
  const db = readLocalDb();
  return (
    db.products.find(
      (p) => p.canonicalUrl.toLowerCase() === canonicalUrl.toLowerCase()
    ) || null
  );
}

export async function upsertSharedProduct(
  product: Omit<Product, "id"> & { id?: string }
): Promise<Product> {
  const db = readLocalDb();
  const existingIdx = db.products.findIndex(
    (p) => p.canonicalUrl.toLowerCase() === product.canonicalUrl.toLowerCase()
  );
  if (existingIdx >= 0) {
    const updated: Product = {
      ...db.products[existingIdx],
      ...product,
      id: db.products[existingIdx].id,
    };
    db.products[existingIdx] = updated;
    writeLocalDb(db);
    return updated;
  }
  const created: Product = {
    ...product,
    id: product.id || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };
  db.products.unshift(created);
  writeLocalDb(db);
  return created;
}

export async function getClosetItemsForUser(
  userId: string,
  viewerIsOwner = false
): Promise<EnrichedClosetItem[]> {
  const db = readLocalDb();
  const owner = db.profiles.find((p) => p.id === userId);
  if (!owner) return [];
  if (!viewerIsOwner && !owner.isClosetPublic) return [];

  return db.closetItems
    .filter((ci) => ci.userId === userId && (viewerIsOwner || ci.isPublic))
    .map((ci) => {
      const product = db.products.find((p) => p.id === ci.productId);
      if (!product) return null;
      return { ...ci, product, owner };
    })
    .filter((item): item is EnrichedClosetItem => item !== null);
}

export async function getPublicFriendClosetFeed(
  userId: string
): Promise<EnrichedClosetItem[]> {
  const friends = await getFriendsForUser(userId);
  const friendMap = new Map(friends.map((f) => [f.id, f]));
  const db = readLocalDb();

  return db.closetItems
    .filter((ci) => {
      const owner = friendMap.get(ci.userId);
      return owner && owner.isClosetPublic && ci.isPublic;
    })
    .map((ci) => {
      const product = db.products.find((p) => p.id === ci.productId);
      const owner = friendMap.get(ci.userId);
      if (!product || !owner) return null;
      return { ...ci, product, owner };
    })
    .filter((x): x is EnrichedClosetItem => x !== null);
}

export async function addClosetItemAndGrantBonus(params: {
  userId: string;
  productId: string;
  purchasedSize: string;
  fitRating: ClosetItem["fitRating"];
  reviewNote: string;
  isPublic?: boolean;
}): Promise<{ item: ClosetItem; bonusGranted: number }> {
  const db = readLocalDb();
  const created: ClosetItem = {
    id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: params.userId,
    productId: params.productId,
    purchasedSize: params.purchasedSize,
    fitRating: params.fitRating,
    reviewNote: params.reviewNote,
    isPublic: params.isPublic ?? true,
    timesWorn: 1,
    createdAt: new Date().toISOString(),
  };
  db.closetItems.unshift(created);

  // Viral reward: adding an item to a public closet unlocks +3 free HD try-ons!
  let bonusGranted = 0;
  if (created.isPublic) {
    const pIdx = db.profiles.findIndex((p) => p.id === params.userId);
    if (pIdx >= 0) {
      db.profiles[pIdx].bonusTryons += 3;
      bonusGranted = 3;
    }
  }

  writeLocalDb(db);
  return { item: created, bonusGranted };
}

export async function grantFriendInviteBonus(userId: string): Promise<number> {
  const db = readLocalDb();
  const pIdx = db.profiles.findIndex((p) => p.id === userId);
  if (pIdx >= 0) {
    db.profiles[pIdx].bonusTryons += 3;
    writeLocalDb(db);
    return db.profiles[pIdx].bonusTryons;
  }
  return 0;
}

export async function findCachedTryOn(
  cacheKey: string
): Promise<TryOnRender | null> {
  const db = readLocalDb();
  return db.tryonRenders.find((r) => r.cacheKey === cacheKey) || null;
}

export async function recordCacheHit(monthKey: string): Promise<void> {
  const db = readLocalDb();
  let ledger = db.budgetLedgers.find((b) => b.monthKey === monthKey);
  if (!ledger) {
    ledger = {
      monthKey,
      capUsd: Number(process.env.GWO_MONTHLY_BUDGET_USD || 100),
      spentUsd: 0,
      paidRenders: 0,
      cacheHits: 0,
      updatedAt: new Date().toISOString(),
    };
    db.budgetLedgers.push(ledger);
  }
  ledger.cacheHits += 1;
  ledger.updatedAt = new Date().toISOString();
  writeLocalDb(db);
}

export async function saveTryOnRender(render: TryOnRender): Promise<void> {
  const db = readLocalDb();
  db.tryonRenders.unshift(render);
  writeLocalDb(db);
}

export async function getMonthlyBudgetLedger(
  monthKey = new Date().toISOString().slice(0, 7)
): Promise<ComputeBudgetLedger> {
  const db = readLocalDb();
  let ledger = db.budgetLedgers.find((b) => b.monthKey === monthKey);
  if (!ledger) {
    ledger = {
      monthKey,
      capUsd: Number(process.env.GWO_MONTHLY_BUDGET_USD || 100),
      spentUsd: 0,
      paidRenders: 0,
      cacheHits: 0,
      updatedAt: new Date().toISOString(),
    };
    db.budgetLedgers.push(ledger);
    writeLocalDb(db);
  }
  return ledger;
}

export async function logAffiliateClick(
  click: Omit<AffiliateClick, "id" | "createdAt">
): Promise<AffiliateClick> {
  const db = readLocalDb();
  const saved: AffiliateClick = {
    ...click,
    id: `clk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  db.affiliateClicks.unshift(saved);
  writeLocalDb(db);
  return saved;
}

export async function getTelemetrySummary() {
  const db = readLocalDb();
  const ledger = await getMonthlyBudgetLedger();
  return {
    ledger,
    sharedSkuCount: db.products.length,
    scrapedUrlCount: db.products.filter((p) => p.sourceType === "scraped_url").length,
    publicClosetItemCount: db.closetItems.filter((c) => c.isPublic).length,
    totalAffiliateClicks: db.affiliateClicks.length,
    friendReferredClicks: db.affiliateClicks.filter((c) => Boolean(c.referrerCode)).length,
  };
}
