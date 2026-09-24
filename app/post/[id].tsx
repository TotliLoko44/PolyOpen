import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth";
import { BRAND } from "../../lib/brand";
import { deletePost, likePost } from "../../lib/social";
import { supabase } from "../../lib/supabase";
import { PostMediaVideo } from "../../components/PostMediaVideo";

type PostRow = {
  id: string;
  author_id: string;
  caption: string | null;
  text?: string | null;
  visibility: string | null;
  post_type: string | null;
  created_at: string | null;
};

type MediaRow = {
  media_url: string;
  media_type: string | null;
  sort_order?: number | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username?: string | null;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
};

type LikedUserRow = {
  id: string;
  display_name: string | null;
  username?: string | null;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
};

type ReturnTarget = "feed" | "profile" | "browse" | "swipe";

const POLYOPEN_LOGO = require("../../assets/images/polyopen-logo.png");

function formatDate(value?: string | null) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const diffMs = Date.now() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString();
}

export default function PostDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; returnTo?: string }>();
  const { userId } = useAuth();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const returnToRaw = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;

  const returnTo: ReturnTarget | undefined =
    returnToRaw === "feed" ||
    returnToRaw === "profile" ||
    returnToRaw === "browse" ||
    returnToRaw === "swipe"
      ? returnToRaw
      : undefined;

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [post, setPost] = useState<PostRow | null>(null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [author, setAuthor] = useState<ProfileRow | null>(null);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  const [likesVisible, setLikesVisible] = useState(false);
  const [likedUsers, setLikedUsers] = useState<LikedUserRow[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);

  const isMine = useMemo(() => {
    return !!userId && !!post && post.author_id === userId;
  }, [userId, post]);

  const hardFallback = useCallback(() => {
    if (returnTo === "profile") {
      router.replace("/(tabs)/profile" as any);
      return;
    }

    if (returnTo === "browse") {
      router.replace("/(tabs)/browse" as any);
      return;
    }

    if (returnTo === "swipe") {
      router.replace("/(tabs)/swipe" as any);
      return;
    }

    router.replace("/(tabs)/feed" as any);
  }, [returnTo, router]);

  const routeAfterDelete = useCallback(() => {
    setViewerVisible(false);
    setLikesVisible(false);

    setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
        return;
      }

      hardFallback();
    }, 80);
  }, [hardFallback, router]);

  const loadPost = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select("id, author_id, caption, text, visibility, post_type, created_at")
        .eq("id", id)
        .maybeSingle();

      if (postError) throw postError;

      if (!postData) {
        hardFallback();
        return;
      }

      const typedPost = postData as PostRow;
      setPost(typedPost);

      const [
        { data: mediaRows, error: mediaError },
        { data: profileRow, error: profileError },
        { count: likesCount },
        { count: commentsCount },
      ] = await Promise.all([
        supabase
          .from("post_media")
          .select("media_url, media_type, sort_order")
          .eq("post_id", id)
          .order("sort_order", { ascending: true }),

        supabase
          .from("profiles")
          .select("id, username, display_name, profile_photo_url, avatar_url")
          .eq("id", typedPost.author_id)
          .maybeSingle(),

        supabase
          .from("post_likes")
          .select("*", { count: "exact", head: true })
          .eq("post_id", id),

        supabase
          .from("post_comments")
          .select("*", { count: "exact", head: true })
          .eq("post_id", id),
      ]);

      if (mediaError) throw mediaError;
      if (profileError) throw profileError;

      setMedia((mediaRows ?? []) as MediaRow[]);
      setAuthor((profileRow as ProfileRow | null) ?? null);

      setLikeCount(Number(likesCount ?? 0));
      setCommentCount(Number(commentsCount ?? 0));

      if (userId) {
        const { data: likedRow } = await supabase
          .from("post_likes")
          .select("id")
          .eq("post_id", id)
          .eq("user_id", userId)
          .maybeSingle();

        setLiked(Boolean(likedRow));
      }
    } catch (error: any) {
      Alert.alert("Could not load post", error?.message ?? "Please try again.");
      hardFallback();
    } finally {
      setLoading(false);
    }
  }, [hardFallback, id, userId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  async function handleLike() {
    if (!post || !userId) return;

    try {
      const next = await likePost(post.id, userId, liked);

      setLiked(next);

      setLikeCount((prev) => {
        if (next) return prev + 1;
        return Math.max(0, prev - 1);
      });
    } catch (error: any) {
      Alert.alert("Could not update like", error?.message ?? "Please try again.");
    }
  }

  async function handleShare() {
    if (!post) return;

    const text = [
      author?.display_name ? `Post by ${author.display_name}` : "PolyOpen post",
      post.caption ?? post.text ?? "",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      await Share.share({
        message: text || "Check out this post on PolyOpen",
      });
    } catch {}
  }

  function handleEdit() {
    if (!post) return;
    router.push(`/edit-post/${post.id}` as any);
  }

  function handleDelete() {
    if (!post || deleting) return;

    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            await deletePost(post.id);
            routeAfterDelete();
          } catch (error: any) {
            Alert.alert("Delete failed", error?.message ?? "Please try again.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    hardFallback();
  }

  function openViewer(index: number) {
    setViewerIndex(index);
    setViewerVisible(true);
  }

  function openComments() {
    if (!post) return;

    router.push({
      pathname: "/post/comments",
      params: {
        postId: post.id,
        returnTo: returnTo ?? "feed",
      },
    } as any);
  }

  function openAuthorProfile() {
    if (!author?.id) return;
    router.push(`/profile/${author.id}` as any);
  }

  async function openLikes() {
    if (!post?.id) return;

    try {
      setLikesVisible(true);
      setLikesLoading(true);

      const { data: likesRows, error: likesError } = await supabase
        .from("post_likes")
        .select("user_id")
        .eq("post_id", post.id);

      if (likesError) throw likesError;

      const userIds = (likesRows ?? []).map((item: any) => item.user_id);

      if (userIds.length === 0) {
        setLikedUsers([]);
        return;
      }

      const { data: profilesRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, username, profile_photo_url, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      setLikedUsers((profilesRows ?? []) as LikedUserRow[]);
    } catch (error) {
      console.log("OPEN LIKES ERROR:", error);
      setLikedUsers([]);
    } finally {
      setLikesLoading(false);
    }
  }

  function openLikedUserProfile(profileId: string) {
    setLikesVisible(false);
    router.push(`/profile/${profileId}` as any);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.notFoundTitle}>Post not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.screen}>
        <Image source={POLYOPEN_LOGO} style={styles.backgroundLogo} resizeMode="contain" />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>‹ Back</Text>
            </Pressable>

            <Text style={styles.pageTitle}>Post</Text>

            <View style={styles.topSpacer} />
          </View>

          <View style={styles.card}>
            <Pressable onPress={openAuthorProfile} style={styles.authorRow}>
              <View style={styles.avatarWrap}>
                {author?.profile_photo_url || author?.avatar_url ? (
                  <Image
                    source={{
                      uri: author?.profile_photo_url || author?.avatar_url || undefined,
                    }}
                    style={styles.avatar}
                  />
                ) : (
                  <Image source={POLYOPEN_LOGO} style={styles.avatarLogo} resizeMode="contain" />
                )}
              </View>

              <View style={styles.authorTextWrap}>
                <Text style={styles.authorName}>
                  {author?.display_name || "User"}
                </Text>

                <Text style={styles.dateText}>
                  {author?.username ? `@${author.username} • ` : ""}
                  {formatDate(post.created_at)}
                </Text>
              </View>

              <View style={styles.profilePill}>
                <Text style={styles.profilePillText}>Profile</Text>
              </View>
            </Pressable>

            {media.length > 0 ? (
              <View style={styles.mediaList}>
                {media.map((item, index) => {
                  const isVideo = item.media_type === "video";

                  return (
                    <Pressable
                      key={`${item.media_url}-${index}`}
                      onPress={() => openViewer(index)}
                      style={[
                        styles.mediaWrap,
                        {
                          aspectRatio:
                            typeof document !== "undefined" && isVideo
                              ? 4 / 5
                              : 4 / 3,
                        },
                        index === media.length - 1 ? styles.lastMediaWrap : null,
                      ]}
                    >
                      {isVideo ? (
                        <PostMediaVideo uri={item.media_url} />
                      ) : (
                        <Image
                          source={{ uri: item.media_url }}
                          style={styles.media}
                          resizeMode="contain"
                        />
                      )}

                      {isVideo ? (
                        <View style={styles.videoBadge}>
                          <Text style={styles.videoBadgeText}>Tap to open video</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.body}>
              {!!(post.caption || post.text) ? (
                <Text style={styles.bodyText}>
                  {post.caption ?? post.text}
                </Text>
              ) : null}

              <View style={styles.statsRow}>
                <Pressable onPress={openLikes}>
                  <Text style={[styles.statsText, styles.likesPressable]}>
                    {likeCount} like{likeCount === 1 ? "" : "s"}
                  </Text>
                </Pressable>

                <Text style={styles.statsText}>
                  {commentCount} comment{commentCount === 1 ? "" : "s"}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={handleLike}
                  style={[
                    styles.actionButton,
                    liked ? styles.actionButtonActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionButtonText,
                      liked ? styles.actionButtonTextActive : null,
                    ]}
                  >
                    {liked ? "♥ Liked" : "♡ Like"}
                  </Text>
                </Pressable>

                <Pressable onPress={openComments} style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>💬 Comment</Text>
                </Pressable>

                <Pressable onPress={handleShare} style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>↻ Share</Text>
                </Pressable>
              </View>

              <Pressable onPress={openComments} style={styles.openConversationButton}>
                <Text style={styles.openConversationButtonText}>
                  Open conversation
                </Text>
              </Pressable>

              {isMine ? (
                <View style={styles.ownerRow}>
                  <Pressable onPress={handleEdit} style={styles.editButton}>
                    <Text style={styles.editButtonText}>Edit Post</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleDelete}
                    disabled={deleting}
                    style={[
                      styles.deleteButton,
                      deleting ? styles.deleteButtonDisabled : null,
                    ]}
                  >
                    <Text style={styles.deleteButtonText}>
                      {deleting ? "Deleting..." : "Delete"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        <View style={styles.viewerBackdrop}>
          <Pressable
            onPress={() => setViewerVisible(false)}
            style={styles.viewerCloseButton}
          >
            <Text style={styles.viewerCloseText}>Close</Text>
          </Pressable>

          <View style={styles.viewerBody}>
            {media[viewerIndex] ? (
              media[viewerIndex].media_type === "video" ? (
                <PostMediaVideo
                  uri={media[viewerIndex].media_url}
                  controls
                  muted={false}
                  loop={false}
                />
              ) : (
                <Image
                  source={{ uri: media[viewerIndex].media_url }}
                  style={styles.viewerMedia}
                  resizeMode="contain"
                />
              )
            ) : null}
          </View>

          {media.length > 1 ? (
            <View style={styles.viewerNavRow}>
              <Pressable
                disabled={viewerIndex === 0}
                onPress={() => setViewerIndex((prev) => Math.max(0, prev - 1))}
                style={[
                  styles.viewerNavButton,
                  viewerIndex === 0 ? styles.viewerNavDisabled : null,
                ]}
              >
                <Text style={styles.viewerNavText}>Prev</Text>
              </Pressable>

              <Pressable
                disabled={viewerIndex === media.length - 1}
                onPress={() =>
                  setViewerIndex((prev) => Math.min(media.length - 1, prev + 1))
                }
                style={[
                  styles.viewerNavButton,
                  viewerIndex === media.length - 1 ? styles.viewerNavDisabled : null,
                ]}
              >
                <Text style={styles.viewerNavText}>Next</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={likesVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLikesVisible(false)}
      >
        <View style={styles.likesBackdrop}>
          <View style={styles.likesSheet}>
            <View style={styles.likesHeaderRow}>
              <Text style={styles.likesTitle}>Likes</Text>

              <Pressable
                onPress={() => setLikesVisible(false)}
                style={styles.likesCloseButton}
              >
                <Text style={styles.likesCloseText}>Close</Text>
              </Pressable>
            </View>

            {likesLoading ? (
              <View style={styles.likesCenterState}>
                <ActivityIndicator />
                <Text style={styles.likesLoadingText}>Loading likes...</Text>
              </View>
            ) : likedUsers.length === 0 ? (
              <View style={styles.likesEmptyState}>
                <Image
                  source={POLYOPEN_LOGO}
                  style={styles.likesEmptyLogo}
                  resizeMode="contain"
                />
                <Text style={styles.likesEmptyTitle}>No likes yet</Text>
                <Text style={styles.likesEmptyText}>
                  People who like this post will show up here.
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.likesListContent}
              >
                {likedUsers.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => openLikedUserProfile(item.id)}
                    style={styles.likedUserRow}
                  >
                    <View style={styles.likedUserAvatarWrap}>
                      {item.profile_photo_url || item.avatar_url ? (
                        <Image
                          source={{
                            uri:
                              item.profile_photo_url ||
                              item.avatar_url ||
                              undefined,
                          }}
                          style={styles.likedUserAvatar}
                        />
                      ) : (
                        <Image
                          source={POLYOPEN_LOGO}
                          style={styles.likedUserAvatarLogo}
                          resizeMode="contain"
                        />
                      )}
                    </View>

                    <View style={styles.likedUserTextWrap}>
                      <Text style={styles.likedUserName}>
                        {item.display_name || "User"}
                      </Text>

                      {!!item.username ? (
                        <Text style={styles.likedUserUsername}>
                          @{item.username}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.likedUserViewPill}>
                      <Text style={styles.likedUserViewPillText}>View</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },

  backgroundLogo: {
    position: "absolute",
    width: "120%",
    height: "100%",
    alignSelf: "center",
    opacity: 0.04,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    padding: 18,
    paddingBottom: 150,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    fontSize: 14,
  },

  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: BRAND.text,
  },

  topSpacer: {
    width: 72,
  },

  card: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    backgroundColor: "#FFFFFFF7",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 28,
    overflow: "hidden",
  },

  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingBottom: 10,
  },

  avatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
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
    width: 40,
    height: 40,
  },

  authorTextWrap: {
    flex: 1,
    marginLeft: 12,
  },

  authorName: {
    fontSize: 17,
    fontWeight: "900",
    color: BRAND.text,
  },

  dateText: {
    marginTop: 4,
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: "700",
  },

  profilePill: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  profilePillText: {
    color: BRAND.blue,
    fontWeight: "900",
    fontSize: 12,
  },

  mediaList: {
    marginTop: 4,
  },

  mediaWrap: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },

  lastMediaWrap: {
    marginBottom: 0,
  },

  media: {
    width: "100%",
    height: "100%",
    alignSelf: "center",
    backgroundColor: "#000",
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
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },

  body: {
    padding: 14,
    paddingTop: 12,
  },

  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    color: BRAND.text,
    fontWeight: "600",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },

  statsText: {
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: "800",
  },

  likesPressable: {
    textDecorationLine: "underline",
  },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },

  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#E6EEFF",
    alignItems: "center",
    justifyContent: "center",
  },

  actionButtonActive: {
    backgroundColor: "#FFF7FB",
    borderColor: "#F4CFE4",
  },

  actionButtonText: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 13,
  },

  actionButtonTextActive: {
    color: BRAND.pink,
  },

  openConversationButton: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },

  openConversationButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },

  ownerRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  editButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: "#FFF0F7",
    borderWidth: 1.5,
    borderColor: "#F7B8DA",
    alignItems: "center",
    justifyContent: "center",
  },

  editButtonText: {
    color: BRAND.pink,
    fontWeight: "900",
  },

  deleteButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteButtonDisabled: {
    opacity: 0.6,
  },

  deleteButtonText: {
    color: "#fff",
    fontWeight: "900",
  },

  notFoundTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: BRAND.text,
  },

  viewerBackdrop: {
    flex: 1,
    backgroundColor: "#000",
  },

  viewerCloseButton: {
    position: "absolute",
    top: 56,
    right: 18,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  viewerCloseText: {
    color: "#fff",
    fontWeight: "900",
  },

  viewerBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  viewerMedia: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },

  viewerNavRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },

  viewerNavButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  viewerNavDisabled: {
    opacity: 0.35,
  },

  viewerNavText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },

  likesBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },

  likesSheet: {
    maxHeight: "76%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
  },

  likesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  likesTitle: {
    color: BRAND.text,
    fontSize: 26,
    fontWeight: "900",
  },

  likesCloseButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#FFF7FB",
    borderWidth: 1.5,
    borderColor: "#F4CFE4",
    alignItems: "center",
    justifyContent: "center",
  },

  likesCloseText: {
    color: BRAND.pink,
    fontSize: 14,
    fontWeight: "900",
  },

  likesCenterState: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
  },

  likesLoadingText: {
    marginTop: 10,
    color: BRAND.muted,
    fontWeight: "700",
  },

  likesEmptyState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  likesEmptyLogo: {
    width: 80,
    height: 80,
    opacity: 0.2,
  },

  likesEmptyTitle: {
    marginTop: 10,
    color: BRAND.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  likesEmptyText: {
    marginTop: 6,
    color: BRAND.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
  },

  likesListContent: {
    paddingBottom: 26,
  },

  likedUserRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F2",
  },

  likedUserAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: "hidden",
    backgroundColor: "#FFF7FB",
    borderWidth: 1.5,
    borderColor: "#F4CFE4",
    alignItems: "center",
    justifyContent: "center",
  },

  likedUserAvatar: {
    width: "100%",
    height: "100%",
  },

  likedUserAvatarLogo: {
    width: 38,
    height: 38,
  },

  likedUserTextWrap: {
    flex: 1,
    marginLeft: 12,
  },

  likedUserName: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "900",
  },

  likedUserUsername: {
    marginTop: 3,
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: "700",
  },

  likedUserViewPill: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  likedUserViewPillText: {
    color: BRAND.blue,
    fontSize: 12,
    fontWeight: "900",
  },
});