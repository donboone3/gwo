import { beforeEach, describe, expect, it } from "vitest";
import {
  addClosetItemAndGrantBonus,
  getMonthlyBudgetLedger,
  readLocalDb,
  resetTestMemoryDb,
  writeLocalDb,
} from "@/lib/db/repository";
import { authorizeAndConsumeTryOnCredit } from "@/lib/tryon/budget-guard";
import { executeVirtualTryOn } from "@/lib/tryon/vton-service";

describe("GWO $100/mo Compute Guardrail & Render Cache", () => {
  beforeEach(() => {
    resetTestMemoryDb();
  });

  it("allows 6 free daily try-ons, blocks #7, and unlocks +3 bonus tries on public closet share", async () => {
    const today = "2026-11-24";
    for (let i = 1; i <= 6; i++) {
      const res = authorizeAndConsumeTryOnCredit({
        username: "mila",
        todayKey: today,
        monthKey: "2026-11",
      });
      expect(res.allowed).toBe(true);
    }

    const blocked = authorizeAndConsumeTryOnCredit({
      username: "mila",
      todayKey: today,
      monthKey: "2026-11",
    });
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.reason).toBe("user_daily_quota_reached");
    }

    // Adding a piece to her public closet rewards +3 bonus free try-ons
    const { bonusGranted } = await addClosetItemAndGrantBonus({
      userId: "user-mila",
      productId: "prod-nike-cortez",
      purchasedSize: "7.5",
      fitRating: "true_to_size",
      reviewNote: "Clean daily sneaker",
      isPublic: true,
    });
    expect(bonusGranted).toBe(3);

    const unlocked = authorizeAndConsumeTryOnCredit({
      username: "mila",
      todayKey: today,
      monthKey: "2026-11",
    });
    expect(unlocked.allowed).toBe(true);
    if (unlocked.allowed) {
      expect(unlocked.consumedSource).toBe("bonus_credit");
      expect(unlocked.quotaAfter.bonusRemaining).toBe(2);
    }
  });

  it("halts paid VTON calls strictly at the $100.00 monthly cap", () => {
    const db = readLocalDb();
    db.budgetLedgers = [
      {
        monthKey: "2026-11",
        capUsd: 100.0,
        spentUsd: 99.95,
        paidRenders: 1332,
        cacheHits: 400,
        updatedAt: new Date().toISOString(),
      },
    ];
    writeLocalDb(db);

    const overCap = authorizeAndConsumeTryOnCredit({
      username: "mila",
      costUsd: 0.075,
      todayKey: "2026-11-24",
      monthKey: "2026-11",
    });

    expect(overCap.allowed).toBe(false);
    if (!overCap.allowed) {
      expect(overCap.reason).toBe("monthly_platform_cap_reached");
      expect(overCap.ledgerAfter.spentUsd).toBe(99.95);
    }
  });

  it("serves repeat outfit try-ons from SHA-256 cache at $0.00 cost and 0 credit burn", async () => {
    const combo = ["prod-nike-chill-tank", "prod-nike-zenvy-leggings"];

    const first = await executeVirtualTryOn({
      username: "mila",
      productIds: combo,
    });
    expect(first.success).toBe(true);
    expect(first.cached).toBe(false);
    expect(first.ledger.spentUsd).toBeCloseTo(0.075, 4);
    expect(first.quota.dailyUsed).toBe(1);

    // Reverse order of IDs should still hit the exact same canonical SHA-256 cache key!
    const second = await executeVirtualTryOn({
      username: "mila",
      productIds: [...combo].reverse(),
    });
    expect(second.success).toBe(true);
    expect(second.cached).toBe(true);
    expect(second.ledger.spentUsd).toBeCloseTo(0.075, 4);
    expect(second.quota.dailyUsed).toBe(1);

    const ledger = await getMonthlyBudgetLedger();
    expect(ledger.cacheHits).toBe(1);
  });
});
