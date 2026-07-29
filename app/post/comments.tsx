import { ResizeMode, Video } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { BRAND } from "../../lib/brand";
import {
  addCommentToPost,
  getCommentsForPost,
  setCommentReaction,
  type CommentItem,
  type CommentReactionType,
} from "../../lib/social";
import { supabase } from "../../lib/supabase";

type PostPreview = {
  id: string;
  caption?: string | null;
  visibility?: string | null;
  created_at?: string | null;
  author_id?: string | null;
};

type PostMediaRow = {
  post_id: string;
  media_url?: string | null;
  media_type?: string | null;
  sort_order?: number | null;
};

type ReturnTarget =
  | "feed"
  | "profile"
  | "browse"
  | "swipe"
  | "messages"
  | "notifications";

const POLYOPEN_LOGO = require("../../assets/images/polyopen-logo.png");

function formatTime(value?: string | null) {
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

function isVideoUrl(url: string) {
  const clean = url.split("?")[0].toLowerCase();

  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".mov") ||
    clean.endsWith(".m4v") ||
    clean.endsWith(".webm")
  );
}

function getReturnRoute(returnTo?: string | string[]) {
  const value = Array.isArray(returnTo) ? returnTo[0] : returnTo;

  if (value === "profile") return "/(tabs)/profile";
  if (value === "browse") return "/(tabs)/browse";
  if (value === "swipe") return "/(tabs)/swipe";
  if (value === "messages") return "/(tabs)/messages";
  if (value === "notifications") return "/notifications";

  return "/(tabs)/feed";
}

function flattenCommentCount(comments: CommentItem[]) {
  return comments.reduce((total, comment) => {
    return total + 1 + (comment.replies?.length ?? 0);
  }, 0);
}

function flattenCommentsForScroll(comments: CommentItem[]) {
  const rows: CommentItem[] = [];

  comments.forEach((comment) => {
    rows.push(comment);
    (comment.replies ?? []).forEach((reply) => rows.push(reply));
  });

  return rows;
}

