import { ComputeBudgetLedger, UserProfile } from "../types";
import { readLocalDb, writeLocalDb } from "../db/repository";

export const FASHN_COST_PER_RENDER_USD = 0.075;

export function getDailyFreeLimit(): number {
  return Number(process.env.GWO_DAILY_FREE_TRYONS || 6);
}

export function getMonthlyBudgetCapUsd(): number {
  return Number(process.env.GWO_MONTHLY_BUDGET_USD || 100);
}

export interface UserQuotaStatus {
  dailyLimit: number;
  dailyUsed: number;
  freeDailyRemaining: number;
  bonusRemaining: number;
  totalAvailableToday: number;
}

export function computeUserQuotaStatus(
  profile: UserProfile,
  todayKey = new Date().toISOString().slice(0, 10)
): UserQuotaStatus {
  const dailyLimit = getDailyFreeLimit();
  const dailyUsed =
    profile.quotaResetDate === todayKey ? profile.dailyTryonsUsed : 0;
  const freeDailyRemaining = Math.max(0, dailyLimit - dailyUsed);
  const bonusRemaining = Math.max(0, profile.bonusTryons);

  return {
    dailyLimit,
    dailyUsed,
    freeDailyRemaining,
    bonusRemaining,
    totalAvailableToday: freeDailyRemaining + bonusRemaining,
  };
}

export type GuardDecision =
  | {
      allowed: true;
      consumedSource: "daily_free" | "bonus_credit";
      quotaAfter: UserQuotaStatus;
      ledgerAfter: ComputeBudgetLedger;
    }
  | {
      allowed: false;
      reason: "user_daily_quota_reached" | "monthly_platform_cap_reached";
      message: string;
      quotaAfter: UserQuotaStatus;
      ledgerAfter: ComputeBudgetLedger;
    };

/**
 * Enforces both per-user daily free try-on limits AND the hard $100.00/mo
 * global platform circuit breaker before dispatching a paid VTON render.
 */
export function authorizeAndConsumeTryOnCredit(params: {
  username: string;
  costUsd?: number;
  todayKey?: string;
  monthKey?: string;
}): GuardDecision {
  const costUsd = params.costUsd ?? FASHN_COST_PER_RENDER_USD;
  const todayKey = params.todayKey ?? new Date().toISOString().slice(0, 10);
  const monthKey = params.monthKey ?? todayKey.slice(0, 7);
  const defaultCap = getMonthlyBudgetCapUsd();

  const db = readLocalDb();
  const pIdx = db.profiles.findIndex(
    (p) => p.username.toLowerCase() === params.username.toLowerCase()
  );
  if (pIdx === -1) {
    throw new Error(`User profile not found: ${params.username}`);
  }

  const profile = db.profiles[pIdx];
  if (profile.quotaResetDate !== todayKey) {
    profile.dailyTryonsUsed = 0;
    profile.quotaResetDate = todayKey;
  }

  let ledger = db.budgetLedgers.find((b) => b.monthKey === monthKey);
  if (!ledger) {
    ledger = {
      monthKey,
      capUsd: defaultCap,
      spentUsd: 0,
      paidRenders: 0,
      cacheHits: 0,
      updatedAt: new Date().toISOString(),
    };
    db.budgetLedgers.push(ledger);
  }

  const currentQuota = computeUserQuotaStatus(profile, todayKey);

  // 1. Hard Global Monthly Cap Check ($100.00 ceiling)
  const projectedSpend = Number((ledger.spentUsd + costUsd).toFixed(4));
  if (projectedSpend > ledger.capUsd) {
    writeLocalDb(db);
    return {
      allowed: false,
      reason: "monthly_platform_cap_reached",
      message: `Monthly free-beta AI cap ($${ledger.capUsd.toFixed(
        2
      )}) reached — instant Studio Layering Preview remains 100% free!`,
      quotaAfter: currentQuota,
      ledgerAfter: { ...ledger },
    };
  }

  // 2. Per-User Free Daily + Viral Bonus Quota Check
  if (currentQuota.totalAvailableToday <= 0) {
    writeLocalDb(db);
    return {
      allowed: false,
      reason: "user_daily_quota_reached",
      message:
        "You used today's free HD try-ons! Add an item to your public closet or share an invite link for +3 instant free tries.",
      quotaAfter: currentQuota,
      ledgerAfter: { ...ledger },
    };
  }

  // 3. Consume credit (daily free pool first, then viral bonus pool)
  let consumedSource: "daily_free" | "bonus_credit" = "daily_free";
  if (currentQuota.freeDailyRemaining > 0) {
    profile.dailyTryonsUsed += 1;
  } else {
    profile.bonusTryons = Math.max(0, profile.bonusTryons - 1);
    consumedSource = "bonus_credit";
  }

  ledger.spentUsd = projectedSpend;
  ledger.paidRenders += 1;
  ledger.updatedAt = new Date().toISOString();

  writeLocalDb(db);

  return {
    allowed: true,
    consumedSource,
    quotaAfter: computeUserQuotaStatus(profile, todayKey),
    ledgerAfter: { ...ledger },
  };
}
