import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as ExpoIAP from "expo-iap";

import { useAuth } from "../lib/auth";
import { BRAND } from "../lib/brand";
import { supabase } from "../lib/supabase";

const POLYOPEN_LOGO = require("../assets/images/polyopen-logo.png");

type Wallet = {
  coin_balance: number;
  diamond_balance: number;
  lifetime_earned_diamonds: number;
  lifetime_cashout_cents: number;
};

type CoinProduct = {
  id: string;
  product_id: string;
  coin_amount: number;
  price_cents: number;
  currency: string;
  title: string;
  description?: string | null;
};

type Purchase = {
  id: string;
  product_id: string;
  coin_amount: number;
  price_cents: number;
  currency: string;
  status: string;
  created_at: string;
};

type StoreProduct = {
  productId?: string;
  id?: string;
  title?: string;
  description?: string;
  price?: string;
  localizedPrice?: string;
  displayPrice?: string;
  oneTimePurchaseOfferDetails?: {
    formattedPrice?: string;
    priceCurrencyCode?: string;
    priceAmountMicros?: string;
  };
};

type PurchaseResult = {
  productId?: string;
  transactionReceipt?: string;
  purchaseToken?: string;
  id?: string;
};

function getStoreProductId(item: StoreProduct) {
  return item.productId || item.id || "";
}

function getStorePrice(item?: StoreProduct | null) {
  return (
    item?.localizedPrice ||
    item?.displayPrice ||
    item?.price ||
    item?.oneTimePurchaseOfferDetails?.formattedPrice ||
    ""
  );
}

function normalizeIapResult(result: any): PurchaseResult | null {
  if (!result) return null;

  if (Array.isArray(result)) {
    return (result[0] as PurchaseResult | undefined) ?? null;
  }

  if (Array.isArray(result?.responseCode)) {
    return null;
  }

  if (Array.isArray(result?.results)) {
    return (result.results[0] as PurchaseResult | undefined) ?? null;
  }

  if (Array.isArray(result?.purchases)) {
    return (result.purchases[0] as PurchaseResult | undefined) ?? null;
  }

  return result as PurchaseResult;
}

async function connectIap() {
  const iap: any = ExpoIAP as any;

  if (typeof iap.initConnection === "function") {
    await iap.initConnection();
    return;
  }

  if (typeof iap.connectAsync === "function") {
    await iap.connectAsync();
    return;
  }

  if (typeof iap.connect === "function") {
    await iap.connect();
    return;
  }
}

async function getIapProducts(productIds: string[]) {
  const iap: any = ExpoIAP as any;

  if (productIds.length === 0) return [];

  if (typeof iap.getProductsAsync === "function") {
    const result = await iap.getProductsAsync(productIds);
    return Array.isArray(result) ? result : result?.results ?? [];
  }

  if (typeof iap.getProducts === "function") {
    const result = await iap.getProducts({ skus: productIds });
    return Array.isArray(result) ? result : result?.results ?? [];
  }

  if (typeof iap.getItemsAsync === "function") {
    const result = await iap.getItemsAsync(productIds);
    return Array.isArray(result) ? result : result?.results ?? [];
  }

  return [];
}

async function requestIapPurchase(productId: string) {
  const iap: any = ExpoIAP as any;

  if (typeof iap.purchaseItemAsync === "function") {
    return normalizeIapResult(await iap.purchaseItemAsync(productId));
  }

  if (typeof iap.requestPurchaseAsync === "function") {
    return normalizeIapResult(await iap.requestPurchaseAsync(productId));
  }

  if (typeof iap.requestPurchase === "function") {
    try {
      return normalizeIapResult(await iap.requestPurchase({ sku: productId }));
    } catch (firstError) {
      return normalizeIapResult(
        await iap.requestPurchase({
          skus: [productId],
        })
      );
    }
  }

  throw new Error("In-app purchases are not available in this build.");
}

async function finishIapPurchase(purchase: PurchaseResult | null) {
  if (!purchase) return;

  const iap: any = ExpoIAP as any;

  if (typeof iap.finishTransactionAsync === "function") {
    await iap.finishTransactionAsync(purchase, false);
    return;
  }

  if (typeof iap.finishTransaction === "function") {
    await iap.finishTransaction({
      purchase,
      isConsumable: true,
    });
    return;
  }

  if (typeof iap.consumePurchaseAsync === "function" && purchase.purchaseToken) {
    await iap.consumePurchaseAsync(purchase.purchaseToken);
  }
}

