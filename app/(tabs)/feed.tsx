import { useFocusEffect, useRouter } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { getBlockedUserIds } from "../../lib/block";
import { BRAND } from "../../lib/brand";
import {
  createLikeNotification,
  getProfileDisplayName,
} from "../../lib/notifications";
import {
  getFeedForUser,
  likePost,
  repostPost,
  type FeedItem,
} from "../../lib/social";
import { supabase } from "../../lib/supabase";
import PostCard from "../components/PostCard";

type FeedMode = "explore" | "following" | "mine";

const POLYOPEN_LOGO = require("../../assets/images/polyopen-logo.png");

function AdCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.adCard}>
      <View style={styles.adTopRow}>
        <Image source={POLYOPEN_LOGO} style={styles.adLogo} resizeMode="contain" />

        <View style={{ flex: 1 }}>
          <Text style={styles.adLabel}>Sponsored</Text>
          <Text style={styles.adTitle}>Advertise on PolyOpen</Text>
        </View>
      </View>

      <Text style={styles.adText}>
        Reach people who move differently. Promote your brand, event, service,
        retreat, podcast, or community inside PolyOpen.
      </Text>

      <View style={styles.adButton}>
        <Text style={styles.adButtonText}>Learn More</Text>
      </View>
    </Pressable>
  );
}

function ModeButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.switchButton, selected ? styles.switchActive : null]}
    >
      <Text style={selected ? styles.switchTextActive : styles.switchText}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();

  const isDesktopWeb = viewportWidth >= 1024;
  const isWideDesktopWeb = viewportWidth >= 1440;

  const [mode, setMode] = useState<FeedMode>("explore");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [noAdsActive, setNoAdsActive] = useState(false);
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Record<string, boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  const loadPosts = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        const userId = user?.id ?? null;
        setMyUserId(userId);

        if (!userId) {
          setPosts([]);
          setLikedPostIds({});
          setCommentCounts({});
          setFollowingIds([]);
          setNoAdsActive(false);
          return;
        }

        const [
          { data: followRows, error: followError },
          { data: profileData, error: profileError },
          feed,
          blockedIds,
        ] = await Promise.all([
          supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", userId),
          supabase
            .from("profiles")
            .select("no_ads, premium_bundle")
            .eq("id", userId)
            .maybeSingle(),
          getFeedForUser(userId, 75, 0),
          getBlockedUserIds(userId),
        ]);

        if (followError) throw followError;
        if (profileError) throw profileError;

        setNoAdsActive(Boolean(profileData?.no_ads || profileData?.premium_bundle));

        const realFollowingIds = Array.from(
          new Set(
            ((followRows ?? []) as { following_id?: string | null }[])
              .map((row) => row.following_id)
              .filter(Boolean) as string[]
          )
        );

        setFollowingIds(realFollowingIds);

        const visibleFeed = feed.filter(
          (item) => !!item.author_id && !blockedIds.includes(item.author_id)
        );

        const filtered =
          mode === "following"
            ? visibleFeed.filter((item) =>
                realFollowingIds.includes(item.author_id ?? "")
              )
            : mode === "mine"
            ? visibleFeed.filter((item) => item.author_id === userId)
            : visibleFeed;

        setPosts(filtered);

        const countsMap: Record<string, number> = {};
        for (const item of filtered) {
          countsMap[item.post_id] = item.comment_count ?? 0;
        }
        setCommentCounts(countsMap);

        const postIds = filtered.map((item) => item.post_id);

        if (postIds.length === 0) {
          setLikedPostIds({});
          return;
        }

        const { data: likesData, error: likesError } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", userId)
          .in("post_id", postIds);

        if (likesError) throw likesError;

        const likedMap: Record<string, boolean> = {};
        for (const row of likesData ?? []) {
          likedMap[row.post_id] = true;
        }

        setLikedPostIds(likedMap);
      } catch (error) {
        console.log("FEED LOAD ERROR:", error);
        setPosts([]);
        setLikedPostIds({});
        setCommentCounts({});
        setFollowingIds([]);
        setNoAdsActive(false);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mode]
  );

  useEffect(() => {
    loadPosts(true);

    const commentsChannel = supabase
      .channel("feed-post-comments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments" },
        () => loadPosts(false)
      )
      .subscribe();

    const postsChannel = supabase
      .channel("feed-posts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => loadPosts(false)
      )
      .subscribe();

    const likesChannel = supabase
      .channel("feed-post-likes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => loadPosts(false)
      )
      .subscribe();

    const followsChannel = supabase
      .channel("feed-follows")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows" },
        () => loadPosts(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(followsChannel);
    };
  }, [loadPosts]);

  useFocusEffect(
    useCallback(() => {
      loadPosts(false);
    }, [loadPosts])
  );

  const renderedPosts = useMemo(() => {
    return posts.map((post) => ({
      ...post,
      like_count: post.like_count ?? 0,
      comment_count: commentCounts[post.post_id] ?? post.comment_count ?? 0,
    }));
  }, [posts, commentCounts]);

  async function handleLike(postId: string) {
    if (!myUserId) {
      Alert.alert("Not signed in", "Please log in again.");
      return;
    }

    const alreadyLiked = !!likedPostIds[postId];
    const post = renderedPosts.find((item) => item.post_id === postId);

    try {
      const nextLiked = await likePost(postId, myUserId, alreadyLiked);

      setLikedPostIds((prev) => ({
        ...prev,
        [postId]: nextLiked,
      }));

      setPosts((prev) =>
        prev.map((item) =>
          item.post_id === postId
            ? {
                ...item,
                like_count: Math.max(
                  0,
                  (item.like_count ?? 0) + (nextLiked ? 1 : -1)
                ),
              }
            : item
        )
      );

      if (nextLiked && post?.author_id && post.author_id !== myUserId) {
        try {
          const likerName = await getProfileDisplayName(myUserId);

          await createLikeNotification({
            postOwnerId: post.author_id,
            likerUserId: myUserId,
            likerName,
            postId,
          });
        } catch (notificationError) {
          console.log("LIKE NOTIFICATION ERROR:", notificationError);
        }
      }
    } catch (error: any) {
      Alert.alert("Could not update like", error?.message ?? "Please try again.");
    }
  }

  async function handleShare(postId: string) {
    if (!myUserId) {
      Alert.alert("Not signed in", "Please log in again.");
      return;
    }

    const post = renderedPosts.find((item) => item.post_id === postId);
    if (!post) return;

    try {
      const optimisticId = `optimistic-${Date.now()}-${post.post_id}`;

      setPosts((prev) => [
        {
          ...post,
          post_id: optimisticId,
        },
        ...prev,
      ]);

      await repostPost({
        userId: myUserId,
        originalPost: post,
      });

      setPosts((prev) => prev.filter((item) => item.post_id !== optimisticId));

      Alert.alert("Shared", "Post added to your personal page.");
      loadPosts(false);
    } catch (error: any) {
      Alert.alert("Share failed", error?.message ?? "Try again.");
      loadPosts(false);
    }
  }

  function handleComment(postId: string) {
    router.push({
      pathname: "/post/comments",
      params: { postId, returnTo: "feed" },
    } as any);
  }

  function handleOpenPost(postId: string) {
    router.push({
      pathname: "/post/[id]",
      params: { id: postId, returnTo: "feed" },
    } as any);
  }

  function handleOpenAuthor(authorId?: string | null) {
    if (!authorId) {
      Alert.alert("Profile unavailable", "This post does not have a valid profile attached.");
      return;
    }

    router.push(`/profile/${authorId}` as any);
  }

  function openAdvertise() {
    router.push("/premium" as any);
  }

  function openCreatePost() {
    router.push("/create-post" as any);
  }

  const emptyTitle =
    mode === "following"
      ? "No following posts yet"
      : mode === "mine"
      ? "You have not posted yet"
      : "No posts yet";

  const emptyText =
    mode === "following"
      ? "Follow people from Swipe, Browse, or profiles. Their posts will show here."
      : mode === "mine"
      ? "Create your first post to start building your profile content."
      : "Once people post public content, it will appear here.";

  return (
    <SafeAreaView style={styles.outer}>
      <Image source={POLYOPEN_LOGO} style={styles.backgroundLogo} resizeMode="contain" />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          isDesktopWeb && styles.contentDesktop,
          isWideDesktopWeb && styles.contentWideDesktop,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPosts(false);
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.heroCard,
            isDesktopWeb && styles.heroCardDesktop,
            isWideDesktopWeb && styles.heroCardWideDesktop,
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroLogoWrap}>
              <Image source={POLYOPEN_LOGO} style={styles.heroLogo} resizeMode="contain" />
            </View>

            <View style={styles.heroTextWrap}>
              <Text style={styles.header}>Feed</Text>
              <Text style={styles.subheader}>
                Social posts, community updates, creator content, and spiritual
                conversations.
              </Text>
            </View>
          </View>

          <View style={styles.quickActionRow}>
            <Pressable style={styles.createButton} onPress={openCreatePost}>
              <Text style={styles.createButtonText}>+ Create Post</Text>
            </Pressable>

            <Pressable style={styles.refreshSmallButton} onPress={() => loadPosts(true)}>
              <Text style={styles.refreshSmallButtonText}>Refresh</Text>
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.switchRow,
            isDesktopWeb && styles.switchRowDesktop,
          ]}
        >
          <ModeButton
            label="Explore"
            selected={mode === "explore"}
            onPress={() => setMode("explore")}
          />
          <ModeButton
            label="Following"
            selected={mode === "following"}
            onPress={() => setMode("following")}
          />
          <ModeButton
            label="Mine"
            selected={mode === "mine"}
            onPress={() => setMode("mine")}
          />
        </View>

        <View
          style={[
            styles.contextCard,
            isDesktopWeb && styles.contextCardDesktop,
          ]}
        >
          <Text style={styles.contextTitle}>
            {mode === "explore"
              ? "Explore the community"
              : mode === "following"
              ? "People you follow"
              : "Your posts"}
          </Text>
          <Text style={styles.contextText}>
            {mode === "explore"
              ? "Tap a name or photo to open a profile. Tap a post to open the full conversation."
              : mode === "following"
              ? `${followingIds.length} followed profile${
                  followingIds.length === 1 ? "" : "s"
                } connected to your feed.`
              : "This is your personal content timeline."}
          </Text>
        </View>

        {noAdsActive ? (
          <View style={styles.noAdsNotice}>
            <Text style={styles.noAdsNoticeText}>No Ads active</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading feed...</Text>
          </View>
        ) : renderedPosts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Image source={POLYOPEN_LOGO} style={styles.emptyLogo} resizeMode="contain" />
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyText}>{emptyText}</Text>

            <Pressable onPress={openCreatePost} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Create First Post</Text>
            </Pressable>
          </View>
        ) : (
          renderedPosts.flatMap((post, index) => {
            const items = [
              <PostCard
                key={post.post_id}
                item={post}
                isLiked={!!likedPostIds[post.post_id]}
                onLikePress={handleLike}
                onCommentPress={handleComment}
                onSharePress={handleShare}
                onOpenPost={handleOpenPost}
                onOpenAuthor={handleOpenAuthor}
              />,
            ];

            if (!noAdsActive && mode === "explore" && (index + 1) % 5 === 0) {
              items.push(
                <AdCard key={`polyopen-ad-${index}`} onPress={openAdvertise} />
              );
            }

            return items;
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#fff",
  },

  backgroundLogo: {
    position: "absolute",
    width: "125%",
    height: "100%",
    alignSelf: "center",
    opacity: 0.035,
  },

  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },

  content: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 140,
  },

  contentDesktop: {
    maxWidth: 660,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  contentWideDesktop: {
    maxWidth: 700,
    paddingHorizontal: 34,
    paddingTop: 30,
  },

  heroCard: {
    backgroundColor: "#FFFFFFF2",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 28,
    padding: 16,
    marginBottom: 14,
  },

  heroCardDesktop: {
    paddingHorizontal: 24,
    paddingVertical: 22,
    marginBottom: 18,
  },

  heroCardWideDesktop: {
    paddingHorizontal: 30,
    paddingVertical: 26,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  heroLogoWrap: {
    width: 66,
    height: 66,
    borderRadius: 24,
    backgroundColor: "#FFF7FB",
    borderWidth: 1.5,
    borderColor: "#F4CFE4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  heroLogo: {
    width: 50,
    height: 50,
  },

  heroTextWrap: {
    flex: 1,
  },

  header: {
    fontSize: 34,
    fontWeight: "900",
    color: BRAND.text,
  },

  subheader: {
    color: BRAND.muted,
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },

  quickActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  createButton: {
    flex: 1,
    backgroundColor: BRAND.pink,
    paddingHorizontal: 16,
    minHeight: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  createButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },

  refreshSmallButton: {
    minWidth: 104,
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    minHeight: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  refreshSmallButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },

  switchRow: {
    flexDirection: "row",
    marginBottom: 12,
    backgroundColor: "rgba(238,238,238,0.92)",
    borderRadius: 999,
    padding: 4,
  },

  switchRowDesktop: {
    padding: 5,
    marginBottom: 16,
  },

  switchButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 999,
  },

  switchActive: {
    backgroundColor: BRAND.text,
  },

  switchText: {
    fontWeight: "800",
    color: "#555",
    fontSize: 13,
  },

  switchTextActive: {
    fontWeight: "900",
    color: "#fff",
    fontSize: 13,
  },

  contextCard: {
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },

  contextCardDesktop: {
    paddingHorizontal: 20,
    paddingVertical: 17,
    marginBottom: 16,
  },

  contextTitle: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 16,
  },

  contextText: {
    marginTop: 5,
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 20,
    fontSize: 13,
  },

  noAdsNotice: {
    backgroundColor: "#EEF9F1",
    borderWidth: 1.5,
    borderColor: "#B7E4C7",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },

  noAdsNoticeText: {
    color: "#1B7F46",
    fontWeight: "900",
    fontSize: 13,
  },

  loadingCard: {
    backgroundColor: "#FFFFFFF2",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: BRAND.muted,
    fontWeight: "800",
  },

  emptyCard: {
    backgroundColor: "#FFFFFFF2",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 26,
    padding: 20,
    alignItems: "center",
  },

  emptyLogo: {
    width: 86,
    height: 86,
    marginBottom: 10,
  },

  emptyTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: BRAND.text,
    textAlign: "center",
  },

  emptyText: {
    marginTop: 8,
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  emptyButton: {
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },

  adCard: {
    backgroundColor: "#FFF7FB",
    borderWidth: 1.5,
    borderColor: "#F4CFE4",
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },

  adTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  adLogo: {
    width: 50,
    height: 50,
    marginRight: 12,
  },

  adLabel: {
    color: BRAND.pink,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  adTitle: {
    marginTop: 2,
    fontWeight: "900",
    fontSize: 19,
    color: BRAND.text,
  },

  adText: {
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 21,
    fontSize: 14,
  },

  adButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
  },

  adButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
});