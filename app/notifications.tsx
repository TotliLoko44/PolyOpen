import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BRAND } from "../lib/brand";
import { supabase } from "../lib/supabase";

const POLYOPEN_LOGO = require("../assets/images/polyopen-logo.png");

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id?: string | null;
  type: string;
  title: string;
  body?: string | null;
  data?: any;
  read_at?: string | null;
  created_at: string;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function getPostId(data: any) {
  return data?.postId ?? data?.post_id ?? data?.postID ?? null;
}

function getCommentId(data: any) {
  return data?.commentId ?? data?.comment_id ?? data?.commentID ?? null;
}

function getMatchId(data: any) {
  return data?.matchId ?? data?.match_id ?? data?.matchID ?? null;
}

function getProfileId(data: any, actorId?: string | null) {
  return (
    data?.profileId ??
    data?.profile_id ??
    data?.actorId ??
    data?.actor_id ??
    data?.likerId ??
    data?.liker_id ??
    data?.viewerId ??
    data?.viewer_id ??
    data?.profileLikeId ??
    data?.profile_like_id ??
    data?.profileViewId ??
    data?.profile_view_id ??
    data?.userId ??
    data?.user_id ??
    actorId ??
    null
  );
}

function isProfileLikeNotification(type: string, title?: string | null, data?: any) {
  const normalizedType = String(type || "").toLowerCase();
  const normalizedTitle = String(title || "").toLowerCase();
  const kind = String(data?.kind || "").toLowerCase();

  return (
    kind === "profile_like" ||
    kind === "swipe_like" ||
    normalizedType === "profile_like" ||
    normalizedType === "swipe_like" ||
    normalizedType === "liked_profile" ||
    normalizedTitle.includes("profile like") ||
    normalizedTitle.includes("liked your profile")
  );
}

function isProfileViewNotification(type: string, title?: string | null, data?: any) {
  const normalizedType = String(type || "").toLowerCase();
  const normalizedTitle = String(title || "").toLowerCase();
  const kind = String(data?.kind || "").toLowerCase();

  return (
    kind === "profile_view" ||
    kind === "viewed_profile" ||
    normalizedType === "view" ||
    normalizedType === "profile_view" ||
    normalizedType === "viewed_profile" ||
    normalizedTitle.includes("viewed your profile")
  );
}

function getNotificationIcon(type: string, title?: string | null, data?: any) {
  if (isProfileLikeNotification(type, title, data)) return "💗";
  if (isProfileViewNotification(type, title, data)) return "🔔";
  if (type === "follow") return "👤";
  if (type === "like" || type === "post_like") return "♥";
  if (type === "comment" || type === "post_comment" || type === "comment_reply") return "💬";
  if (type === "match") return "💞";
  return "🔔";
}

export default function NotificationsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel("notifications-screen")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => loadNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadNotifications() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setNotifications([]);
        return;
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, actor_id, type, title, body, data, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      setNotifications((data ?? []) as NotificationRow[]);
    } catch (error) {
      console.log("NOTIFICATIONS LOAD ERROR:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);

      if (error) throw error;

      await loadNotifications();
    } catch (error) {
      console.log("MARK ALL READ ERROR:", error);
    }
  }

  async function markOneRead(id: string) {
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("id", id)
        .is("read_at", null);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read_at: now } : item))
      );
    } catch (error) {
      console.log("MARK ONE READ ERROR:", error);
    }
  }

  async function openNotification(item: NotificationRow) {
    if (!item.read_at) {
      await markOneRead(item.id);
    }

    const data = item.data ?? {};
    const postId = getPostId(data);
    const commentId = getCommentId(data);
    const matchId = getMatchId(data);
    const profileId = getProfileId(data, item.actor_id);

    if (isProfileLikeNotification(item.type, item.title, data) && profileId) {
      router.push({
        pathname: "/profile/[userId]",
        params: {
          userId: profileId,
          source: "profile_like_notification",
          lockedPreview: "1",
          returnTo: "notifications",
        },
      } as any);
      return;
    }

    if (isProfileViewNotification(item.type, item.title, data) && profileId) {
      router.push({
        pathname: "/profile/[userId]",
        params: {
          userId: profileId,
          source: "profile_view_notification",
          lockedPreview: "1",
          returnTo: "notifications",
        },
      } as any);
      return;
    }

    if (
      (item.type === "comment" ||
        item.type === "post_comment" ||
        item.type === "comment_reply") &&
      postId
    ) {
      router.push({
        pathname: "/post/comments",
        params: {
          postId,
          commentId: commentId ?? "",
          returnTo: "notifications",
        },
      } as any);
      return;
    }

    if ((item.type === "like" || item.type === "post_like") && postId) {
      router.push({
        pathname: "/post/[id]",
        params: {
          id: postId,
          returnTo: "notifications",
        },
      } as any);
      return;
    }

    if ((item.type === "match" || item.type === "message") && matchId) {
      router.push(`/chat/${matchId}` as any);
      return;
    }

    if (item.type === "follow" && profileId) {
      router.push(`/profile/${profileId}` as any);
      return;
    }

    if (postId && commentId) {
      router.push({
        pathname: "/post/comments",
        params: {
          postId,
          commentId,
          returnTo: "notifications",
        },
      } as any);
      return;
    }

    if (postId) {
      router.push({
        pathname: "/post/[id]",
        params: {
          id: postId,
          returnTo: "notifications",
        },
      } as any);
      return;
    }

    if (matchId) {
      router.push(`/chat/${matchId}` as any);
      return;
    }

    if (profileId) {
      router.push(`/profile/${profileId}` as any);
      return;
    }

    await loadNotifications();
  }

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.pageContent,
          Platform.OS === "web" ? styles.pageContentWeb : null,
        ]}
      >
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <Pressable onPress={markAllRead} style={styles.markReadButton}>
          <Text style={styles.markReadButtonText}>
            {unreadCount > 0 ? `Mark read (${unreadCount})` : "Mark read"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.subtitle}>
        Likes, follows, comments, matches, and account updates
      </Text>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyCard}>
          <Image source={POLYOPEN_LOGO} style={styles.emptyLogo} resizeMode="contain" />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            When someone follows you, likes your post, comments, or matches with
            you, it will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {notifications.map((item) => {
            const unread = !item.read_at;

            return (
              <Pressable
                key={item.id}
                onPress={() => openNotification(item)}
                style={[styles.notificationRow, unread ? styles.unreadRow : null]}
              >
                <View style={styles.iconBubble}>
                  <Text style={styles.iconText}>
                    {getNotificationIcon(item.type, item.title, item.data)}
                  </Text>
                </View>

                <View style={styles.notificationTextWrap}>
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  {!!item.body ? (
                    <Text style={styles.notificationBody}>{item.body}</Text>
                  ) : null}
                  <Text style={styles.notificationDate}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>

                {unread ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
    padding: 18,
  },

  pageContent: {
    flex: 1,
    width: "100%",
  },

  pageContentWeb: {
    maxWidth: 960,
    alignSelf: "center",
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

  markReadButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  markReadButtonText: {
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

  notificationRow: {
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

  unreadRow: {
    borderColor: "#DCE5FF",
    backgroundColor: "#F8FBFF",
  },

  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },

  iconText: {
    fontSize: 22,
  },

  notificationTextWrap: {
    flex: 1,
    marginLeft: 12,
  },

  notificationTitle: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "900",
  },

  notificationBody: {
    marginTop: 3,
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },

  notificationDate: {
    marginTop: 5,
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: "700",
  },

  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND.pink,
    marginLeft: 10,
  },
});