export default function WalletScreen() {
  const router = useRouter();
  const { userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [buyingProductId, setBuyingProductId] = useState<string | null>(null);
  const [iapReady, setIapReady] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [products, setProducts] = useState<CoinProduct[]>([]);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    loadWallet();
  }, [userId]);

  useEffect(() => {
    if (products.length > 0) {
      loadStoreProducts(products);
    }
  }, [products]);

  const cashoutValue = useMemo(() => {
    return `$${((wallet?.lifetime_cashout_cents ?? 0) / 100).toFixed(2)}`;
  }, [wallet?.lifetime_cashout_cents]);

  const storeProductMap = useMemo(() => {
    const map = new Map<string, StoreProduct>();

    for (const item of storeProducts) {
      const id = getStoreProductId(item);
      if (id) map.set(id, item);
    }

    return map;
  }, [storeProducts]);

  async function loadWallet() {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: walletData, error: walletError } = await supabase
        .from("creator_wallets")
        .select(
          "coin_balance, diamond_balance, lifetime_earned_diamonds, lifetime_cashout_cents"
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (walletError) throw walletError;

      if (!walletData) {
        const { data: createdWallet, error: createWalletError } = await supabase
          .from("creator_wallets")
          .insert({ user_id: userId })
          .select(
            "coin_balance, diamond_balance, lifetime_earned_diamonds, lifetime_cashout_cents"
          )
          .maybeSingle();

        if (createWalletError) throw createWalletError;

        setWallet((createdWallet as Wallet | null) ?? null);
      } else {
        setWallet(walletData as Wallet);
      }

      const [{ data: productData, error: productError }, { data: purchaseData, error: purchaseError }] =
        await Promise.all([
          supabase
            .from("coin_products")
            .select(
              "id, product_id, coin_amount, price_cents, currency, title, description"
            )
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          supabase
            .from("coin_purchases")
            .select(
              "id, product_id, coin_amount, price_cents, currency, status, created_at"
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

      if (productError) throw productError;
      if (purchaseError) throw purchaseError;

      setProducts((productData ?? []) as CoinProduct[]);
      setPurchases((purchaseData ?? []) as Purchase[]);
    } catch (error: any) {
      Alert.alert("Wallet Error", error?.message ?? "Could not load wallet.");
    } finally {
      setLoading(false);
    }
  }

  async function loadStoreProducts(nextProducts: CoinProduct[]) {
    try {
      if (Platform.OS === "web") {
        setIapReady(false);
        return;
      }

      await connectIap();

      const productIds = nextProducts
        .map((product) => product.product_id)
        .filter(Boolean);

      const items = await getIapProducts(productIds);

      setStoreProducts((items ?? []) as StoreProduct[]);
      setIapReady(true);
    } catch (error: any) {
      console.log("IAP setup error", error?.message ?? error);
      setIapReady(false);
    }
  }

  async function buyCoinPack(product: CoinProduct) {
    if (!userId || buyingProductId) return;

    try {
      setBuyingProductId(product.product_id);

      if (!iapReady) {
        Alert.alert(
          "Store Not Ready",
          "Coin purchases need a development build or store build with active Google Play / Apple products."
        );
        return;
      }

      const purchase = await requestIapPurchase(product.product_id);

      const { error } = await supabase.rpc("complete_coin_purchase", {
        p_product_id: product.product_id,
      });

      if (error) throw error;

      try {
        await finishIapPurchase(purchase);
      } catch (finishError: any) {
        console.log("Finish purchase warning:", finishError?.message ?? finishError);
      }

      await loadWallet();

      Alert.alert("Coins Added", `${product.coin_amount} coins added.`);
    } catch (error: any) {
      Alert.alert("Purchase Error", error?.message ?? "Failed.");
    } finally {
      setBuyingProductId(null);
    }
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

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/premium" as any)}
            style={styles.premiumButton}
          >
            <Text style={styles.premiumButtonText}>Premium</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Image source={POLYOPEN_LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.eyebrow}>PolyOpen Wallet</Text>
          <Text style={styles.title}>Coins & Creator Earnings</Text>
          <Text style={styles.text}>
            Buy coins to send gifts and tips. Creators earn diamonds from live
            support.
          </Text>

          <View style={styles.storeStatusPill}>
            <Text style={styles.storeStatusText}>
              {iapReady ? "Store Ready" : "Store Setup Needed"}
            </Text>
          </View>
        </View>

        <View style={styles.balanceGrid}>
          <BalanceCard label="Coins" value={String(wallet?.coin_balance ?? 0)} />
          <BalanceCard
            label="Diamonds"
            value={String(wallet?.diamond_balance ?? 0)}
          />
          <BalanceCard
            label="Earned"
            value={String(wallet?.lifetime_earned_diamonds ?? 0)}
          />
          <BalanceCard label="Cashouts" value={cashoutValue} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Buy Coins</Text>

          {products.length === 0 ? (
            <Text style={styles.emptyText}>No coin packs found.</Text>
          ) : (
            products.map((product) => {
              const storeProduct = storeProductMap.get(product.product_id);
              const storePrice = getStorePrice(storeProduct);
              const fallbackPrice = `$${(product.price_cents / 100).toFixed(2)}`;
              const isBuyingThis = buyingProductId === product.product_id;
              const isBuyingAnother = !!buyingProductId && !isBuyingThis;

              return (
                <Pressable
                  key={product.id}
                  onPress={() => buyCoinPack(product)}
                  disabled={!!buyingProductId}
                  style={[
                    styles.productCard,
                    isBuyingAnother ? styles.disabled : null,
                  ]}
                >
                  <View style={styles.productTextWrap}>
                    <Text style={styles.productTitle}>{product.title}</Text>
                    <Text style={styles.productText}>
                      {product.description || `${product.coin_amount} coins`}
                    </Text>
                    <Text style={styles.productSku}>{product.product_id}</Text>
                  </View>

                  <View style={styles.pricePill}>
                    <Text style={styles.priceText}>
                      {isBuyingThis ? "Buying..." : storePrice || fallbackPrice}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Purchase History</Text>

          {purchases.length === 0 ? (
            <Text style={styles.emptyText}>No purchases yet.</Text>
          ) : (
            purchases.map((purchase) => (
              <View key={purchase.id} style={styles.purchaseRow}>
                <View style={styles.purchaseTextWrap}>
                  <Text style={styles.purchaseTitle}>
                    {purchase.coin_amount} Coins
                  </Text>
                  <Text style={styles.purchaseText}>
                    {purchase.status} •{" "}
                    {new Date(purchase.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={styles.purchaseSku}>{purchase.product_id}</Text>
                </View>

                <Text style={styles.purchasePrice}>
                  ${(purchase.price_cents / 100).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BalanceCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceValue}>{value}</Text>
      <Text style={styles.balanceLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.bg },

  loadingScreen: {
    flex: 1,
    backgroundColor: BRAND.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingLogo: {
    width: 130,
    height: 130,
    opacity: 0.14,
    position: "absolute",
  },

  content: {
    padding: 18,
    paddingBottom: 120,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  backButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },

  backButtonText: {
    color: BRAND.text,
    fontWeight: "900",
  },

  premiumButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    borderWidth: 1.5,
    borderColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  premiumButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  heroCard: {
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    padding: 22,
    alignItems: "center",
    marginBottom: 18,
  },

  logo: { width: 100, height: 100 },

  eyebrow: {
    marginTop: 8,
    color: BRAND.pink,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  title: {
    marginTop: 6,
    color: BRAND.text,
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },

  text: {
    marginTop: 10,
    color: BRAND.muted,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
  },

  storeStatusPill: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#111111",
  },

  storeStatusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },

  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },

  balanceCard: {
    width: "47%",
    borderRadius: 22,
    backgroundColor: "#111111",
    padding: 16,
  },

  balanceValue: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
  },

  balanceLabel: {
    marginTop: 4,
    color: "#E8E8E8",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  sectionCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    padding: 18,
    marginBottom: 18,
  },

  sectionTitle: {
    color: BRAND.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
  },

  emptyText: {
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 22,
  },

  productCard: {
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: "#FFF7FB",
    borderWidth: 1.5,
    borderColor: "#F4CFE4",
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  disabled: { opacity: 0.6 },

  productTextWrap: {
    flex: 1,
  },

  productTitle: {
    color: BRAND.text,
    fontSize: 17,
    fontWeight: "900",
  },

  productText: {
    marginTop: 4,
    color: BRAND.muted,
    fontWeight: "700",
  },

  productSku: {
    marginTop: 4,
    color: "#999999",
    fontSize: 11,
    fontWeight: "700",
  },

  pricePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
  },

  priceText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  purchaseRow: {
    borderRadius: 18,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  purchaseTextWrap: {
    flex: 1,
  },

  purchaseTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "900",
  },

  purchaseText: {
    marginTop: 4,
    color: BRAND.muted,
    fontWeight: "700",
  },

  purchaseSku: {
    marginTop: 4,
    color: "#999999",
    fontSize: 11,
    fontWeight: "700",
  },

  purchasePrice: {
    color: BRAND.blue,
    fontWeight: "900",
  },
});