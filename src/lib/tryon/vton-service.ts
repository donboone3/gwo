import crypto from "crypto";
import { fal } from "@fal-ai/client";
import {
  findCachedTryOn,
  getActiveUser,
  getMonthlyBudgetLedger,
  getProductById,
  recordCacheHit,
  saveTryOnRender,
} from "../db/repository";
import {
  authorizeAndConsumeTryOnCredit,
  computeUserQuotaStatus,
  FASHN_COST_PER_RENDER_USD,
  UserQuotaStatus,
} from "./budget-guard";
import { ComputeBudgetLedger, TryOnRender } from "../types";

export function computeTryOnCacheKey(
  avatarIdentity: string,
  productIds: string[]
): string {
  const normalized = [...new Set(productIds.filter(Boolean))].sort().join("|");
  return crypto
    .createHash("sha256")
    .update(`${avatarIdentity.trim().toLowerCase()}::${normalized}`)
    .digest("hex");
}

export interface TryOnExecutionResult {
  success: boolean;
  cached: boolean;
  mode: "live_fashn_ai" | "studio_composite_demo" | "fallback_cap_reached";
  message: string;
  render?: TryOnRender;
  quota: UserQuotaStatus;
  ledger: ComputeBudgetLedger;
}

export async function executeVirtualTryOn(params: {
  username?: string;
  productIds: string[];
}): Promise<TryOnExecutionResult> {
  const user = await getActiveUser(params.username || "mila");
  const cleanIds = [...new Set(params.productIds.filter(Boolean))];
  const todayKey = new Date().toISOString().slice(0, 10);
  const monthKey = todayKey.slice(0, 7);

  if (cleanIds.length === 0) {
    return {
      success: false,
      cached: false,
      mode: "studio_composite_demo",
      message: "Select at least one garment to try on your avatar.",
      quota: computeUserQuotaStatus(user, todayKey),
      ledger: await getMonthlyBudgetLedger(monthKey),
    };
  }

  const avatarKey = user.avatarPhotoUrl || `${user.id}:${user.skinTone}:${user.hairStyle}`;
  const cacheKey = computeTryOnCacheKey(avatarKey, cleanIds);

  // 1. Check Shared Render Cache ($0.00 repeat views & 0 credits deducted!)
  const cachedRender = await findCachedTryOn(cacheKey);
  if (cachedRender) {
    await recordCacheHit(monthKey);
    return {
      success: true,
      cached: true,
      mode:
        cachedRender.provider === "fashn_fal"
          ? "live_fashn_ai"
          : "studio_composite_demo",
      message: "Instant $0.00 Cache Hit — zero daily credits used!",
      render: { ...cachedRender, cached: true },
      quota: computeUserQuotaStatus(user, todayKey),
      ledger: await getMonthlyBudgetLedger(monthKey),
    };
  }

  // 2. Authorize against Per-User Free Allowance & $100/mo Circuit Breaker
  const decision = authorizeAndConsumeTryOnCredit({
    username: user.username,
    costUsd: FASHN_COST_PER_RENDER_USD,
    todayKey,
    monthKey,
  });

  if (!decision.allowed) {
    return {
      success: false,
      cached: false,
      mode: "fallback_cap_reached",
      message: decision.message,
      quota: decision.quotaAfter,
      ledger: decision.ledgerAfter,
    };
  }

  // 3. Live FASHN AI v1.6 via fal.ai when FAL_KEY + user photo + garment photo exist
  let renderedImageUrl: string | undefined;
  let provider: TryOnRender["provider"] = "studio_composite";

  if (process.env.FAL_KEY && user.avatarPhotoUrl) {
    const primaryProduct = await getProductById(cleanIds[0]);
    if (primaryProduct?.imageUrl) {
      try {
        fal.config({ credentials: process.env.FAL_KEY });
        const falResult = await fal.subscribe("fal-ai/fashn/tryon/v1.6", {
          input: {
            model_image: user.avatarPhotoUrl,
            garment_image: primaryProduct.imageUrl,
            category:
              primaryProduct.category === "bottom"
                ? "bottoms"
                : primaryProduct.category === "dress"
                ? "one-pieces"
                : "tops",
          },
        });
        const outputImages = (falResult.data as { images?: Array<{ url: string }> })
          ?.images;
        if (outputImages?.[0]?.url) {
          renderedImageUrl = outputImages[0].url;
          provider = "fashn_fal";
        }
      } catch {
        // Gracefully fall back to Studio Composite if external FAL call fails
      }
    }
  }

  const savedRender: TryOnRender = {
    id: `ren-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    cacheKey,
    userId: user.id,
    productIds: cleanIds,
    renderedImageUrl: renderedImageUrl || `studio://composite/${cacheKey.slice(0, 12)}`,
    provider,
    costUsd: FASHN_COST_PER_RENDER_USD,
    cached: false,
    createdAt: new Date().toISOString(),
  };

  await saveTryOnRender(savedRender);

  return {
    success: true,
    cached: false,
    mode: provider === "fashn_fal" ? "live_fashn_ai" : "studio_composite_demo",
    message:
      provider === "fashn_fal"
        ? "Generated HD Virtual Try-On via FASHN AI v1.6 ($0.075) — cached for free repeat views!"
        : "Styled HD Studio Fit on your Avatar ($0.075 metered to test ledger — cached for $0 repeat views)!",
    render: savedRender,
    quota: decision.quotaAfter,
    ledger: decision.ledgerAfter,
  };
}
