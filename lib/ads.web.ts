import { loadPolyOpenAccess } from "./access";

export const ADMOB_APP_ID_ANDROID =
  "ca-app-pub-6439814432951642~8608061442";

export const ADMOB_AD_UNITS = {
  banner:
    "ca-app-pub-6439814432951642/1006727428",
  interstitial:
    "ca-app-pub-6439814432951642/7380564082",
  native:
    "ca-app-pub-6439814432951642/9061311419",
} as const;

export type InterstitialOutcome =
  | "shown"
  | "skipped-ad-free"
  | "skipped-platform"
  | "load-timeout"
  | "load-error"
  | "show-error";

/**
 * AdMob is native-only. Web initialization is intentionally
 * a no-op so the Expo website can bundle without importing
 * react-native-google-mobile-ads.
 */
export async function initializeAds(): Promise<void> {
  return;
}

export async function userHasAdFreeAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) {
    return false;
  }

  try {
    const access = await loadPolyOpenAccess(userId);
    return access.hasNoAds;
  } catch (error) {
    console.warn(
      "Unable to verify No Ads access",
      error,
    );

    return false;
  }
}

/**
 * Browser advertisements require a separate web advertising
 * provider and consent implementation. The native AdMob
 * checkpoint is therefore skipped on web without blocking
 * the Speed Dating mini-game.
 */
export async function showMiniGameInterstitial(
  _userId: string | null | undefined,
  _options?: {
    timeoutMs?: number;
  },
): Promise<InterstitialOutcome> {
  return "skipped-platform";
}
