import { ResizeMode, Video } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { addCommentToPost, getCommentsForPost } from "../../lib/social";
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

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
};

function formatTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
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

export default function CommentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { postId } = useLocalSearchParams<{
    postId: string;
    returnTo?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [post, setPost] = useState<PostPreview | null>(null);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);

  const topPreviewHeight = Math.max(320, Math.floor(height * 0.5));

  const hardFallback = useCallback(() => {
    router.replace("/(tabs)/feed" as any);
  }, [router]);

  const load = useCallback(async () => {
    if (!postId) return;

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
          getCommentsForPost(postId),
        ]);

      if (postError) throw postError;

      const { data: mediaRows, error: mediaError } = await supabase
        .from("post_media")
        .select("post_id, media_url, media_type, sort_order")
        .eq("post_id", postId)
        .order("sort_order", { ascending: true });

      if (mediaError) throw mediaError;

      const urls = ((mediaRows ?? []) as PostMediaRow[])
        .map((row) => row.media_url)
        .filter(Boolean) as string[];

      setPost((postData as PostPreview | null) ?? null);
      setMediaUrls(urls);
      setComments(commentRows as CommentRow[]);
    } catch (error) {
      console.log("comments load error", error);
      setPost(null);
      setMediaUrls([]);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();

    if (!postId) return;

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, postId]);

  async function handleSend() {
    if (!postId || !myUserId || !text.trim() || sending) return;

    try {
      setSending(true);

      await addCommentToPost({
        postId,
        userId: myUserId,
        body: text,
      });

      setText("");
      await load();
    } catch (error: any) {
      Alert.alert("Could not post comment", error?.message ?? "Unknown error");
    } finally {
      setSending(false);
    }
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/feed" as any);
  }

  const firstMedia = mediaUrls[0] ?? null;
  const mediaIsVideo = !!firstMedia && isVideoUrl(firstMedia);

  if (!loading && !post) {
    hardFallback();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            <Text style={{ fontWeight: "900", color: BRAND.text }}>Back</Text>
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
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={BRAND.pink} />
        ) : (
          <>
            <View
              style={{
                height: topPreviewHeight,
                backgroundColor: "#000000",
                borderBottomWidth: 1,
                borderBottomColor: BRAND.border,
              }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#000000",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {firstMedia ? (
                  mediaIsVideo ? (
                    <Video
                      source={{ uri: firstMedia }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode={ResizeMode.COVER}
                      useNativeControls
                      shouldPlay={false}
                      isLooping={false}
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
                      backgroundColor: "#FFF6FB",
                    }}
                  >
                    {!!post?.caption ? (
                      <Text
                        style={{
                          color: BRAND.text,
                          fontSize: 24,
                          lineHeight: 32,
                          fontWeight: "900",
                          textAlign: "center",
                        }}
                      >
                        {post.caption}
                      </Text>
                    ) : (
                      <Text style={{ color: BRAND.muted, fontSize: 16 }}>
                        No media on this post
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {!!post?.caption && firstMedia ? (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    paddingHorizontal: 16,
                    paddingTop: 28,
                    paddingBottom: 14,
                    backgroundColor: "rgba(0,0,0,0.5)",
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 16,
                      lineHeight: 22,
                      fontWeight: "800",
                    }}
                    numberOfLines={3}
                  >
                    {post.caption}
                  </Text>

                  {!!post?.created_at ? (
                    <Text
                      style={{
                        marginTop: 6,
                        color: "rgba(255,255,255,0.72)",
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {formatTime(post.created_at)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

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
                  paddingTop: 16,
                  paddingBottom: 4,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: "900",
                    color: BRAND.text,
                  }}
                >
                  Comments
                </Text>

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
                    {comments.length}
                  </Text>
                </View>
              </View>

              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
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
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "900",
                        color: BRAND.text,
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
                      }}
                    >
                      Be the first person to comment on this post.
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <View
                    style={{
                      backgroundColor: "#FFFFFFEE",
                      borderWidth: 1.5,
                      borderColor: BRAND.border,
                      borderRadius: 20,
                      padding: 14,
                      marginBottom: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {item.author_avatar ? (
                        <Image
                          source={{ uri: item.author_avatar }}
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 999,
                            backgroundColor: "#fff",
                          }}
                        />
                      ) : (
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 999,
                            backgroundColor: "#fff",
                            overflow: "hidden",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Image
                            source={require("../../assets/images/polyopen-logo.png")}
                            style={{ width: 42, height: 42 }}
                            resizeMode="contain"
                          />
                        </View>
                      )}

                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text
                          style={{
                            fontWeight: "900",
                            fontSize: 15,
                            color: BRAND.text,
                          }}
                        >
                          {item.author_name ?? "User"}
                        </Text>
                        <Text
                          style={{
                            color: BRAND.muted,
                            fontSize: 12,
                            marginTop: 2,
                          }}
                        >
                          {formatTime(item.created_at)}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={{
                        marginTop: 10,
                        color: BRAND.text,
                        fontSize: 15,
                        lineHeight: 22,
                        fontWeight: "700",
                      }}
                    >
                      {item.body}
                    </Text>
                  </View>
                )}
              />
            </View>

            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: Math.max(insets.bottom + 8, 18),
                borderTopWidth: 1,
                borderTopColor: BRAND.border,
                backgroundColor: "#FFFFFFEE",
              }}
            >
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
                  placeholder="Write a comment..."
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
                    {sending ? "..." : "Send"}
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