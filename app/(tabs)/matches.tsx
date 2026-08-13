import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useAuth } from "../../lib/auth";
import { BRAND } from "../../lib/brand";
import { supabase } from "../../lib/supabase";

type ViewerItem = {
  id: string;
  name: string;
  image: string | null;
  location: string;
  viewedAt?: string | null;
};

type SecretAdmirerRpcRow = {
  secret_admirer_id: string;
  admirer_id: string | null;
  created_at: string | null;
  identity_unlocked: boolean;
};

type SecretAdmirerItem = {
  id: string;
  name: string;
  image: string | null;
  location: string;
};

type ConnectionItem = {
  matchId: string;
  userId: string;
  name: string;
  image: string | null;
  location: string;
  matchedAt?: string | null;
};

type ConnectionRow = {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at?: string | null;
};

const POLYOPEN_LOGO = require("../../assets/images/polyopen-logo.png");

function maskName(name: string) {
  if (!name) return "Someone";
  return `${name.charAt(0)}•••`;
}

function formatTimeAgo(value?: string | null) {
  if (!value) return "Recently";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function Avatar({
  uri,
  locked,
  size = 68,
}: {
  uri: string | null;
  locked?: boolean;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.avatarWrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.avatarImage}
          blurRadius={locked ? 24 : 0}
          resizeMode="cover"
        />
      ) : (
        <Image
          source={POLYOPEN_LOGO}
          style={[
            styles.avatarLogo,
            {
              width: size - 18,
              height: size - 18,
              opacity: locked ? 0.35 : 1,
            },
          ]}
          resizeMode="contain"
        />
      )}

      {locked ? (
        <View style={styles.lockBadge}>
          <Text style={styles.lockBadgeText}>🔒</Text>
        </View>
      ) : null}
    </View>
  );
}

