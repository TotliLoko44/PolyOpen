import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import { SafeAreaView } from "react-native-safe-area-context";

import { loadPolyOpenAccess } from "../lib/access";
import { useAuth } from "../lib/auth";
import {
  activateBoostForHours,
  activateGoldVerification,
  activateOneHourBoost,
  ensureBoostWallet,
  getBoostHoursForProduct,
} from "../lib/boosts";
import { BRAND } from "../lib/brand";
import { supabase } from "../lib/supabase";

const POLYOPEN_LOGO = require("../assets/images/polyopen-logo.png");

const REVENUECAT_ANDROID_API_KEY = "goog_qLXBqJTqwffxkyvdNbNmKfGiGOj";
const OFFERING_ID = "default";

const PREMIUM_PACKAGE_ID = "monthly";
const NO_ADS_PACKAGE_ID = "no_ads";
const BUNDLE_PACKAGE_ID = "bundle";
const VERIFICATION_PACKAGE_ID = "verification";

const BOOST_1_PACKAGE_ID = "boost1";
const BOOST_3_PACKAGE_ID = "boost3";
const BOOST_10_PACKAGE_ID = "boost10";

const PREMIUM_ENTITLEMENT_ID = "premium";
const NO_ADS_ENTITLEMENT_ID = "no_ads";
const BUNDLE_ENTITLEMENT_ID = "premium_bundle";
const VERIFICATION_ENTITLEMENT_ID = "verification";

type PlanId = "premium" | "no_ads" | "bundle" | "verification";
type BoostPlanId = "boost1" | "boost3" | "boost10";

