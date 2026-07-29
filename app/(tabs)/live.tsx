import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "../../lib/auth";
import { BRAND } from "../../lib/brand";
import { supabase } from "../../lib/supabase";

const POLYOPEN_LOGO = require("../../assets/images/polyopen-logo.png");

type LiveGift = {
  id: string;
  name: string;
  emoji: string;
  coin_cost: number;
  diamond_value: number;
};

type Wallet = {
  coin_balance: number;
  diamond_balance: number;
  lifetime_earned_diamonds: number;
  lifetime_cashout_cents: number;
};

type LiveRoom = {
  id: string;
  host_id: string;
  title?: string | null;
  topic?: string | null;
  description?: string | null;
  status: string;
  audience?: string | null;
  viewer_count?: number | null;
  total_gifts?: number | null;
  total_diamonds?: number | null;
  created_at?: string | null;
  ended_at?: string | null;
};

type HostProfile = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
};

function getTimeAgo(value?: string | null) {
  if (!value) return "Recently";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function LiveScreen() {
  const router = useRouter();
  const { userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [gifts, setGifts] = useState<LiveGift[]>([]);
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [hostProfiles, setHostProfiles] = useState<Map<string, HostProfile>>(
    new Map()
  );

  useEffect(() => {
    loadLiveData();
  }, [userId]);

  const topGifts = useMemo(() => gifts.slice(0, 6), [gifts]);

  const myLiveRoom = useMemo(() => {
    return (
      rooms.find((room) => room.host_id === userId && room.status === "live") ??
      null
    );
  }, [rooms, userId]);

  async function loadLiveData() {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: walletData } = await supabase
        .from("creator_wallets")
        .select(
          "coin_balance, diamond_balance, lifetime_earned_diamonds, lifetime_cashout_cents"
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (!walletData) {
        const { data: createdWallet } = await supabase
          .from("creator_wallets")
          .insert({ user_id: userId })
          .select(
            "coin_balance, diamond_balance, lifetime_earned_diamonds, lifetime_cashout_cents"
          )
          .maybeSingle();

        setWallet((createdWallet as Wallet | null) ?? null);
      } else {
        setWallet(walletData as Wallet);
      }

      const [
        { data: giftData, error: giftError },
        { data: roomData, error: roomError },
      ] = await Promise.all([
        supabase
          .from("live_gifts")
          .select("id, name, emoji, coin_cost, diamond_value")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("live_rooms")
          .select(
            "id, host_id, title, topic, description, status, audience, viewer_count, total_gifts, total_diamonds, created_at, ended_at"
          )
          .eq("status", "live")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (giftError) throw giftError;
      if (roomError) throw roomError;

      const liveRooms = (roomData ?? []) as LiveRoom[];

      setGifts((giftData ?? []) as LiveGift[]);
      setRooms(liveRooms);

      const hostIds = [
        ...new Set(liveRooms.map((room) => room.host_id).filter(Boolean)),
      ];

      if (hostIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, display_name, username, profile_photo_url, avatar_url")
          .in("id", hostIds);

        setHostProfiles(
          new Map(
            ((profileData ?? []) as HostProfile[]).map((profile) => [
              profile.id,
              profile,
            ])
          )
        );
      } else {
        setHostProfiles(new Map());
      }
    } catch (error: any) {
      Alert.alert("Live Error", error?.message ?? "Could not load live tools.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartLive() {
    if (!userId || busy) return;

    if (myLiveRoom) {
      router.push(`/live-room/${myLiveRoom.id}` as any);
      return;
    }

    try {
      setBusy(true);

      const { data, error } = await supabase
        .from("live_rooms")
        .insert({
          host_id: userId,
          title: "PolyOpen Live",
          topic: "Open conversation",
          description:
            "Live room for community, connection, and real-time support.",
          status: "live",
          audience: "public",
          viewer_count: 0,
          total_gifts: 0,
          total_diamonds: 0,
        })
        .select("id")
        .maybeSingle();

      if (error) throw error;

      const roomId = data?.id;

      if (!roomId) {
        await loadLiveData();
        return;
      }

      router.push(`/live-room/${roomId}` as any);
    } catch (error: any) {
      Alert.alert("Could not start live", error?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEndLive(roomId: string) {
    if (!userId || busy) return;

    try {
      setBusy(true);

      const { error } = await supabase
        .from("live_rooms")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          viewer_count: 0,
        })
        .eq("id", roomId)
        .eq("host_id", userId);

      if (error) throw error;

      await loadLiveData();
    } catch (error: any) {
      Alert.alert("Could not end live", error?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleJoinRoom(room: LiveRoom) {
    router.push(`/live-room/${room.id}` as any);
  }

  function handleGiftPreview(gift: LiveGift) {
    Alert.alert(
      gift.name,
      `${gift.emoji} costs ${gift.coin_cost} coins and gives the streamer ${gift.diamond_value} diamonds.`
    );
  }

  function openBrowse() {
    router.push("/(tabs)/browse" as any);
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Image
          source={POLYOPEN_LOGO}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Image source={POLYOPEN_LOGO} style={styles.logo} resizeMode="contain" />

        <Text style={styles.eyebrow}>PolyOpen Live</Text>
        <Text style={styles.title}>Live monetization hub</Text>
        <Text style={styles.text}>
          Start real LiveKit rooms, preview gifts, track creator wallet earnings,
          and prepare donations and subscriptions.
        </Text>

        <View style={styles.heroButtons}>
          <Pressable
            onPress={handleStartLive}
            disabled={busy}
            style={[styles.primaryButton, busy ? styles.disabledButton : null]}
          >
            <Text style={styles.primaryButtonText}>
              {busy
                ? "Starting..."
                : myLiveRoom
                ? "Return to Your Live"
                : "Start Live"}
            </Text>
          </Pressable>

          <Pressable onPress={openBrowse} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Explore Feed</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <View>
            <Text style={styles.walletEyebrow}>Creator wallet</Text>
            <Text style={styles.walletTitle}>Earnings Preview</Text>
          </View>

          <Pressable onPress={loadLiveData} style={styles.refreshPill}>
            <Text style={styles.refreshPillText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.walletGrid}>
          <Stat label="Coins" value={String(wallet?.coin_balance ?? 0)} />
          <Stat label="Diamonds" value={String(wallet?.diamond_balance ?? 0)} />
          <Stat
            label="Earned"
            value={String(wallet?.lifetime_earned_diamonds ?? 0)}
          />
          <Stat
            label="Cashouts"
            value={`$${((wallet?.lifetime_cashout_cents ?? 0) / 100).toFixed(
              2
            )}`}
          />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Active Live Rooms</Text>
            <Text style={styles.sectionText}>
              {rooms.length} rooms live right now
            </Text>
          </View>
        </View>

        {rooms.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nobody is live yet</Text>
            <Text style={styles.emptyText}>
              Start the first PolyOpen live room and test the creator flow.
            </Text>
          </View>
        ) : (
          rooms.map((room) => {
            const host = hostProfiles.get(room.host_id);
            const hostName =
              host?.display_name || host?.username || "PolyOpen Creator";
            const hostImage = host?.profile_photo_url || host?.avatar_url || null;
            const mine = room.host_id === userId;

            return (
              <View key={room.id} style={styles.roomCard}>
                <Pressable
                  onPress={() => handleJoinRoom(room)}
                  style={styles.roomMain}
                >
                  <View style={styles.hostAvatar}>
                    {hostImage ? (
                      <Image
                        source={{ uri: hostImage }}
                        style={styles.hostImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Image
                        source={POLYOPEN_LOGO}
                        style={styles.hostLogo}
                        resizeMode="contain"
                      />
                    )}
                  </View>

                  <View style={styles.roomInfo}>
                    <View style={styles.livePill}>
                      <Text style={styles.livePillText}>LIVE</Text>
                    </View>

                    <Text style={styles.roomTitle}>
                      {room.title || "PolyOpen Live"}
                    </Text>
                    <Text style={styles.roomHost}>{hostName}</Text>
                    <Text style={styles.roomMeta}>
                      {room.topic || room.description || "Open conversation"} •{" "}
                      {room.viewer_count ?? 0} watching •{" "}
                      {getTimeAgo(room.created_at)}
                    </Text>
                  </View>
                </Pressable>

                {mine ? (
                  <View style={styles.roomActions}>
                    <Pressable
                      onPress={() => handleJoinRoom(room)}
                      style={styles.joinButton}
                    >
                      <Text style={styles.joinButtonText}>Open</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleEndLive(room.id)}
                      style={styles.endButton}
                    >
                      <Text style={styles.endButtonText}>End</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => handleJoinRoom(room)}
                    style={styles.joinButton}
                  >
                    <Text style={styles.joinButtonText}>Join</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Gift Tray</Text>
        <Text style={styles.sectionText}>
          Viewers buy coins, send gifts during live streams, and creators earn
          diamonds.
        </Text>

        {topGifts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No gifts loaded</Text>
            <Text style={styles.emptyText}>
              Check the live_gifts table in Supabase.
            </Text>
          </View>
        ) : (
          <View style={styles.giftGrid}>
            {topGifts.map((gift) => (
              <Pressable
                key={gift.id}
                onPress={() => handleGiftPreview(gift)}
                style={styles.giftCard}
              >
                <Text style={styles.giftEmoji}>{gift.emoji}</Text>
                <Text style={styles.giftName}>{gift.name}</Text>
                <Text style={styles.giftCost}>{gift.coin_cost} coins</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Creator Monetization</Text>

        <Feature
          title="Monthly creator subscriptions"
          text="Fans subscribe to streamers for private lives, supporter badges, exclusive posts, and replay access."
        />
        <Feature
          title="Donations and tips"
          text="Supporters can send one-time donations during live rooms and from creator profiles."
        />
        <Feature
          title="Gift rankings"
          text="Top supporters can be ranked by gifts, diamonds, donations, and subscription loyalty."
        />
        <Feature
          title="Creator payouts"
          text="Diamonds and cashout totals are tracked in creator wallets for future payout tools."
        />
      </View>

      <View style={styles.moneyCard}>
        <Text style={styles.moneyTitle}>Next Build Step</Text>
        <Text style={styles.moneyText}>
          Next we merge gifts, live chat, donations, and subscriber-only controls
          into your existing LiveKit room screen.
        </Text>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureDot} />
      <View style={styles.featureTextWrap}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  content: {
    padding: 18,
    paddingBottom: 140,
  },

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

  heroCard: {
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    padding: 22,
    alignItems: "center",
  },

  logo: {
    width: 120,
    height: 120,
  },

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

  heroButtons: {
    width: "100%",
    marginTop: 20,
    gap: 12,
  },

  primaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.7,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  secondaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    color: BRAND.blue,
    fontSize: 15,
    fontWeight: "900",
  },

  walletCard: {
    marginTop: 18,
    borderRadius: 28,
    backgroundColor: "#111111",
    padding: 18,
  },

  walletHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  walletEyebrow: {
    color: "#FFFFFF",
    opacity: 0.72,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  walletTitle: {
    marginTop: 2,
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
  },

  refreshPill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },

  refreshPillText: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 12,
  },

  walletGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  statCard: {
    width: "47%",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 14,
  },

  statValue: {
    color: BRAND.text,
    fontSize: 22,
    fontWeight: "900",
  },

  statLabel: {
    marginTop: 4,
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  sectionCard: {
    marginTop: 18,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    padding: 18,
  },

  sectionHeader: {
    marginBottom: 10,
  },

  sectionTitle: {
    color: BRAND.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },

  sectionText: {
    color: BRAND.muted,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },

  emptyCard: {
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    padding: 16,
  },

  emptyTitle: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 16,
  },

  emptyText: {
    marginTop: 6,
    color: BRAND.muted,
    lineHeight: 21,
  },

  roomCard: {
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    backgroundColor: "#F8FBFF",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  roomMain: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  hostAvatar: {
    width: 66,
    height: 66,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  hostImage: {
    width: "100%",
    height: "100%",
  },

  hostLogo: {
    width: 52,
    height: 52,
  },

  roomInfo: {
    flex: 1,
    marginLeft: 12,
  },

  livePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    marginBottom: 5,
  },

  livePillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  roomTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "900",
  },

  roomHost: {
    marginTop: 2,
    color: BRAND.blue,
    fontWeight: "800",
    fontSize: 12,
  },

  roomMeta: {
    marginTop: 4,
    color: BRAND.muted,
    fontWeight: "700",
    fontSize: 12,
  },

  roomActions: {
    marginLeft: 10,
    gap: 8,
  },

  joinButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  joinButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  endButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },

  endButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  giftGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  giftCard: {
    width: "30.8%",
    borderRadius: 18,
    backgroundColor: "#FFF7FB",
    borderWidth: 1.5,
    borderColor: "#F4CFE4",
    padding: 12,
    alignItems: "center",
  },

  giftEmoji: {
    fontSize: 32,
  },

  giftName: {
    marginTop: 6,
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 12,
    textAlign: "center",
  },

  giftCost: {
    marginTop: 4,
    color: BRAND.pink,
    fontWeight: "900",
    fontSize: 11,
  },

  featureRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1E8EF",
  },

  featureDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    marginTop: 5,
    marginRight: 12,
  },

  featureTextWrap: {
    flex: 1,
  },

  featureTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "900",
  },

  featureText: {
    marginTop: 4,
    color: BRAND.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },

  moneyCard: {
    marginTop: 18,
    borderRadius: 28,
    backgroundColor: "#111111",
    padding: 18,
  },

  moneyTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },

  moneyText: {
    marginTop: 8,
    color: "#E8E8E8",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
});