import { Platform } from "react-native";
import mobileAds, {
  AdEventType,
  InterstitialAd,
  MaxAdContentRating,
  TestIds,
} from "react-native-google-mobile-ads";

import { supabase } from "./supabase";

const USE_TEST_ADS = __DEV__;

export const ADMOB_APP_ID_ANDROID =
  "ca-app-pub-6439814432951642~8608061442";

export const ADMOB_AD_UNITS = {
  banner: USE_TEST_ADS
    ? TestIds.BANNER
    : "ca-app-pub-6439814432951642/1006727428",

  interstitial: USE_TEST_ADS
    ? TestIds.INTERSTITIAL
    : "ca-app-pub-6439814432951642/7380564082",

  native: USE_TEST_ADS
    ? TestIds.NATIVE
    : "ca-app-pub-6439814432951642/9061311419",
} as const;

export type InterstitialOutcome =
  | "shown"
  | "skipped-ad-free"
  | "skipped-platform"
  | "load-timeout"
  | "load-error"
  | "show-error";

let initialized = false;
let initializationPromise: Promise<void> | null =
  null;

export async function initializeAds() {
  if (initialized) {
    return;
  }

  if (
    Platform.OS !== "android" &&
    Platform.OS !== "ios"
  ) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    await mobileAds().setRequestConfiguration({
      maxAdContentRating:
        MaxAdContentRating.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });

    await mobileAds().initialize();

    initialized = true;
  })();

  try {
    await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}

export async function userHasAdFreeAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "no_ads, premium_bundle, premium_expires_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn(
      "Unable to verify No Ads access",
      error,
    );

    return false;
  }

  const bundleActive =
    Boolean(data?.premium_bundle) &&
    (
      !data?.premium_expires_at ||
      (
        !Number.isNaN(
          new Date(
            data.premium_expires_at,
          ).getTime(),
        ) &&
        new Date(
          data.premium_expires_at,
        ).getTime() > Date.now()
      )
    );

  return Boolean(
    data?.no_ads ||
    bundleActive,
  );
}

export async function showMiniGameInterstitial(
  userId: string | null | undefined,
  options?: {
    timeoutMs?: number;
  },
): Promise<InterstitialOutcome> {
  if (
    Platform.OS !== "android" &&
    Platform.OS !== "ios"
  ) {
    return "skipped-platform";
  }

  const adFree =
    await userHasAdFreeAccess(
      userId,
    );

  if (adFree) {
    return "skipped-ad-free";
  }

  try {
    await initializeAds();
  } catch (error) {
    console.warn(
      "AdMob initialization warning",
      error,
    );

    return "load-error";
  }

  const timeoutMs =
    Math.max(
      3000,
      options?.timeoutMs ?? 9000,
    );

  return new Promise<InterstitialOutcome>(
    (resolve) => {
      let settled = false;
      let loaded = false;

      const interstitial =
        InterstitialAd.createForAdRequest(
          ADMOB_AD_UNITS.interstitial,
          {
            requestNonPersonalizedAdsOnly:
              true,
          },
        );

      const finish = (
        outcome: InterstitialOutcome,
      ) => {
        if (settled) {
          return;
        }

        settled = true;

        clearTimeout(timeout);

        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();

        resolve(outcome);
      };

      const unsubscribeLoaded =
        interstitial.addAdEventListener(
          AdEventType.LOADED,
          () => {
            loaded = true;

            interstitial
              .show()
              .catch((error) => {
                console.warn(
                  "AdMob interstitial show warning",
                  error,
                );

                finish(
                  "show-error",
                );
              });
          },
        );

      const unsubscribeClosed =
        interstitial.addAdEventListener(
          AdEventType.CLOSED,
          () => {
            finish("shown");
          },
        );

      const unsubscribeError =
        interstitial.addAdEventListener(
          AdEventType.ERROR,
          (error) => {
            console.warn(
              "AdMob interstitial load warning",
              error,
            );

            finish(
              loaded
                ? "show-error"
                : "load-error",
            );
          },
        );

      const timeout = setTimeout(
        () => {
          finish("load-timeout");
        },
        timeoutMs,
      );

      try {
        interstitial.load();
      } catch (error) {
        console.warn(
          "AdMob interstitial request warning",
          error,
        );

        finish("load-error");
      }
    },
  );
}