function FeatureRow({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureCheck}>✓</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function SponsorRow({ text }: { text: string }) {
  return (
    <View style={styles.sponsorRow}>
      <Text style={styles.sponsorDot}>•</Text>
      <Text style={styles.sponsorText}>{text}</Text>
    </View>
  );
}

function formatBoostTime(expiresAt: string | null) {
  if (!expiresAt) return "No active boost";

  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) return "No active boost";

  const diffMs = expires - Date.now();
  if (diffMs <= 0) return "Boost expired";

  const minutes = Math.ceil(diffMs / 60000);

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m remaining`;
  }

  return `${minutes}m remaining`;
}

function getCurrentWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function isActive(value?: boolean | null) {
  return Boolean(value);
}

function getPackagePrice(pkg?: PurchasesPackage | null, fallback?: string) {
  return pkg?.product?.priceString || fallback || "";
}

function findPackage(
  offering: PurchasesOffering | null,
  identifier: string,
): PurchasesPackage | null {
  if (!offering?.availablePackages?.length) return null;

  return (
    offering.availablePackages.find((pkg) => pkg.identifier === identifier) ??
    null
  );
}

function hasEntitlement(customerInfo: CustomerInfo, id: string) {
  return Boolean(customerInfo.entitlements.active[id]);
}

function getAccessFromCustomerInfo(customerInfo: CustomerInfo) {
  const hasPremium = hasEntitlement(customerInfo, PREMIUM_ENTITLEMENT_ID);
  const hasNoAds = hasEntitlement(customerInfo, NO_ADS_ENTITLEMENT_ID);
  const hasBundle = hasEntitlement(customerInfo, BUNDLE_ENTITLEMENT_ID);
  const hasVerification = hasEntitlement(
    customerInfo,
    VERIFICATION_ENTITLEMENT_ID,
  );

  return {
    is_premium: hasPremium || hasBundle,
    no_ads: hasNoAds || hasBundle,
    premium_bundle: hasBundle,
    premium_tier: hasBundle
      ? hasVerification
        ? "premium_no_ads_gold_bundle"
        : "premium_no_ads_bundle"
      : hasPremium
        ? "premium_monthly"
        : hasNoAds
          ? "no_ads_monthly"
          : null,
    premium_expires_at: null,
    is_verified: hasVerification,
    verification_tier: hasVerification ? "gold" : null,
    verification_status: hasVerification ? "approved" : "not_verified",
  };
}

function getBoostFallbackHours(plan: BoostPlanId) {
  if (plan === "boost1") return 1;
  if (plan === "boost3") return 3;
  if (plan === "boost10") return 10;
  return 0;
}

function getRevenueCatErrorMessage(error: any) {
  const message =
    error?.underlyingErrorMessage ||
    error?.message ||
    error?.readableErrorCode ||
    "The purchase could not be completed.";

  return String(message);
}

export default function PremiumScreen() {
  const router = useRouter();
  const { userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [planBusy, setPlanBusy] = useState<PlanId | null>(null);
  const [boostPurchaseBusy, setBoostPurchaseBusy] =
    useState<BoostPlanId | null>(null);
  const [boostActivateBusy, setBoostActivateBusy] = useState(false);
  const [weeklyBoostBusy, setWeeklyBoostBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);

  const [premiumActive, setPremiumActive] = useState(false);
  const [noAdsActive, setNoAdsActive] = useState(false);
  const [bundleActive, setBundleActive] = useState(false);
  const [verificationActive, setVerificationActive] = useState(false);
  const [vipActive, setVipActive] = useState(false);

  const [boostCredits, setBoostCredits] = useState(0);
  const [boostActive, setBoostActive] = useState(false);
  const [boostExpiresAt, setBoostExpiresAt] = useState<string | null>(null);
  const [weeklyBoostClaimed, setWeeklyBoostClaimed] = useState(false);

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);

  const boostTimeLabel = useMemo(
    () => formatBoostTime(boostExpiresAt),
    [boostExpiresAt],
  );

  const premiumPackage = useMemo(
    () => findPackage(offering, PREMIUM_PACKAGE_ID),
    [offering],
  );

  const noAdsPackage = useMemo(
    () => findPackage(offering, NO_ADS_PACKAGE_ID),
    [offering],
  );

  const bundlePackage = useMemo(
    () => findPackage(offering, BUNDLE_PACKAGE_ID),
    [offering],
  );

  const verificationPackage = useMemo(
    () => findPackage(offering, VERIFICATION_PACKAGE_ID),
    [offering],
  );

  const boost1Package = useMemo(
    () => findPackage(offering, BOOST_1_PACKAGE_ID),
    [offering],
  );

  const boost3Package = useMemo(
    () => findPackage(offering, BOOST_3_PACKAGE_ID),
    [offering],
  );

  const boost10Package = useMemo(
    () => findPackage(offering, BOOST_10_PACKAGE_ID),
    [offering],
  );

  const premiumPrice = getPackagePrice(premiumPackage, "$9.99");
  const noAdsPrice = getPackagePrice(noAdsPackage, "$9.99");
  const bundlePrice = getPackagePrice(bundlePackage, "$19.99");
  const verificationPrice = getPackagePrice(verificationPackage, "$9.99");

  const boost1Price = getPackagePrice(boost1Package, "$1.99");
  const boost3Price = getPackagePrice(boost3Package, "$4.99");
  const boost10Price = getPackagePrice(boost10Package, "$12.99");

  async function syncAccessToSupabase(customerInfo: CustomerInfo) {
    if (!userId) return;

    const updates = getAccessFromCustomerInfo(customerInfo);

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;

    const resolvedAccess = await loadPolyOpenAccess(userId);

    setVipActive(resolvedAccess.isVip);
    setPremiumActive(resolvedAccess.isPremium);
    setNoAdsActive(resolvedAccess.hasNoAds);
    setBundleActive(resolvedAccess.hasPremiumBundle);
    setVerificationActive(resolvedAccess.hasGoldVerification);
  }

  async function loadBoostState(currentUserId: string) {
    const wallet = await ensureBoostWallet(currentUserId);

    setBoostCredits(wallet.boost_credits ?? 0);
    setBoostActive(Boolean(wallet.boost_active));
    setBoostExpiresAt(wallet.boost_expires_at ?? null);
  }

  async function loadWeeklyBoostClaimState(currentUserId: string) {
    try {
      const weekStart = getCurrentWeekStart();

      const { data, error } = await supabase
        .from("premium_weekly_boost_claims")
        .select("id")
        .eq("user_id", currentUserId)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (error) throw error;

      setWeeklyBoostClaimed(Boolean(data?.id));
    } catch (error) {
      console.log("WEEKLY BOOST CLAIM STATE ERROR:", error);
      setWeeklyBoostClaimed(false);
    }
  }

  async function configureRevenueCat() {
    if (!userId) return;
    if (Platform.OS === "web") return;

    try {
      Purchases.configure({
        apiKey: REVENUECAT_ANDROID_API_KEY,
        appUserID: userId,
      });

      const customerInfo = await Purchases.getCustomerInfo();
      await syncAccessToSupabase(customerInfo);

      const offerings = await Purchases.getOfferings();
      const defaultOffering =
        offerings.all[OFFERING_ID] ?? offerings.current ?? null;

      setOffering(defaultOffering);
    } catch (error: any) {
      console.log("REVENUECAT CONFIG ERROR:", error);
      setOffering(null);
    }
  }

  const loadStatus = useCallback(async () => {
    if (!userId) {
      setPremiumActive(false);
      setNoAdsActive(false);
      setBundleActive(false);
      setVerificationActive(false);
      setVipActive(false);
      setBoostCredits(0);
      setBoostActive(false);
      setBoostExpiresAt(null);
      setWeeklyBoostClaimed(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "is_premium, no_ads, premium_bundle, boost_active, boost_expires_at, is_verified",
        )
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      const access = await loadPolyOpenAccess(userId);
      const expiresAt = data?.boost_expires_at ?? null;
      const expires = expiresAt ? new Date(expiresAt).getTime() : 0;

      const boostIsActive =
        Boolean(data?.boost_active) &&
        Boolean(expiresAt) &&
        !Number.isNaN(expires) &&
        expires > Date.now();

      setVipActive(access.isVip);
      setPremiumActive(access.isPremium);
      setNoAdsActive(access.hasNoAds);
      setBundleActive(access.hasPremiumBundle);
      setVerificationActive(access.hasGoldVerification);
      setBoostActive(boostIsActive);
      setBoostExpiresAt(expiresAt);

      if (data?.boost_active && !boostIsActive) {
        await supabase
          .from("profiles")
          .update({ boost_active: false })
          .eq("id", userId);
      }

      await loadBoostState(userId);
      await loadWeeklyBoostClaimState(userId);
      await configureRevenueCat();
    } catch (error: any) {
      console.log("PREMIUM STATUS ERROR:", error);
      Alert.alert(
        "Premium Error",
        error?.message ?? "Could not load premium status.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function purchasePlan(plan: PlanId) {
    if (plan === "verification") {
      await purchaseVerification();
      return;
    }

    if (!userId || planBusy) {
      Alert.alert("Unavailable", "You must be signed in to continue.");
      return;
    }

    if (vipActive) {
      Alert.alert(
        "Included with VIP",
        "Your VIP membership already includes every PolyOpen plan benefit.",
      );
      return;
    }

    const targetPackage =
      plan === "premium"
        ? premiumPackage
        : plan === "no_ads"
          ? noAdsPackage
          : bundlePackage;

    if (!targetPackage) {
      Alert.alert(
        "Store Not Ready",
        "This package is not available yet. Check RevenueCat packages and rebuild the app.",
      );
      return;
    }

    try {
      setPlanBusy(plan);

      const purchaseResult = await Purchases.purchasePackage(targetPackage);
      await syncAccessToSupabase(purchaseResult.customerInfo);
      await loadStatus();

      Alert.alert(
        "Purchase Complete",
        plan === "bundle"
          ? "Premium + No Ads + Gold Verification is now active. You can claim 1 Premium boost each week."
          : plan === "premium"
            ? "Premium is now active. You can claim 1 Premium boost each week."
            : "No Ads is now active.",
      );
    } catch (error: any) {
      if (error?.userCancelled) return;

      console.log("PURCHASE PLAN ERROR:", error);
      Alert.alert("Purchase Error", getRevenueCatErrorMessage(error));
    } finally {
      setPlanBusy(null);
    }
  }

  async function purchaseVerification() {
    if (!userId || planBusy) {
      Alert.alert("Unavailable", "You must be signed in to continue.");
      return;
    }

    if (vipActive) {
      Alert.alert(
        "Included with VIP",
        "Gold Verification access is included with your VIP membership.",
      );
      return;
    }

    if (!verificationPackage) {
      Alert.alert(
        "Verification Not Ready",
        "This verification package is not available yet. Create the RevenueCat package with identifier verification, connect it to the verification entitlement, then rebuild.",
      );
      return;
    }

    try {
      setPlanBusy("verification");

      const purchaseResult =
        await Purchases.purchasePackage(verificationPackage);
      await syncAccessToSupabase(purchaseResult.customerInfo);
      await activateGoldVerification(userId);
      setVerificationActive(true);
      await loadStatus();

      Alert.alert(
        "Gold Verification Active",
        "Your profile is now Gold Verified.",
      );
    } catch (error: any) {
      if (error?.userCancelled) return;

      console.log("VERIFICATION PURCHASE ERROR:", error);
      Alert.alert("Verification Error", getRevenueCatErrorMessage(error));
    } finally {
      setPlanBusy(null);
    }
  }

  async function claimWeeklyPremiumBoost() {
    if (!userId || weeklyBoostBusy) return;

    if (!premiumActive && !bundleActive) {
      Alert.alert(
        "Premium Required",
        "Weekly boosts are included with Premium.",
      );
      return;
    }

    if (weeklyBoostClaimed) {
      Alert.alert(
        "Already Claimed",
        "You already claimed your Premium boost this week.",
      );
      return;
    }

    try {
      setWeeklyBoostBusy(true);

      const { data, error } = await supabase.rpc("claim_weekly_premium_boost", {
        p_user_id: userId,
      });

      if (error) throw error;

      await loadBoostState(userId);
      await loadWeeklyBoostClaimState(userId);

      const result = Array.isArray(data) ? data[0] : data;

      if (result?.claimed === false || result?.success === false) {
        Alert.alert(
          "Already Claimed",
          result?.message ||
            "You already claimed your Premium boost this week.",
        );
        return;
      }

      setWeeklyBoostClaimed(true);

      Alert.alert(
        "Weekly Boost Added",
        "Your Premium weekly boost credit was added to your wallet.",
      );
    } catch (error: any) {
      console.log("WEEKLY PREMIUM BOOST ERROR:", error);
      Alert.alert(
        "Weekly Boost Error",
        error?.message ?? "Could not claim your weekly Premium boost.",
      );
    } finally {
      setWeeklyBoostBusy(false);
    }
  }

  async function purchaseBoostPack(plan: BoostPlanId) {
    if (!userId || boostPurchaseBusy) {
      Alert.alert("Unavailable", "You must be signed in to continue.");
      return;
    }

    const targetPackage =
      plan === "boost1"
        ? boost1Package
        : plan === "boost3"
          ? boost3Package
          : boost10Package;

    if (!targetPackage) {
      Alert.alert(
        "Boost Not Ready",
        "This boost package is not available yet. Check RevenueCat boost packages.",
      );
      return;
    }

    try {
      setBoostPurchaseBusy(plan);

      const purchaseResult = await Purchases.purchasePackage(targetPackage);

      const productId =
        targetPackage.product.identifier || targetPackage.identifier || plan;

      let hoursToActivate = getBoostHoursForProduct(productId);

      if (hoursToActivate <= 0) {
        hoursToActivate = getBoostFallbackHours(plan);
      }

      if (hoursToActivate <= 0) {
        console.log("UNKNOWN BOOST PRODUCT:", {
          plan,
          packageIdentifier: targetPackage.identifier,
          productIdentifier: targetPackage.product.identifier,
          purchaseResult,
        });

        throw new Error(
          `Boost product was purchased, but the app could not map it to a boost duration. Product: ${productId}`,
        );
      }

      const wallet = await activateBoostForHours(userId, hoursToActivate);

      setBoostCredits(wallet.boost_credits ?? 0);
      setBoostActive(Boolean(wallet.boost_active));
      setBoostExpiresAt(wallet.boost_expires_at ?? null);

      Alert.alert(
        "Boost Activated",
        `Your profile boost is active for ${hoursToActivate} hour${
          hoursToActivate === 1 ? "" : "s"
        }.`,
        [
          {
            text: "Go to Swipe",
            onPress: () => router.push("/(tabs)/swipe" as any),
          },
          { text: "Stay Here", style: "cancel" },
        ],
      );
    } catch (error: any) {
      if (error?.userCancelled) return;

      console.log("BOOST PURCHASE ERROR:", error);
      Alert.alert("Boost Purchase Error", getRevenueCatErrorMessage(error));
    } finally {
      setBoostPurchaseBusy(null);
    }
  }

  async function activatePaidBoost() {
    if (!userId || boostActivateBusy) return;

    try {
      setBoostActivateBusy(true);

      const wallet = await activateOneHourBoost(userId);

      setBoostCredits(wallet.boost_credits ?? 0);
      setBoostActive(Boolean(wallet.boost_active));
      setBoostExpiresAt(wallet.boost_expires_at ?? null);

      Alert.alert("Boost Activated", "Your profile is boosted for 1 hour.", [
        {
          text: "Go to Swipe",
          onPress: () => router.push("/(tabs)/swipe" as any),
        },
        { text: "Stay Here", style: "cancel" },
      ]);
    } catch (error: any) {
      Alert.alert("Boost Error", error?.message ?? "Could not activate boost.");
    } finally {
      setBoostActivateBusy(false);
    }
  }

  async function restorePurchases() {
    if (!userId || restoreBusy) return;

    try {
      setRestoreBusy(true);

      const customerInfo = await Purchases.restorePurchases();
      await syncAccessToSupabase(customerInfo);
      await loadStatus();

      const access = getAccessFromCustomerInfo(customerInfo);

      Alert.alert(
        access.is_premium || access.no_ads || access.is_verified
          ? "Purchases Restored"
          : "No Active Purchases",
        access.is_premium || access.no_ads || access.is_verified
          ? "Your active Premium, No Ads, or Verification access has been restored. Boost purchases are consumable and cannot be restored after purchase."
          : "No active Premium, No Ads, or Verification purchase was found. Boost purchases are consumable and cannot be restored after purchase.",
      );
    } catch (error: any) {
      console.log("RESTORE ERROR:", error);
      Alert.alert("Restore Error", getRevenueCatErrorMessage(error));
    } finally {
      setRestoreBusy(false);
    }
  }

  function requestAdvertiserInfo() {
    Alert.alert(
      "Advertise on PolyOpen",
      "Sponsor intake is ready for the next payment or contact-form connection.",
    );
  }

  function goToSwipe() {
    router.push("/(tabs)/swipe" as any);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Image
          source={POLYOPEN_LOGO}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const weeklyBoostIncluded = premiumActive || bundleActive;
  const weeklyBoostButtonLabel = weeklyBoostBusy
    ? "Claiming..."
    : !weeklyBoostIncluded
      ? "Premium Required"
      : weeklyBoostClaimed
        ? "Claimed This Week"
        : "Claim Weekly Boost";

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          Platform.OS === "web" ? styles.contentWeb : null,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadStatus();
            }}
          />
        }
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <Image
            source={POLYOPEN_LOGO}
            style={styles.heroLogo}
            resizeMode="contain"
          />
          <Text style={styles.heroEyebrow}>
            {vipActive ? "PolyOpen VIP" : "PolyOpen"}
          </Text>
          <Text style={styles.heroTitle}>
            {vipActive ? "VIP Access" : "Premium"}
          </Text>
          <Text style={styles.heroText}>
            Unlock visibility tools, remove ads, activate boosts, get verified,
            or bundle your best PolyOpen access together.
          </Text>
        </View>

        <View style={styles.statusGrid}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel} numberOfLines={1}>
              Premium
            </Text>
            <Text
              style={premiumActive ? styles.statusOn : styles.statusOff}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {premiumActive ? "Active" : "Locked"}
            </Text>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel} numberOfLines={1}>
              No Ads
            </Text>
            <Text
              style={noAdsActive ? styles.statusOn : styles.statusOff}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {noAdsActive ? "Active" : "Locked"}
            </Text>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel} numberOfLines={1}>
              Boost
            </Text>
            <Text
              style={boostActive ? styles.statusOn : styles.statusOff}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {boostActive ? "Active" : "Off"}
            </Text>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel} numberOfLines={1}>
              Verified
            </Text>
            <Text
              style={verificationActive ? styles.statusOn : styles.statusOff}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {verificationActive ? "Gold" : "Off"}
            </Text>
          </View>
        </View>

        <View style={styles.weeklyBoostCard}>
          <Text style={styles.weeklyBoostEyebrow}>Premium benefit</Text>
          <Text style={styles.weeklyBoostTitle}>1 Free Boost Every Week</Text>
          <Text style={styles.weeklyBoostText}>
            Premium members can claim one 1-hour profile boost credit every
            week. Use it whenever you want more visibility in Swipe.
          </Text>

          <View style={styles.weeklyBoostStatusBox}>
            <Text
              style={
                weeklyBoostClaimed
                  ? styles.weeklyBoostStatusClaimed
                  : styles.weeklyBoostStatusReady
              }
            >
              {weeklyBoostIncluded
                ? weeklyBoostClaimed
                  ? "This week’s boost has been claimed."
                  : "Your weekly boost is ready."
                : "Upgrade to Premium to claim weekly boosts."}
            </Text>
          </View>

          <Pressable
            onPress={claimWeeklyPremiumBoost}
            disabled={
              !weeklyBoostIncluded || weeklyBoostBusy || weeklyBoostClaimed
            }
            style={[
              styles.weeklyBoostButton,
              !weeklyBoostIncluded || weeklyBoostBusy || weeklyBoostClaimed
                ? styles.buttonDisabled
                : null,
            ]}
          >
            <Text style={styles.weeklyBoostButtonText}>
              {weeklyBoostButtonLabel}
            </Text>
          </Pressable>
        </View>

        <View style={styles.bundleCard}>
          <Text style={styles.bundleEyebrow}>Best value</Text>
          <Text style={styles.bundleTitle}>Premium + No Ads + Gold</Text>
          <Text style={styles.bundlePrice}>{bundlePrice}</Text>
          <Text style={styles.bundleSub}>/ month</Text>

          <Text style={styles.bundleText}>
            Get Premium visibility, an ad-free experience, and Gold Verification
            together in one plan.
          </Text>

          <Text style={styles.bundleFeature}>• Premium visibility tools</Text>
          <Text style={styles.bundleFeature}>• Who liked and viewed you</Text>
          <Text style={styles.bundleFeature}>
            • 1 free profile boost every week
          </Text>
          <Text style={styles.bundleFeature}>
            • Remove Feed, Swipe, and Browse ads
          </Text>
          <Text style={styles.bundleFeature}>• Gold Verification included</Text>
          <Text style={styles.bundleFeature}>• Best monthly value</Text>

          <Pressable
            onPress={() => purchasePlan("bundle")}
            disabled={!!planBusy || vipActive || !bundlePackage}
            style={[
              styles.bundleButton,
              planBusy || vipActive || !bundlePackage
                ? styles.buttonDisabled
                : null,
            ]}
          >
            <Text style={styles.bundleButtonText}>
              {planBusy === "bundle"
                ? "Processing..."
                : vipActive
                  ? "Included with VIP"
                  : bundleActive
                    ? "Bundle Active"
                    : `Get All 3 for ${bundlePrice}`}
            </Text>
          </Pressable>
        </View>

        <View style={styles.verificationCard}>
          <Text style={styles.verificationEyebrow}>
            Real account verification
          </Text>
          <Text style={styles.verificationTitle}>Gold Verification</Text>
          <Text style={styles.verificationPrice}>{verificationPrice}</Text>
          <Text style={styles.verificationSub}>/ month</Text>

          <Text style={styles.verificationText}>
            Verify that your profile belongs to a real person and unlock a gold
            verified badge across PolyOpen.
          </Text>

          <FeatureRow text="Gold verified badge on your profile" />
          <FeatureRow text="Real-account trust signal" />
          <FeatureRow text="Better credibility in community" />
          <FeatureRow text="Future ID or selfie review flow" />

          <View style={styles.verificationStatusBox}>
            <Text
              style={
                verificationActive
                  ? styles.verificationStatusOn
                  : styles.verificationStatusOff
              }
            >
              {verificationActive ? "Gold Verification Active" : "Not Verified"}
            </Text>
            <Text style={styles.verificationStatusText}>
              {verificationActive
                ? "Your account has the gold verification flag."
                : "Verification package must be available in RevenueCat before purchase."}
            </Text>
          </View>

          <Pressable
            onPress={purchaseVerification}
            disabled={
              !!planBusy ||
              vipActive ||
              verificationActive ||
              !verificationPackage
            }
            style={[
              styles.verificationButton,
              planBusy ||
              vipActive ||
              verificationActive ||
              !verificationPackage
                ? styles.buttonDisabled
                : null,
            ]}
          >
            <Text style={styles.verificationButtonText}>
              {planBusy === "verification"
                ? "Processing..."
                : vipActive
                  ? "Included with VIP"
                  : verificationActive
                    ? "Gold Verified"
                    : `Get Verified for ${verificationPrice}`}
            </Text>
          </Pressable>
        </View>

        <View style={styles.planCard}>
          <Text style={styles.planTitle}>Premium</Text>
          <Text style={styles.planPrice}>{premiumPrice}</Text>
          <Text style={styles.planSub}>/ month</Text>

          <Text style={styles.planText}>
            Reveal Secret Admirers, unlock deeper discovery tools, and see more
            of the activity happening around your profile.
          </Text>

          <FeatureRow text="Reveal who liked you" />
          <FeatureRow text="Reveal Secret Admirers" />
          <FeatureRow text="Unlock Who Viewed You" />
          <FeatureRow text="Open locked profiles from Connections" />
          <FeatureRow text="1 free profile boost every week" />
          <FeatureRow text="Priority visibility tools" />

          <Pressable
            onPress={() => purchasePlan("premium")}
            disabled={!!planBusy || !premiumPackage}
            style={[
              styles.primaryButton,
              planBusy || !premiumPackage ? styles.buttonDisabled : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {planBusy === "premium"
                ? "Processing..."
                : premiumActive && !bundleActive
                  ? "Premium Active"
                  : "Choose Premium"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.noAdsCard}>
          <Text style={styles.planTitle}>No Ads</Text>
          <Text style={styles.noAdsPrice}>{noAdsPrice}</Text>
          <Text style={styles.planSub}>/ month</Text>

          <Text style={styles.planText}>
            Remove sponsored placements and keep the app experience cleaner
            across PolyOpen.
          </Text>

          <FeatureRow text="Remove Feed sponsored cards" />
          <FeatureRow text="Remove Swipe sponsor placements" />
          <FeatureRow text="Remove Browse and Live sponsor placements" />
          <FeatureRow text="Cleaner app experience" />

          <Pressable
            onPress={() => purchasePlan("no_ads")}
            disabled={!!planBusy || !noAdsPackage}
            style={[
              styles.noAdsButton,
              planBusy || !noAdsPackage ? styles.buttonDisabled : null,
            ]}
          >
            <Text style={styles.noAdsButtonText}>
              {planBusy === "no_ads"
                ? "Processing..."
                : noAdsActive && !bundleActive
                  ? "No Ads Active"
                  : "Remove Ads"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={restorePurchases}
          disabled={restoreBusy}
          style={[
            styles.restoreButton,
            restoreBusy ? styles.buttonDisabled : null,
          ]}
        >
          <Text style={styles.restoreButtonText}>
            {restoreBusy ? "Restoring..." : "Restore Purchases"}
          </Text>
        </Pressable>

        <View style={styles.boostCard}>
          <Text style={styles.boostEyebrow}>Paid visibility boost</Text>
          <Text style={styles.boostTitle}>Boost Your Profile</Text>
          <Text style={styles.boostText}>
            Boost pushes your profile higher in Swipe for the boost window.
            Buying another boost while one is active extends your timer.
          </Text>

          <View style={styles.boostStatusBox}>
            <Text
              style={boostActive ? styles.boostStatusOn : styles.boostStatusOff}
            >
              {boostActive ? "Boost is active" : "Boost is inactive"}
            </Text>
            <Text style={styles.boostStatusTime}>{boostTimeLabel}</Text>
            {boostCredits > 0 ? (
              <Text style={styles.boostCreditsText}>
                Boost credits available: {boostCredits}
              </Text>
            ) : null}
          </View>

          <View style={styles.boostPackGrid}>
            <Pressable
              onPress={() => purchaseBoostPack("boost1")}
              disabled={!!boostPurchaseBusy || !boost1Package}
              style={[
                styles.boostPackButton,
                boostPurchaseBusy || !boost1Package
                  ? styles.buttonDisabled
                  : null,
              ]}
            >
              <View>
                <Text style={styles.boostPackTitle}>1 Hour Boost</Text>
                <Text style={styles.boostPackSub}>Activates immediately</Text>
              </View>
              <Text style={styles.boostPackPrice}>
                {boostPurchaseBusy === "boost1" ? "Buying..." : boost1Price}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => purchaseBoostPack("boost3")}
              disabled={!!boostPurchaseBusy || !boost3Package}
              style={[
                styles.boostPackButton,
                boostPurchaseBusy || !boost3Package
                  ? styles.buttonDisabled
                  : null,
              ]}
            >
              <View>
                <Text style={styles.boostPackTitle}>3 Hour Boost</Text>
                <Text style={styles.boostPackSub}>
                  Longer visibility window
                </Text>
              </View>
              <Text style={styles.boostPackPrice}>
                {boostPurchaseBusy === "boost3" ? "Buying..." : boost3Price}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => purchaseBoostPack("boost10")}
              disabled={!!boostPurchaseBusy || !boost10Package}
              style={[
                styles.boostPackButton,
                boostPurchaseBusy || !boost10Package
                  ? styles.buttonDisabled
                  : null,
              ]}
            >
              <View>
                <Text style={styles.boostPackTitle}>10 Hour Boost</Text>
                <Text style={styles.boostPackSub}>Maximum test package</Text>
              </View>
              <Text style={styles.boostPackPrice}>
                {boostPurchaseBusy === "boost10" ? "Buying..." : boost10Price}
              </Text>
            </Pressable>
          </View>

          {boostCredits > 0 ? (
            <Pressable
              onPress={activatePaidBoost}
              disabled={boostActivateBusy || boostActive || boostCredits <= 0}
              style={[
                styles.boostButton,
                boostActivateBusy || boostActive || boostCredits <= 0
                  ? styles.buttonDisabled
                  : null,
              ]}
            >
              <Text style={styles.boostButtonText}>
                {boostActivateBusy
                  ? "Activating..."
                  : boostActive
                    ? "Boost Already Active"
                    : "Use 1 Hour Credit"}
              </Text>
            </Pressable>
          ) : null}

          <Pressable onPress={goToSwipe} style={styles.swipeButton}>
            <Text style={styles.swipeButtonText}>Go to Swipe</Text>
          </Pressable>
        </View>

        <View style={styles.sponsorCard}>
          <View style={styles.sponsorHeader}>
            <Image
              source={POLYOPEN_LOGO}
              style={styles.sponsorLogo}
              resizeMode="contain"
            />

            <View style={styles.sponsorHeaderText}>
              <Text style={styles.sponsorEyebrow}>Sponsored placements</Text>
              <Text style={styles.sponsorTitle}>Advertise on PolyOpen</Text>
            </View>
          </View>

          <Text style={styles.sponsorIntro}>
            Promote a brand, event, retreat, podcast, spiritual community,
            creative project, or small business inside PolyOpen.
          </Text>

          <SponsorRow text="Feed sponsored cards" />
          <SponsorRow text="Swipe sponsor placements" />
          <SponsorRow text="Browse and Live sponsor visibility" />
          <SponsorRow text="Future sponsor intake and Stripe flow" />

          <View style={styles.sponsorPriceBox}>
            <Text style={styles.sponsorPriceLabel}>
              Starter sponsor package
            </Text>
            <Text style={styles.sponsorPrice}>$49 / week</Text>
            <Text style={styles.sponsorPriceText}>
              Placeholder pricing for testing. Later this can connect to Stripe,
              in-app purchases, or a manual advertiser intake form.
            </Text>
          </View>

          <Pressable
            onPress={requestAdvertiserInfo}
            style={styles.sponsorButton}
          >
            <Text style={styles.sponsorButtonText}>
              Request Advertiser Info
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.back()} style={styles.laterButton}>
          <Text style={styles.laterButtonText}>Maybe Later</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingLogo: {
    width: 130,
    height: 130,
    opacity: 0.12,
    position: "absolute",
  },

  content: {
    padding: 20,
    paddingBottom: 58,
    backgroundColor: "#FFFFFF",
  },

  contentWeb: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
  },

  backButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#F4CFE4",
    alignItems: "center",
    justifyContent: "center",
  },

  backButtonText: {
    fontWeight: "900",
    color: BRAND.text,
  },

  hero: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 22,
  },

  heroLogo: {
    width: 92,
    height: 92,
  },

  heroEyebrow: {
    marginTop: 10,
    color: BRAND.pink,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  heroTitle: {
    marginTop: 2,
    fontSize: 42,
    fontWeight: "900",
    color: BRAND.text,
    textAlign: "center",
  },

  heroText: {
    marginTop: 10,
    textAlign: "center",
    color: BRAND.muted,
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 24,
  },

  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },

  statusCard: {
    width: "48%",
    minHeight: 92,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  statusLabel: {
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  statusOn: {
    marginTop: 8,
    color: "#1B7F46",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },

  statusOff: {
    marginTop: 8,
    color: BRAND.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },

  weeklyBoostCard: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: "#FFF9EC",
    borderWidth: 1.5,
    borderColor: "#F6D58A",
    marginBottom: 18,
  },

  weeklyBoostEyebrow: {
    color: "#9A5B00",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  weeklyBoostTitle: {
    marginTop: 4,
    fontSize: 25,
    fontWeight: "900",
    color: BRAND.text,
  },

  weeklyBoostText: {
    marginTop: 8,
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 22,
  },

  weeklyBoostStatusBox: {
    marginTop: 14,
    padding: 13,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F6D58A",
  },

  weeklyBoostStatusReady: {
    color: "#9A5B00",
    fontWeight: "900",
    lineHeight: 20,
  },

  weeklyBoostStatusClaimed: {
    color: "#1B7F46",
    fontWeight: "900",
    lineHeight: 20,
  },

  weeklyBoostButton: {
    marginTop: 16,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },

  weeklyBoostButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 17,
  },

  bundleCard: {
    padding: 22,
    borderRadius: 30,
    backgroundColor: "#111111",
    marginBottom: 18,
  },

  bundleEyebrow: {
    color: "#FFFFFF",
    opacity: 0.8,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },

  bundleTitle: {
    marginTop: 6,
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
  },

  bundlePrice: {
    marginTop: 12,
    color: "#FFFFFF",
    fontSize: 46,
    fontWeight: "900",
  },

  bundleSub: {
    color: "#FFFFFF",
    opacity: 0.75,
    fontWeight: "800",
  },

  bundleText: {
    marginTop: 12,
    color: "#FFFFFF",
    opacity: 0.86,
    fontWeight: "700",
    lineHeight: 22,
  },

  bundleFeature: {
    marginTop: 10,
    color: "#FFFFFF",
    fontWeight: "800",
    lineHeight: 21,
  },

  bundleButton: {
    marginTop: 18,
    height: 60,
    borderRadius: 18,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  bundleButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },

  verificationCard: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: "#111111",
    borderWidth: 1.5,
    borderColor: "#F6C343",
    marginBottom: 18,
  },

  verificationEyebrow: {
    color: "#F6C343",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  verificationTitle: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  verificationPrice: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "900",
  },

  verificationSub: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: "800",
  },

  verificationText: {
    marginTop: 10,
    color: "rgba(255,255,255,0.82)",
    fontWeight: "700",
    lineHeight: 22,
  },

  verificationStatusBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(246,195,67,0.12)",
    borderWidth: 1,
    borderColor: "rgba(246,195,67,0.28)",
  },

  verificationStatusOn: {
    color: "#F6C343",
    fontWeight: "900",
    fontSize: 15,
  },

  verificationStatusOff: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },

  verificationStatusText: {
    marginTop: 5,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "700",
    lineHeight: 20,
  },

  verificationButton: {
    marginTop: 16,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#F6C343",
    alignItems: "center",
    justifyContent: "center",
  },

  verificationButtonText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 17,
  },

  planCard: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: "#FFF7FB",
    borderWidth: 1.5,
    borderColor: "#F4CFE4",
    marginBottom: 18,
  },

  noAdsCard: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    marginBottom: 18,
  },

  planTitle: {
    color: BRAND.text,
    fontSize: 25,
    fontWeight: "900",
  },

  planPrice: {
    marginTop: 8,
    color: BRAND.pink,
    fontSize: 38,
    fontWeight: "900",
  },

  noAdsPrice: {
    marginTop: 8,
    color: BRAND.blue,
    fontSize: 38,
    fontWeight: "900",
  },

  planSub: {
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: "800",
  },

  planText: {
    marginTop: 12,
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 22,
  },

  featureRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F4CFE4",
  },

  featureCheck: {
    color: "#1B7F46",
    fontWeight: "900",
    marginRight: 10,
    fontSize: 16,
  },

  featureText: {
    flex: 1,
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },

  primaryButton: {
    marginTop: 18,
    height: 60,
    borderRadius: 18,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },

  noAdsButton: {
    marginTop: 18,
    height: 60,
    borderRadius: 18,
    backgroundColor: BRAND.blue,
    alignItems: "center",
    justifyContent: "center",
  },

  noAdsButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },

  restoreButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },

  restoreButtonText: {
    color: BRAND.text,
    fontWeight: "900",
  },

  buttonDisabled: {
    opacity: 0.55,
  },

  boostCard: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: "#FFF9EC",
    borderWidth: 1.5,
    borderColor: "#F6D58A",
    marginBottom: 22,
  },

  boostEyebrow: {
    color: "#9A5B00",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  boostTitle: {
    marginTop: 4,
    fontSize: 25,
    fontWeight: "900",
    color: BRAND.text,
  },

  boostText: {
    marginTop: 8,
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 22,
  },

  boostStatusBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F6D58A",
  },

  boostStatusOn: {
    color: "#1B7F46",
    fontWeight: "900",
    fontSize: 15,
  },

  boostStatusOff: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 15,
  },

  boostStatusTime: {
    marginTop: 5,
    color: BRAND.muted,
    fontWeight: "700",
  },

  boostCreditsText: {
    marginTop: 5,
    color: "#9A5B00",
    fontWeight: "900",
  },

  boostPackGrid: {
    marginTop: 14,
    gap: 10,
  },

  boostPackButton: {
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#F6D58A",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  boostPackTitle: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 16,
  },

  boostPackSub: {
    marginTop: 3,
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: "800",
  },

  boostPackPrice: {
    color: "#9A5B00",
    fontWeight: "900",
    fontSize: 16,
  },

  boostButton: {
    marginTop: 16,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },

  boostButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 17,
  },

  swipeButton: {
    marginTop: 12,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#F6D58A",
    alignItems: "center",
    justifyContent: "center",
  },

  swipeButtonText: {
    color: "#9A5B00",
    fontWeight: "900",
    fontSize: 15,
  },

  sponsorCard: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    marginBottom: 22,
  },

  sponsorHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  sponsorLogo: {
    width: 54,
    height: 54,
    marginRight: 12,
  },

  sponsorHeaderText: {
    flex: 1,
  },

  sponsorEyebrow: {
    color: BRAND.blue,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  sponsorTitle: {
    marginTop: 2,
    fontSize: 23,
    fontWeight: "900",
    color: BRAND.text,
  },

  sponsorIntro: {
    marginTop: 12,
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 22,
  },

  sponsorRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5FF",
  },

  sponsorDot: {
    color: BRAND.blue,
    fontWeight: "900",
    marginRight: 10,
    fontSize: 18,
  },

  sponsorText: {
    flex: 1,
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },

  sponsorPriceBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5FF",
  },

  sponsorPriceLabel: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 15,
  },

  sponsorPrice: {
    marginTop: 6,
    color: BRAND.blue,
    fontWeight: "900",
    fontSize: 26,
  },

  sponsorPriceText: {
    marginTop: 6,
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 21,
  },

  sponsorButton: {
    marginTop: 16,
    height: 58,
    borderRadius: 18,
    backgroundColor: BRAND.blue,
    alignItems: "center",
    justifyContent: "center",
  },

  sponsorButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 17,
  },

  laterButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },

  laterButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});