function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function PremiumPrompt({
  title,
  text,
  buttonText,
  onPress,
}: {
  title: string;
  text: string;
  buttonText: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.premiumPrompt}>
      <View style={styles.premiumIconBubble}>
        <Text style={styles.premiumIcon}>✨</Text>
      </View>

      <View style={styles.premiumPromptBody}>
        <Text style={styles.premiumPromptTitle}>{title}</Text>
        <Text style={styles.premiumPromptText}>{text}</Text>

        <Pressable onPress={onPress} style={styles.premiumPromptButton}>
          <Text style={styles.premiumPromptButtonText}>{buttonText}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ConnectionsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { width: viewportWidth } = useWindowDimensions();

  const isDesktopWeb = viewportWidth >= 1024;
  const isWideDesktopWeb = viewportWidth >= 1440;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [realConnections, setRealConnections] = useState<ConnectionItem[]>([]);
  const [secretAdmirers, setSecretAdmirers] = useState<SecretAdmirerItem[]>([]);
  const [viewsYou, setViewsYou] = useState<ViewerItem[]>([]);
  const [isPremium, setIsPremium] = useState(false);

  const hiddenAttentionCount = useMemo(() => {
    if (isPremium) return 0;
    return secretAdmirers.length + viewsYou.length;
  }, [isPremium, secretAdmirers.length, viewsYou.length]);

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data: me, error: meError } = await supabase
        .from("profiles")
        .select("is_premium, premium_bundle, premium_expires_at")
        .eq("id", userId)
        .maybeSingle();

      if (meError) throw meError;

      const premiumExpiresAt = me?.premium_expires_at
        ? new Date(me.premium_expires_at).getTime()
        : 0;

      const premiumActive =
        Boolean(me?.is_premium || me?.premium_bundle) &&
        (!me?.premium_expires_at ||
          (!Number.isNaN(premiumExpiresAt) && premiumExpiresAt > Date.now()));

      setIsPremium(premiumActive);

      const [
        { data: admirers, error: admirersError },
        { data: views, error: viewsError },
        { data: matches, error: matchesError },
      ] = await Promise.all([
        supabase.rpc("get_my_secret_admirers"),
        supabase
          .from("profile_views")
          .select("viewer_id, created_at")
          .eq("viewed_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("matches")
          .select("id, user1_id, user2_id, created_at")
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
          .order("created_at", { ascending: false }),
      ]);

      if (admirersError) throw admirersError;
      if (viewsError) throw viewsError;
      if (matchesError) throw matchesError;

      const matchRows = (matches ?? []) as ConnectionRow[];

      const matchedIds = matchRows.map((match) =>
        match.user1_id === userId ? match.user2_id : match.user1_id
      );

      const admirerRows =
        (admirers ?? []) as SecretAdmirerRpcRow[];

      const admirerProfileIds = [
        ...new Set(
          admirerRows
            .map((admirer) => admirer.admirer_id)
            .filter(
              (id): id is string =>
                typeof id === "string" &&
                id.length > 0
            )
        ),
      ];

      const newestViewByUser = new Map<string, string | null>();

      for (const view of views ?? []) {
        if (view.viewer_id && !newestViewByUser.has(view.viewer_id)) {
          newestViewByUser.set(view.viewer_id, view.created_at ?? null);
        }
      }

      const viewIds = [...newestViewByUser.keys()];
      const allProfileIds = [...new Set([...matchedIds, ...admirerProfileIds, ...viewIds])];

      let profilesMap = new Map<string, any>();

      if (allProfileIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select(
            "id, display_name, username, profile_photo_url, avatar_url, city, state"
          )
          .in("id", allProfileIds);

        if (profilesError) throw profilesError;

        profilesMap = new Map(
          (profiles ?? []).map((profile) => [profile.id, profile])
        );
      }

      setRealConnections(
        matchRows.map((match) => {
          const otherId =
            match.user1_id === userId ? match.user2_id : match.user1_id;
          const profile = profilesMap.get(otherId);

          return {
            matchId: match.id,
            userId: otherId,
            name: profile?.display_name || profile?.username || "PolyOpen User",
            image: profile?.profile_photo_url || profile?.avatar_url || null,
            location: [profile?.city, profile?.state].filter(Boolean).join(", "),
            matchedAt: match.created_at ?? null,
          };
        })
      );

      setSecretAdmirers(
        admirerRows.map((admirer) => {
          const profile =
            admirer.admirer_id
              ? profilesMap.get(
                  admirer.admirer_id
                )
              : undefined;

          return {
            id:
              admirer.admirer_id ??
              admirer.secret_admirer_id,
            name:
              profile?.display_name ??
              profile?.full_name ??
              "Secret Admirer",
            image:
              profile?.avatar_url ??
              profile?.image_url ??
              null,
            location:
              profile?.location ?? "",
          };
        })
      );

      setViewsYou(
        viewIds.map((id) => {
          const profile = profilesMap.get(id);

          return {
            id,
            name: profile?.display_name || profile?.username || "Someone",
            image: profile?.profile_photo_url || profile?.avatar_url || null,
            location: [profile?.city, profile?.state].filter(Boolean).join(", "),
            viewedAt: newestViewByUser.get(id) ?? null,
          };
        })
      );
    } catch (error: any) {
      Alert.alert("Error loading connections", error?.message ?? "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openPremium() {
    router.push("/premium" as any);
  }

  function openProfile(id: string, locked = false) {
    if (locked) {
      openPremium();
      return;
    }

    router.push(`/profile/${id}` as any);
  }

  function openChat(matchId: string) {
    router.push(`/chat/${matchId}` as any);
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Image source={POLYOPEN_LOGO} style={styles.loadingLogo} resizeMode="contain" />
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
        />
      }
    >
      {!isPremium && hiddenAttentionCount > 0 ? (
        <View style={styles.conversionCard}>
          <Text style={styles.conversionTitle}>
            {hiddenAttentionCount} people are already watching you
          </Text>
          <Text style={styles.conversionText}>
            Unlock Secret Admirers and Who Viewed You to see exactly who is showing interest.
          </Text>

          <Pressable onPress={openPremium} style={styles.conversionButton}>
            <Text style={styles.conversionButtonText}>Reveal Now</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{realConnections.length}</Text>
          <Text style={styles.statLabel}>Connections</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{secretAdmirers.length}</Text>
          <Text style={styles.statLabel}>Secret Admirers</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{viewsYou.length}</Text>
          <Text style={styles.statLabel}>Views</Text>
        </View>
      </View>

      <View
        style={[
          styles.sectionCard,
          isDesktopWeb
            ? styles.sectionCardDesktop
            : null,
          isWideDesktopWeb
            ? styles.sectionCardWideDesktop
            : null,
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Your Connections</Text>
            <Text style={styles.sectionSubtitle}>
              {realConnections.length} mutual connections
            </Text>
          </View>
        </View>

        {realConnections.length === 0 ? (
          <EmptyCard
            title="No connections yet"
            text="When you and another person like each other, they will appear here."
          />
        ) : (
          realConnections.map((item) => (
            <View
              key={item.matchId}
              style={[
                styles.matchCard,
                isDesktopWeb
                  ? styles.matchCardDesktop
                  : null,
              ]}
            >
              <Pressable
                onPress={() => openProfile(item.userId)}
                style={styles.matchProfileSide}
              >
                <Avatar uri={item.image} />

                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{item.name}</Text>
                  <Text style={styles.personMeta}>
                    {item.location || "PolyOpen member"}
                  </Text>
                  <Text style={styles.lockHint}>
                    Connected {formatTimeAgo(item.matchedAt)}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => openChat(item.matchId)}
                style={styles.chatButton}
              >
                <Text style={styles.chatButtonText}>Chat</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View
        style={[
          styles.sectionCard,
          isDesktopWeb
            ? styles.sectionCardDesktop
            : null,
          isWideDesktopWeb
            ? styles.sectionCardWideDesktop
            : null,
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Secret Admirers</Text>
            <Text style={styles.sectionSubtitle}>{secretAdmirers.length} interested</Text>
          </View>

          {!isPremium ? (
            <Pressable onPress={openPremium} style={styles.unlockPill}>
              <Text style={styles.unlockPillText}>Unlock</Text>
            </Pressable>
          ) : null}
        </View>

        {!isPremium && secretAdmirers.length > 0 ? (
          <PremiumPrompt
            title="You have a Secret Admirer"
            text="Reveal who sent you a Secret Admirer and discover who is interested."
            buttonText="Reveal Admirers"
            onPress={openPremium}
          />
        ) : null}

        {secretAdmirers.length === 0 ? (
          <EmptyCard
            title="No likes yet"
            text="Keep swiping and improving your profile. Likes will show up here."
          />
        ) : (
          secretAdmirers.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => openProfile(item.id, !isPremium)}
              style={({ pressed }) => [
                styles.personCard,
                isDesktopWeb
                  ? styles.personCardDesktop
                  : null,
                pressed && styles.personCardPressed,
              ]}
            >
              <Avatar uri={item.image} locked={!isPremium} />

              <View style={styles.personInfo}>
                <Text style={styles.personName}>
                  {isPremium ? item.name : maskName(item.name)}
                </Text>

                <Text style={styles.personMeta}>
                  {isPremium ? item.location || "PolyOpen member" : "Upgrade to reveal"}
                </Text>

                <Text style={styles.lockHint}>Sent you a Secret Admirer</Text>
              </View>

              <Text style={styles.chevron}>{isPremium ? "›" : "🔒"}</Text>
            </Pressable>
          ))
        )}
      </View>

      <View
        style={[
          styles.sectionCard,
          isDesktopWeb
            ? styles.sectionCardDesktop
            : null,
          isWideDesktopWeb
            ? styles.sectionCardWideDesktop
            : null,
        ]}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Who Viewed You</Text>
            <Text style={styles.sectionSubtitle}>{viewsYou.length} profile views</Text>
          </View>

          {!isPremium ? (
            <Pressable onPress={openPremium} style={styles.unlockPill}>
              <Text style={styles.unlockPillText}>Unlock</Text>
            </Pressable>
          ) : null}
        </View>

        {!isPremium && viewsYou.length > 0 ? (
          <PremiumPrompt
            title="Your profile is getting attention"
            text="See exactly who opened your profile and what kind of people are checking you out."
            buttonText="Reveal Views"
            onPress={openPremium}
          />
        ) : null}

        {viewsYou.length === 0 ? (
          <EmptyCard
            title="No views yet"
            text="Views appear here when people open your profile from Feed, Speed Date, or Connections."
          />
        ) : (
          viewsYou.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => openProfile(item.id, !isPremium)}
              style={({ pressed }) => [
                styles.personCard,
                isDesktopWeb
                  ? styles.personCardDesktop
                  : null,
                pressed && styles.personCardPressed,
              ]}
            >
              <Avatar uri={item.image} locked={!isPremium} />

              <View style={styles.personInfo}>
                <Text style={styles.personName}>
                  {isPremium ? item.name : maskName(item.name)}
                </Text>

                <Text style={styles.personMeta}>
                  {isPremium ? item.location || "Viewed your profile" : "Upgrade to reveal"}
                </Text>

                <Text style={styles.lockHint}>
                  {isPremium ? formatTimeAgo(item.viewedAt) : "Viewed your profile"}
                </Text>
              </View>

              <Text style={styles.chevron}>{isPremium ? "›" : "🔒"}</Text>
            </Pressable>
          ))
        )}
      </View>

      {!isPremium ? (
        <Pressable onPress={openPremium} style={styles.bottomUpgradeCard}>
          <Text style={styles.bottomUpgradeTitle}>Unlock your hidden attention</Text>
          <Text style={styles.bottomUpgradeText}>
            Premium reveals Secret Admirers, profile views, and priority visibility tools.
          </Text>
          <View style={styles.bottomUpgradeButton}>
            <Text style={styles.bottomUpgradeButtonText}>Go Premium</Text>
          </View>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  content: {
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center",
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

  conversionCard: {
    padding: 18,
    borderRadius: 26,
    backgroundColor: "#111111",
    marginBottom: 16,
  },

  conversionTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 29,
  },

  conversionText: {
    marginTop: 8,
    color: "#E8E8E8",
    fontWeight: "700",
    lineHeight: 22,
  },

  conversionButton: {
    marginTop: 16,
    height: 54,
    borderRadius: 18,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  conversionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
  },

  statNumber: {
    color: BRAND.text,
    fontSize: 22,
    fontWeight: "900",
  },

  statLabel: {
    marginTop: 4,
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  sectionCard: {
    padding: 18,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E8D8E4",
    marginBottom: 18,
  },

  sectionCardDesktop: {
    padding: 22,
    borderRadius: 30,
  },

  sectionCardWideDesktop: {
    padding: 26,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },

  sectionHeaderText: {
    flex: 1,
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: BRAND.text,
  },

  sectionSubtitle: {
    marginTop: 4,
    color: BRAND.muted,
    fontWeight: "700",
  },

  unlockPill: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
  },

  unlockPillText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  premiumPrompt: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 22,
    backgroundColor: "#FFF7FB",
    borderWidth: 1.5,
    borderColor: "#F4CFE4",
  },

  premiumPromptBody: {
    flex: 1,
  },

  premiumIconBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  premiumIcon: {
    fontSize: 22,
  },

  premiumPromptTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "900",
  },

  premiumPromptText: {
    marginTop: 5,
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 20,
  },

  premiumPromptButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
  },

  premiumPromptButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  matchCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    padding: 12,
    borderRadius: 22,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#DCE5FF",
  },

  matchCardDesktop: {
    minHeight: 98,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },

  matchProfileSide: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  chatButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  chatButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  personCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    padding: 12,
    borderRadius: 22,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#DCE5FF",
  },

  personCardDesktop: {
    minHeight: 96,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },

  personCardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },

  avatarWrap: {
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  avatarLogo: {
    opacity: 1,
  },

  lockBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  lockBadgeText: {
    fontSize: 12,
  },

  personInfo: {
    marginLeft: 12,
    flex: 1,
  },

  personName: {
    fontWeight: "900",
    color: BRAND.text,
    fontSize: 17,
  },

  personMeta: {
    marginTop: 4,
    color: BRAND.muted,
    fontWeight: "700",
  },

  lockHint: {
    marginTop: 5,
    color: BRAND.pink,
    fontWeight: "900",
    fontSize: 12,
  },

  chevron: {
    fontSize: 24,
    color: BRAND.text,
    fontWeight: "900",
    marginLeft: 10,
  },

  emptyCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E8D8E4",
  },

  emptyTitle: {
    color: BRAND.text,
    fontSize: 17,
    fontWeight: "900",
  },

  emptyText: {
    marginTop: 6,
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 21,
  },

  bottomUpgradeCard: {
    padding: 18,
    borderRadius: 28,
    backgroundColor: "#111111",
    marginBottom: 18,
  },

  bottomUpgradeTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },

  bottomUpgradeText: {
    marginTop: 8,
    color: "#E8E8E8",
    fontWeight: "700",
    lineHeight: 22,
  },

  bottomUpgradeButton: {
    marginTop: 16,
    height: 54,
    borderRadius: 18,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  bottomUpgradeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
});