export default function CommentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const listRef = useRef<FlatList<CommentItem>>(null);

  const params = useLocalSearchParams<{
    postId: string;
    returnTo?: string;
    commentId?: string;
  }>();

  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;

  const returnToRaw = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;

  const highlightedCommentId = Array.isArray(params.commentId)
    ? params.commentId[0]
    : params.commentId;

  const returnTo: ReturnTarget | undefined =
    returnToRaw === "feed" ||
    returnToRaw === "profile" ||
    returnToRaw === "browse" ||
    returnToRaw === "swipe" ||
    returnToRaw === "messages" ||
    returnToRaw === "notifications"
      ? returnToRaw
      : undefined;

  const safeReturnRoute = useMemo(() => getReturnRoute(returnTo), [returnTo]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reactingCommentId, setReactingCommentId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<CommentItem | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [post, setPost] = useState<PostPreview | null>(null);
  const [mediaRows, setMediaRows] = useState<PostMediaRow[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [highlightPulse] = useState(new Animated.Value(0));

  const topPreviewHeight = Math.min(260, Math.max(170, Math.floor(height * 0.28)));
  const commentCount = useMemo(() => flattenCommentCount(comments), [comments]);

  const hardFallback = useCallback(() => {
    router.replace(safeReturnRoute as any);
  }, [router, safeReturnRoute]);

  const load = useCallback(async () => {
    if (!postId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setMyUserId(user?.id ?? null);

      const [{ data: postData, error: postError }, commentRows] =
        await Promise.all([
          supabase
            .from("posts")
            .select("id, caption, visibility, created_at, author_id")
            .eq("id", postId)
            .maybeSingle(),
          getCommentsForPost(postId, user?.id ?? null),
        ]);

      if (postError) throw postError;

      const { data: rows, error: mediaError } = await supabase
        .from("post_media")
        .select("post_id, media_url, media_type, sort_order")
        .eq("post_id", postId)
        .order("sort_order", { ascending: true });

      if (mediaError) throw mediaError;

      setPost((postData as PostPreview | null) ?? null);
      setMediaRows((rows ?? []) as PostMediaRow[]);
      setComments(commentRows);
    } catch (error) {
      console.log("comments load error", error);
      setPost(null);
      setMediaRows([]);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();

    if (!postId) return;

    const commentsChannel = supabase
      .channel(`post-comments-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_comments",
          filter: `post_id=eq.${postId}`,
        },
        () => load()
      )
      .subscribe();

    const reactionsChannel = supabase
      .channel(`post-comment-reactions-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_comment_reactions",
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(reactionsChannel);
    };
  }, [load, postId]);

  useEffect(() => {
    if (!loading && !post) {
      hardFallback();
    }
  }, [loading, post, hardFallback]);

  useEffect(() => {
    if (!highlightedCommentId) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(highlightPulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: false,
        }),
        Animated.timing(highlightPulse, {
          toValue: 0,
          duration: 850,
          useNativeDriver: false,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [highlightPulse, highlightedCommentId]);

  useEffect(() => {
    if (!highlightedCommentId || loading || comments.length === 0) return;

    const flat = flattenCommentsForScroll(comments);
    const targetIndex = flat.findIndex((item) => item.id === highlightedCommentId);

    if (targetIndex < 0) return;

    const parentIndex = comments.findIndex((item) => {
      if (item.id === highlightedCommentId) return true;
      return Boolean(item.replies?.some((reply) => reply.id === highlightedCommentId));
    });

    if (parentIndex < 0) return;

    const timer = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({
          index: parentIndex,
          animated: true,
          viewPosition: 0.35,
        });
      } catch {
        listRef.current?.scrollToOffset({
          offset: Math.max(0, parentIndex * 150),
          animated: true,
        });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [comments, highlightedCommentId, loading]);

  async function handleSend() {
    if (!postId || !myUserId || !text.trim() || sending) return;

    try {
      setSending(true);

      await addCommentToPost({
        postId,
        userId: myUserId,
        body: text.trim(),
        parentCommentId: replyingTo?.id ?? null,
      });

      setText("");
      setReplyingTo(null);
      await load();
    } catch (error: any) {
      Alert.alert("Could not post comment", error?.message ?? "Unknown error");
    } finally {
      setSending(false);
    }
  }

  async function handleReact(
    comment: CommentItem,
    reactionType: CommentReactionType
  ) {
    if (!myUserId || reactingCommentId) return;

    try {
      setReactingCommentId(comment.id);

      await setCommentReaction({
        commentId: comment.id,
        userId: myUserId,
        reactionType,
        currentReaction: comment.my_reaction,
      });

      await load();
    } catch (error: any) {
      Alert.alert("Could not update reaction", error?.message ?? "Unknown error");
    } finally {
      setReactingCommentId(null);
    }
  }

  function handleReply(comment: CommentItem) {
    setReplyingTo(comment);
  }

  function cancelReply() {
    setReplyingTo(null);
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(safeReturnRoute as any);
  }

  function openFullPost() {
    if (!postId) return;

    router.push({
      pathname: "/post/[id]",
      params: {
        id: postId,
        returnTo: returnTo ?? "feed",
      },
    } as any);
  }

  function openCommentAuthor(userId: string) {
    if (!userId) return;
    router.push(`/profile/${userId}` as any);
  }

  function renderCommentCard(comment: CommentItem, isReply = false) {
    const isMine = comment.user_id === myUserId;
    const likeActive = comment.my_reaction === "like";
    const dislikeActive = comment.my_reaction === "dislike";
    const isReacting = reactingCommentId === comment.id;
    const isHighlighted = highlightedCommentId === comment.id;

    const highlightScale = highlightPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.015],
    });

    const highlightBorder = highlightPulse.interpolate({
      inputRange: [0, 1],
      outputRange: ["#FF4FCB", BRAND.magenta],
    });

    return (
      <Animated.View
        key={comment.id}
        style={{
          marginBottom: isReply ? 8 : 14,
          transform: [{ scale: isHighlighted ? highlightScale : 1 }],
        }}
      >
        <Animated.View
          style={{
            marginLeft: isReply ? 38 : 0,
            backgroundColor: isHighlighted
              ? "#FFF4FA"
              : isReply
                ? "#FFFFFF"
                : "#FFFFFFEE",
            borderWidth: isHighlighted ? 2 : 1.5,
            borderColor: isHighlighted
              ? highlightBorder
              : isReply
                ? "#E6EEFF"
                : BRAND.border,
            borderRadius: isReply ? 18 : 22,
            padding: isReply ? 12 : 14,
            shadowColor: isHighlighted ? BRAND.pink : "#000",
            shadowOpacity: isHighlighted ? 0.14 : 0,
            shadowRadius: isHighlighted ? 12 : 0,
            shadowOffset: { width: 0, height: 6 },
            elevation: isHighlighted ? 4 : 0,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable onPress={() => openCommentAuthor(comment.user_id)}>
              {comment.author_avatar ? (
                <Image
                  source={{ uri: comment.author_avatar }}
                  style={{
                    width: isReply ? 36 : 44,
                    height: isReply ? 36 : 44,
                    borderRadius: 999,
                    backgroundColor: "#fff",
                    borderWidth: 1,
                    borderColor: BRAND.border,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: isReply ? 36 : 44,
                    height: isReply ? 36 : 44,
                    borderRadius: 999,
                    backgroundColor: "#fff",
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: BRAND.border,
                  }}
                >
                  <Image
                    source={POLYOPEN_LOGO}
                    style={{ width: isReply ? 30 : 38, height: isReply ? 30 : 38 }}
                    resizeMode="contain"
                  />
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => openCommentAuthor(comment.user_id)}
              style={{ marginLeft: 10, flex: 1 }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  fontSize: isReply ? 14 : 15,
                  color: BRAND.text,
                }}
              >
                {comment.author_name ?? "User"}
                {isMine ? " • You" : ""}
              </Text>

              <Text
                style={{
                  color: BRAND.muted,
                  fontSize: 12,
                  marginTop: 2,
                  fontWeight: "700",
                }}
              >
                {formatTime(comment.created_at)}
              </Text>
            </Pressable>

            {isHighlighted ? (
              <View
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: BRAND.pink,
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 10,
                    fontWeight: "900",
                  }}
                >
                  New
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            style={{
              marginTop: 10,
              color: BRAND.text,
              fontSize: isReply ? 14 : 15,
              lineHeight: isReply ? 21 : 22,
              fontWeight: "700",
            }}
          >
            {comment.body}
          </Text>

          {isHighlighted ? (
            <View
              style={{
                marginTop: 10,
                alignSelf: "flex-start",
                backgroundColor: "#FF4FCB",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: "900",
                }}
              >
                Highlighted from notification
              </Text>
            </View>
          ) : null}

          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            }}
          >
            <Pressable
              onPress={() => handleReact(comment, "like")}
              disabled={isReacting}
              style={{ opacity: isReacting ? 0.45 : 1 }}
            >
              <Text
                style={{
                  color: likeActive ? BRAND.blue : BRAND.muted,
                  fontWeight: "900",
                  fontSize: 13,
                }}
              >
                👍 {comment.like_count}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleReact(comment, "dislike")}
              disabled={isReacting}
              style={{ opacity: isReacting ? 0.45 : 1 }}
            >
              <Text
                style={{
                  color: dislikeActive ? "#BE123C" : BRAND.muted,
                  fontWeight: "900",
                  fontSize: 13,
                }}
              >
                👎 {comment.dislike_count}
              </Text>
            </Pressable>

            {!isReply ? (
              <Pressable onPress={() => handleReply(comment)}>
                <Text
                  style={{
                    color: BRAND.text,
                    fontWeight: "900",
                    fontSize: 13,
                  }}
                >
                  Reply
                </Text>
              </Pressable>
            ) : null}

            <Pressable onPress={() => openCommentAuthor(comment.user_id)}>
              <Text
                style={{
                  color: BRAND.blue,
                  fontWeight: "900",
                  fontSize: 13,
                }}
              >
                Profile
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {!isReply && comment.replies?.length ? (
          <View style={{ marginTop: 8 }}>
            {comment.replies.map((reply) => renderCommentCard(reply, true))}
          </View>
        ) : null}
      </Animated.View>
    );
  }

  const firstMediaRow = mediaRows[0] ?? null;
  const firstMedia = firstMediaRow?.media_url ?? null;
  const mediaIsVideo =
    !!firstMedia &&
    (firstMediaRow?.media_type === "video" || isVideoUrl(firstMedia));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 12,
            backgroundColor: "#FFFFFF",
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: BRAND.border,
          }}
        >
          <Pressable
            onPress={handleBack}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 11,
              borderRadius: 999,
              backgroundColor: "#FFF6FB",
              borderWidth: 1.5,
              borderColor: BRAND.border,
            }}
          >
            <Text style={{ fontWeight: "900", color: BRAND.text }}>‹ Back</Text>
          </Pressable>

          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={{ fontWeight: "900", fontSize: 28, color: BRAND.text }}>
              Comments
            </Text>
            <Text
              style={{
                color: BRAND.muted,
                marginTop: 2,
                fontSize: 15,
                fontWeight: "700",
              }}
            >
              Join the conversation
            </Text>
          </View>

          <Pressable
            onPress={openFullPost}
            style={{
              minHeight: 44,
              paddingHorizontal: 15,
              borderRadius: 999,
              backgroundColor: "#111111",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "900" }}>Post</Text>
          </Pressable>
        </View>

        {loading ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#FFFFFF",
            }}
          >
            <ActivityIndicator color={BRAND.pink} size="large" />
          </View>
        ) : (
          <>
            <Pressable
              onPress={openFullPost}
              style={{
                height: topPreviewHeight,
                backgroundColor: "#000000",
                borderBottomWidth: 1,
                borderBottomColor: BRAND.border,
              }}
            >
              {firstMedia ? (
                mediaIsVideo ? (
                  <Video
                    source={{ uri: firstMedia }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode={ResizeMode.COVER}
                    useNativeControls={false}
                    shouldPlay
                    isMuted
                    isLooping
                  />
                ) : (
                  <Image
                    source={{ uri: firstMedia }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                )
              ) : (
                <View
                  style={{
                    flex: 1,
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 24,
                    backgroundColor: "#111111",
                  }}
                >
                  {!!post?.caption ? (
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 22,
                        lineHeight: 30,
                        fontWeight: "900",
                        textAlign: "center",
                      }}
                    >
                      {post.caption}
                    </Text>
                  ) : (
                    <Text style={{ color: "#FFFFFF", fontSize: 16 }}>
                      No media on this post
                    </Text>
                  )}
                </View>
              )}
            </Pressable>

            <View
              style={{
                flex: 1,
                backgroundColor: BRAND.bg,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 4,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: "900",
                      color: BRAND.text,
                    }}
                  >
                    Conversation
                  </Text>

                  <Text
                    style={{
                      marginTop: 2,
                      color: BRAND.muted,
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    Reply, react, and tap profiles.
                  </Text>
                </View>

                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    backgroundColor: "#FCEAF4",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: BRAND.magenta,
                      fontSize: 18,
                      fontWeight: "900",
                    }}
                  >
                    {commentCount}
                  </Text>
                </View>
              </View>

              <FlatList
                ref={listRef}
                data={comments}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    listRef.current?.scrollToOffset({
                      offset: Math.max(0, info.averageItemLength * info.index),
                      animated: true,
                    });
                  }, 350);
                }}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingTop: 10,
                  paddingBottom: 12,
                  flexGrow: 1,
                }}
                ListEmptyComponent={
                  <View
                    style={{
                      backgroundColor: "#FFFFFFEE",
                      borderWidth: 1.5,
                      borderColor: BRAND.border,
                      borderRadius: 22,
                      padding: 18,
                    }}
                  >
                    <Image
                      source={POLYOPEN_LOGO}
                      style={{
                        width: 52,
                        height: 52,
                        alignSelf: "center",
                        marginBottom: 12,
                      }}
                      resizeMode="contain"
                    />

                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "900",
                        color: BRAND.text,
                        textAlign: "center",
                      }}
                    >
                      No comments yet
                    </Text>

                    <Text
                      style={{
                        marginTop: 8,
                        color: BRAND.muted,
                        fontSize: 15,
                        lineHeight: 22,
                        textAlign: "center",
                      }}
                    >
                      Be the first person to comment on this post.
                    </Text>
                  </View>
                }
                renderItem={({ item }) => renderCommentCard(item)}
              />
            </View>

            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: replyingTo ? 8 : 10,
                paddingBottom: Math.max(insets.bottom + 8, 18),
                borderTopWidth: 1,
                borderTopColor: BRAND.border,
                backgroundColor: "#FFFFFFEE",
              }}
            >
              {replyingTo ? (
                <View
                  style={{
                    marginBottom: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 14,
                    backgroundColor: "#F8FBFF",
                    borderWidth: 1,
                    borderColor: "#DCE5FF",
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: BRAND.text,
                      fontWeight: "800",
                    }}
                    numberOfLines={1}
                  >
                    Replying to {replyingTo.author_name ?? "User"}
                  </Text>

                  <Pressable onPress={cancelReply}>
                    <Text style={{ color: BRAND.pink, fontWeight: "900" }}>
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: 10,
                }}
              >
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={
                    replyingTo
                      ? `Reply to ${replyingTo.author_name ?? "User"}...`
                      : "Write a comment..."
                  }
                  placeholderTextColor="#999"
                  multiline
                  style={{
                    flex: 1,
                    minHeight: 56,
                    maxHeight: 120,
                    backgroundColor: "#fff",
                    borderWidth: 1.5,
                    borderColor: BRAND.border,
                    borderRadius: 18,
                    paddingHorizontal: 14,
                    paddingTop: 14,
                    paddingBottom: 14,
                    fontSize: 16,
                    color: BRAND.text,
                  }}
                />

                <Pressable
                  onPress={handleSend}
                  disabled={sending || !text.trim()}
                  style={{
                    minWidth: 84,
                    minHeight: 56,
                    borderRadius: 18,
                    backgroundColor:
                      sending || !text.trim() ? "#EDC7DB" : "#FF4FCB",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "900",
                      fontSize: 16,
                    }}
                  >
                    {sending ? "..." : replyingTo ? "Reply" : "Send"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}