export const ADMOB_APP_ID_ANDROID: string;

export const ADMOB_AD_UNITS: {
  readonly banner: string;
  readonly interstitial: string;
  readonly native: string;
};

export type InterstitialOutcome =
  | "shown"
  | "skipped-ad-free"
  | "skipped-platform"
  | "load-timeout"
  | "load-error"
  | "show-error";

export function initializeAds(): Promise<void>;

export function userHasAdFreeAccess(
  userId: string | null | undefined,
): Promise<boolean>;

export function showMiniGameInterstitial(
  userId: string | null | undefined,
  options?: {
    timeoutMs?: number;
  },
): Promise<InterstitialOutcome>;
