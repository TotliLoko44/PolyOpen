import { supabase } from "./supabase";

export type AccessSource =
  "vip" | "premium_bundle" | "premium" | "no_ads" | "verification" | "free";

export type ProfileAccessRow = {
  is_premium?: boolean | null;
  no_ads?: boolean | null;
  premium_bundle?: boolean | null;
  premium_tier?: string | null;
  premium_expires_at?: string | null;
  is_verified?: boolean | null;
  verification_tier?: string | null;
  verification_status?: string | null;
};

export type PolyOpenAccess = {
  isVip: boolean;
  isVipAdmin: boolean;
  isPremium: boolean;
  hasNoAds: boolean;
  hasGoldVerification: boolean;
  hasPremiumBundle: boolean;
  canSeePremiumLikesAndViews: boolean;
  canClaimWeeklyBoost: boolean;
  hasAllPaidFeatures: boolean;
  source: AccessSource;
};

const GOLD_BUNDLE_TIER = "premium_no_ads_gold_bundle";

function paidAccessIsCurrent(expiresAt?: string | null) {
  if (!expiresAt) return true;

  const expirationTime = new Date(expiresAt).getTime();

  return Number.isFinite(expirationTime) && expirationTime > Date.now();
}

export function resolvePolyOpenAccess(
  profile: ProfileAccessRow | null | undefined,
  isVip: boolean,
  isVipAdmin = false,
): PolyOpenAccess {
  const paidAccessCurrent = paidAccessIsCurrent(profile?.premium_expires_at);

  const hasLegacyBundle = paidAccessCurrent && Boolean(profile?.premium_bundle);

  const hasPremium =
    paidAccessCurrent && Boolean(profile?.is_premium || hasLegacyBundle);

  const hasNoAds =
    paidAccessCurrent && Boolean(profile?.no_ads || hasLegacyBundle);

  const hasGoldBundle =
    paidAccessCurrent && profile?.premium_tier === GOLD_BUNDLE_TIER;

  const hasGoldVerification = Boolean(profile?.is_verified) || hasGoldBundle;

  const source: AccessSource = isVip
    ? "vip"
    : hasLegacyBundle
      ? "premium_bundle"
      : hasPremium
        ? "premium"
        : hasNoAds
          ? "no_ads"
          : hasGoldVerification
            ? "verification"
            : "free";

  return {
    isVip,
    isVipAdmin,
    isPremium: isVip || hasPremium,
    hasNoAds: isVip || hasNoAds,
    hasGoldVerification: isVip || hasGoldVerification,
    hasPremiumBundle:
      isVip || hasLegacyBundle || profile?.premium_tier === GOLD_BUNDLE_TIER,
    canSeePremiumLikesAndViews: isVip || hasPremium,
    canClaimWeeklyBoost: isVip || hasPremium,
    hasAllPaidFeatures: isVip,
    source,
  };
}

export async function loadPolyOpenAccess(
  userId: string,
): Promise<PolyOpenAccess> {
  if (!userId) {
    throw new Error("A signed-in user is required to load access.");
  }

  const [profileResult, vipResult, adminResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        [
          "is_premium",
          "no_ads",
          "premium_bundle",
          "premium_tier",
          "premium_expires_at",
          "is_verified",
          "verification_tier",
          "verification_status",
        ].join(", "),
      )
      .eq("id", userId)
      .single(),
    supabase.rpc("has_vip_access", {
      target_user_id: userId,
    }),
    supabase.rpc("is_vip_admin", {
      target_user_id: userId,
    }),
  ]);

  if (profileResult.error) {
    throw new Error(
      `Unable to load paid access: ${profileResult.error.message}`,
    );
  }

  if (vipResult.error) {
    throw new Error(`Unable to load VIP access: ${vipResult.error.message}`);
  }

  if (adminResult.error) {
    throw new Error(
      `Unable to load VIP administrator access: ${adminResult.error.message}`,
    );
  }

  return resolvePolyOpenAccess(
    profileResult.data as ProfileAccessRow,
    Boolean(vipResult.data),
    Boolean(adminResult.data),
  );
}
