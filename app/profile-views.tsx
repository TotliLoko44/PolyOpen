import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BRAND } from "../lib/brand";
import { loadPolyOpenAccess } from "../lib/access";
import { supabase } from "../lib/supabase";

const POLYOPEN_LOGO = require("../assets/images/polyopen-logo.png");

type ViewerProfile = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  state?: string | null;
  viewed_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function ProfileViewsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false);
  const [viewers, setViewers] = useState<ViewerProfile[]>([]);

  useEffect(() => {
    loadViews();
  }, []);

  async function loadViews() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setHasPremiumAccess(false);
        setViewers([]);
        return;
      }

      const access = await loadPolyOpenAccess(user.id);

      setHasPremiumAccess(access.canSeePremiumLikesAndViews);

      const { data: viewRows, error: viewsError } = await supabase
        .from("profile_views")
        .select("viewer_id, created_at")
        .eq("viewed_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (viewsError) throw viewsError;

      const latestByViewer = new Map<string, string>();

      for (const row of viewRows ?? []) {
        if (row.viewer_id && !latestByViewer.has(row.viewer_id)) {
          latestByViewer.set(row.viewer_id, row.created_at);
        }
      }

      const viewerIds = Array.from(latestByViewer.keys());

      if (viewerIds.length === 0) {
        setViewers([]);
        return;
      }

      if (!access.canSeePremiumLikesAndViews) {
        const lockedPreview = viewerIds.slice(0, 6).map((id, index) => ({
          id,
          display_name: "Hidden Viewer",
          username: `locked_${index + 1}`,
          viewed_at: latestByViewer.get(id) ?? null,
        }));

        setViewers(lockedPreview);
        return;
      }

      const { data: profileRows, error: viewerProfilesError } = await supabase
        .from("profiles")
        .select("id, display_name, username, profile_photo_url, avatar_url, city, state")
        .in("id", viewerIds);

      if (viewerProfilesError) throw viewerProfilesError;

      const hydrated = ((profileRows ?? []) as ViewerProfile[])
        .map((profile) => ({
          ...profile,
          viewed_at: latestByViewer.get(profile.id) ?? null,
        }))
        .sort((a, b) => {
          const aTime = a.viewed_at ? new Date(a.viewed_at).getTime() : 0;
          const bTime = b.viewed_at ? new Date(b.viewed_at).getTime() : 0;
          return bTime - aTime;
        });

      setViewers(hydrated);
    } catch (error) {
      console.log("PROFILE VIEWS LOAD ERROR:", error);
      setViewers([]);
    } finally {
      setLoading(false);
    }
  }

  function renderAvatar(item: ViewerProfile, blurred?: boolean) {
    const avatarUrl = item.profile_photo_url || item.avatar_url || null;

    return (
      <View style={[styles.avatarWrap, blurred ? styles.blurredAvatarWrap : null]}>
        {avatarUrl && !blurred ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} resizeMode="cover" />
        ) : (
          <Image source={POLYOPEN_LOGO} style={styles.avatarLogo} resizeMode="contain" />
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <Pressable onPress={loadViews} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Who Viewed You 👀</Text>
      <Text style={styles.subtitle}>
        See who has been checking out your PolyOpen profile.
      </Text>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading profile views...</Text>
        </View>
      ) : !hasPremiumAccess ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          <View style={styles.lockCard}>
            <Text style={styles.lockEmoji}>🔒</Text>
            <Text style={styles.lockTitle}>Unlock Profile Views</Text>
            <Text style={styles.lockText}>
              See exactly who viewed your profile, who keeps coming back, and who
              might be interested. Included with Premium or the Premium + No Ads bundle.
            </Text>

            <Pressable onPress={() => router.push("/premium" as any)} style={styles.unlockButton}>
              <Text style={styles.unlockButtonText}>Unlock Premium</Text>
            </Pressable>
          </View>

          {(viewers.length ? viewers : [1, 2, 3, 4, 5, 6]).slice(0, 6).map((item: any, index) => {
            const fake = typeof item === "number";
            const viewer = fake
              ? {
                  id: String(index),
                  display_name: "Premium viewer",
                  username: "locked",
                  viewed_at: new Date().toISOString(),
                }
              : (item as ViewerProfile);

            return (
              <View key={viewer.id} style={styles.viewerRow}>
                {renderAvatar(viewer, true)}

                <View style={styles.viewerTextWrap}>
                  <Text style={styles.lockedName}>Hidden Viewer</Text>
                  <Text style={styles.lockedMeta}>Unlock Premium to reveal</Text>
                  {!!viewer.viewed_at ? (
                    <Text style={styles.lockedMeta}>Viewed {formatDate(viewer.viewed_at)}</Text>
                  ) : null}
                </View>

                <Text style={styles.lockIcon}>🔒</Text>
              </View>
            );
          })}
        </ScrollView>
      ) : viewers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Image source={POLYOPEN_LOGO} style={styles.emptyLogo} resizeMode="contain" />
          <Text style={styles.emptyTitle}>No views yet</Text>
          <Text style={styles.emptyText}>
            When people view your profile, they will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {viewers.map((item) => {
            const name = item.display_name || item.username || "PolyOpen User";
            const location = [item.city, item.state].filter(Boolean).join(", ");

            return (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/profile/${item.id}` as any)}
                style={styles.viewerRow}
              >
                {renderAvatar(item)}

                <View style={styles.viewerTextWrap}>
                  <Text style={styles.viewerName}>{name}</Text>
                  {!!item.username ? (
                    <Text style={styles.viewerUsername}>@{item.username}</Text>
                  ) : null}
                  {!!location ? <Text style={styles.viewerMeta}>{location}</Text> : null}
                  {!!item.viewed_at ? (
                    <Text style={styles.viewerMeta}>Viewed {formatDate(item.viewed_at)}</Text>
                  ) : null}
                </View>

                <Text style={styles.viewText}>View</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
    padding: 18,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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

  refreshButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  refreshButtonText: {
    color: BRAND.blue,
    fontWeight: "900",
  },

  title: {
    marginTop: 20,
    color: BRAND.text,
    fontSize: 34,
    fontWeight: "900",
  },

  subtitle: {
    marginTop: 4,
    marginBottom: 16,
    color: BRAND.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },

  centerState: {
    marginTop: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    color: BRAND.muted,
    fontWeight: "700",
  },

  listContent: {
    paddingBottom: 120,
  },

  lockCard: {
    backgroundColor: "#111111",
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
    alignItems: "center",
  },

  lockEmoji: {
    fontSize: 42,
  },

  lockTitle: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },

  lockText: {
    marginTop: 8,
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
  },

  unlockButton: {
    marginTop: 18,
    minHeight: 54,
    alignSelf: "stretch",
    borderRadius: 18,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  unlockButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  viewerRow: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 22,
    padding: 12,
    marginBottom: 12,
  },

  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  blurredAvatarWrap: {
    opacity: 0.35,
    backgroundColor: "#E5E7EB",
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
  },

  avatarLogo: {
    width: 44,
    height: 44,
  },

  viewerTextWrap: {
    flex: 1,
    marginLeft: 12,
  },

  viewerName: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "900",
  },

  viewerUsername: {
    marginTop: 2,
    color: BRAND.blue,
    fontSize: 13,
    fontWeight: "800",
  },

  viewerMeta: {
    marginTop: 2,
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: "700",
  },

  lockedName: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "900",
    opacity: 0.55,
  },

  lockedMeta: {
    marginTop: 3,
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: "800",
  },

  lockIcon: {
    fontSize: 20,
    marginLeft: 10,
  },

  viewText: {
    color: BRAND.pink,
    fontWeight: "900",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
  },

  emptyLogo: {
    width: 110,
    height: 110,
    opacity: 0.2,
  },

  emptyTitle: {
    marginTop: 10,
    color: BRAND.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 8,
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});