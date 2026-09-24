import React, { useMemo } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PostMediaVideo } from "../../components/PostMediaVideo";
import { BRAND } from "../../lib/brand";
import type { FeedItem } from "../../lib/social";

type Props = {
  item: FeedItem;
  isLiked: boolean;
  onLikePress: (postId: string) => void;
  onCommentPress: (postId: string) => void;
  onSharePress: (postId: string) => void;
  onOpenPost: (postId: string) => void;
  onOpenAuthor: (authorId: string) => void;
};

const POLYOPEN_LOGO = require("../../assets/images/polyopen-logo.png");

function formatTime(value?: string | null) {
  if (!value) return "";

  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return "";

  const diffMs = Date.now() - created.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return created.toLocaleDateString();
}

function formatCount(value?: number | null) {
  const count = Number(value ?? 0);

  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`;
  }

  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  }

  return String(count);
}

function isVideoPost(
  row: FeedItem & Record<string, any>,
  mediaUrl?: string | null,
) {
  const cleanUrl = String(mediaUrl ?? "")
    .split("?")[0]
    .toLowerCase();

  return (
    row.post_type === "video" ||
    row.media_type === "video" ||
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.endsWith(".mov") ||
    cleanUrl.endsWith(".m4v") ||
    cleanUrl.endsWith(".webm")
  );
}

export default function PostCard({
  item,
  isLiked,
  onLikePress,
  onCommentPress,
  onSharePress,
  onOpenPost,
  onOpenAuthor,
}: Props) {
  const row = item as FeedItem & Record<string, any>;

  const authorName =
    row.display_name || row.username || row.author_name || "User";

  const username = row.username ? `@${row.username}` : "PolyOpen member";

  const authorImage =
    row.profile_photo_url ||
    row.avatar_url ||
    row.author_avatar_url ||
    row.author_avatar ||
    null;

  const mediaUrl =
    row.first_media_url ||
    row.media_url ||
    (Array.isArray(row.media_urls) && row.media_urls.length > 0
      ? row.media_urls[0]
      : null) ||
    null;

  const caption = String(row.caption || "").trim();
  const hasMedia = Boolean(mediaUrl);
  const isVideo = isVideoPost(row, mediaUrl);

  const metaLine = useMemo(() => {
    const time = formatTime(item.created_at);
    return time ? `${username} • ${time}` : username;
  }, [item.created_at, username]);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onOpenAuthor(item.author_id)}
        style={styles.headerRow}
      >
        <View style={styles.avatarWrap}>
          {authorImage ? (
            <Image
              source={{ uri: authorImage }}
              style={styles.avatar}
              resizeMode="cover"
            />
          ) : (
            <Image
              source={POLYOPEN_LOGO}
              style={styles.avatarLogo}
              resizeMode="contain"
            />
          )}
        </View>

        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.authorName}>
            {authorName}
          </Text>
          <Text numberOfLines={1} style={styles.timeText}>
            {metaLine}
          </Text>
        </View>

        <View style={styles.openProfilePill}>
          <Text style={styles.openProfilePillText}>Profile</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => onOpenPost(item.post_id)}
        style={styles.bodyPress}
      >
        {caption ? (
          <Text numberOfLines={hasMedia ? 5 : 8} style={styles.caption}>
            {caption}
          </Text>
        ) : null}

        {mediaUrl ? (
          <View
            style={[
              styles.mediaWrap,
              Platform.OS === "web" ? styles.mediaWrapWeb : null,
            ]}
          >
            {isVideo ? (
              <>
                <PostMediaVideo
                  uri={mediaUrl}
                  fit={Platform.OS === "web" ? "contain" : "cover"}
                />

                <View style={styles.videoBadge}>
                  <Text style={styles.videoBadgeText}>Video</Text>
                </View>
              </>
            ) : (
              <Image
                source={{ uri: mediaUrl }}
                style={styles.media}
                resizeMode={Platform.OS === "web" ? "contain" : "cover"}
              />
            )}
          </View>
        ) : null}

        {!caption && !mediaUrl ? (
          <View style={styles.emptyPostBox}>
            <Image
              source={POLYOPEN_LOGO}
              style={styles.emptyPostLogo}
              resizeMode="contain"
            />
            <Text style={styles.emptyPostText}>Open post</Text>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {formatCount(item.like_count)} like
          {Number(item.like_count ?? 0) === 1 ? "" : "s"}
        </Text>
        <Text style={styles.countText}>
          {formatCount(item.comment_count)} comment
          {Number(item.comment_count ?? 0) === 1 ? "" : "s"}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => onLikePress(item.post_id)}
          style={[
            styles.actionButton,
            isLiked ? styles.actionButtonActive : null,
          ]}
        >
          <Text
            style={[
              styles.actionText,
              isLiked ? styles.actionTextActive : null,
            ]}
          >
            {isLiked ? "♥ Liked" : "♡ Like"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onCommentPress(item.post_id)}
          style={styles.actionButton}
        >
          <Text style={styles.actionText}>💬 Comment</Text>
        </Pressable>

        <Pressable
          onPress={() => onSharePress(item.post_id)}
          style={styles.actionButton}
        >
          <Text style={styles.actionText}>↻ Share</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => onOpenPost(item.post_id)}
        style={styles.openThreadButton}
      >
        <Text style={styles.openThreadText}>Open conversation</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFFF7",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 26,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },

  avatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: "#FFF7FB",
    borderWidth: 1.5,
    borderColor: "#F4CFE4",
    alignItems: "center",
    justifyContent: "center",
  },

  avatar: {
    width: "100%",
    height: "100%",
  },

  avatarLogo: {
    width: 42,
    height: 42,
  },

  headerText: {
    marginLeft: 10,
    flex: 1,
  },

  authorName: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 16,
  },

  timeText: {
    color: BRAND.muted,
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },

  openProfilePill: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  openProfilePillText: {
    color: BRAND.blue,
    fontWeight: "900",
    fontSize: 12,
  },

  bodyPress: {
    minHeight: 10,
  },

  caption: {
    color: BRAND.text,
    fontSize: 15.5,
    lineHeight: 23,
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 12,
    fontWeight: "600",
  },

  mediaWrap: {
    width: "100%",
    height: 340,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  mediaWrapWeb: {
    height: "auto",
    aspectRatio: 4 / 5,
  },

  media: {
    width: "100%",
    height: "100%",
    backgroundColor: "#111111",
  },

  videoBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(0,0,0,0.68)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  videoBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },

  emptyPostBox: {
    marginHorizontal: 14,
    marginBottom: 12,
    minHeight: 120,
    borderRadius: 22,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyPostLogo: {
    width: 62,
    height: 62,
    opacity: 0.8,
  },

  emptyPostText: {
    marginTop: 8,
    color: BRAND.muted,
    fontWeight: "900",
  },

  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 8,
  },

  countText: {
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: "800",
  },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 8,
  },

  actionButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#E6EEFF",
  },

  actionButtonActive: {
    backgroundColor: "#FFF7FB",
    borderColor: "#F4CFE4",
  },

  actionText: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 13,
  },

  actionTextActive: {
    color: BRAND.pink,
  },

  openThreadButton: {
    marginHorizontal: 10,
    marginBottom: 10,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },

  openThreadText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
});
