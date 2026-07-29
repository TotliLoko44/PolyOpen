import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { supabase } from "../lib/supabase";

const POLYOPEN_LOGO = require("../assets/images/polyopen-logo.png");

type FollowProfile = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  state?: string | null;
};

export default function FollowsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const rawUserId = params.userId;
  const rawType = params.type;

  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
  const type = Array.isArray(rawType) ? rawType[0] : rawType;

  const isFollowers = type === "followers";

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<FollowProfile[]>([]);

  const title = useMemo(() => {
    return isFollowers ? "Followers" : "Following";
  }, [isFollowers]);

  async function loadFollows() {
    if (!userId) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const columnToSelect = isFollowers ? "follower_id" : "following_id";
      const columnToFilter = isFollowers ? "following_id" : "follower_id";

      const { data: followRows, error: followError } = await supabase
        .from("follows")
        .select(columnToSelect)
        .eq(columnToFilter, userId);

      if (followError) throw followError;

      const ids = Array.from(
        new Set(
          ((followRows ?? []) as any[])
            .map((row) => row[columnToSelect])
            .filter(Boolean) as string[]
        )
      );

      if (ids.length === 0) {
        setProfiles([]);
        return;
      }

      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, username, profile_photo_url, avatar_url, city, state")
        .in("id", ids);

      if (profileError) throw profileError;

      setProfiles((profileRows ?? []) as FollowProfile[]);
    } catch (error) {
      console.log("FOLLOWS LOAD ERROR:", error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFollows();
  }, [userId, type]);

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <Pressable onPress={loadFollows} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{title}</Text>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading {title.toLowerCase()}...</Text>
        </View>
      ) : profiles.length === 0 ? (
        <View style={styles.emptyCard}>
          <Image source={POLYOPEN_LOGO} style={styles.emptyLogo} resizeMode="contain" />
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyText}>
            {isFollowers
              ? "Followers will appear here when people follow this profile."
              : "Profiles this user follows will appear here."}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {profiles.map((item) => {
            const avatarUrl = item.profile_photo_url || item.avatar_url || null;
            const name = item.display_name || item.username || "PolyOpen User";
            const location = [item.city, item.state].filter(Boolean).join(", ");

            return (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/profile/${item.id}` as any)}
                style={styles.row}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} resizeMode="cover" />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Image
                      source={POLYOPEN_LOGO}
                      style={styles.avatarFallbackLogo}
                      resizeMode="contain"
                    />
                  </View>
                )}

                <View style={styles.userTextWrap}>
                  <Text style={styles.name}>{name}</Text>
                  {!!item.username ? <Text style={styles.username}>@{item.username}</Text> : null}
                  {!!location ? <Text style={styles.location}>{location}</Text> : null}
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
    marginBottom: 16,
    color: BRAND.text,
    fontSize: 34,
    fontWeight: "900",
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

  listContent: {
    paddingBottom: 120,
  },

  row: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 22,
    padding: 12,
    marginBottom: 12,
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#F3F7FF",
  },

  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarFallbackLogo: {
    width: 46,
    height: 46,
  },

  userTextWrap: {
    flex: 1,
    marginLeft: 12,
  },

  name: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "900",
  },

  username: {
    marginTop: 2,
    color: BRAND.blue,
    fontSize: 13,
    fontWeight: "800",
  },

  location: {
    marginTop: 2,
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: "700",
  },

  viewText: {
    color: BRAND.pink,
    fontWeight: "900",
  },
});