import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth";
import { BRAND } from "../../lib/brand";
import { deletePost } from "../../lib/social";
import { supabase } from "../../lib/supabase";

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

export default function EditPostScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [post, setPost] = useState<PostRow | null>(null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [caption, setCaption] = useState("");

  const canSave = useMemo(() => {
    if (!post) return false;
    return caption.trim() !== (post.caption ?? "").trim();
  }, [caption, post]);

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
        Alert.alert("Post not found");
        router.back();
        return;
      }

      const typedPost = postData as PostRow;

      if (!userId || typedPost.author_id !== userId) {
        Alert.alert("Unavailable", "You can only edit your own posts.");
        router.back();
        return;
      }

      const { data: mediaRows, error: mediaError } = await supabase
        .from("post_media")
        .select("media_url, media_type, sort_order")
        .eq("post_id", id)
        .order("sort_order", { ascending: true });

      if (mediaError) throw mediaError;

      setPost(typedPost);
      setCaption(typedPost.caption ?? "");
      setMedia((mediaRows ?? []) as MediaRow[]);
    } catch (error: any) {
      Alert.alert("Could not load post", error?.message ?? "Please try again.");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router, userId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  async function handleSave() {
    if (!post || !userId || saving || !canSave) return;

    try {
      setSaving(true);

      const nextCaption = caption.trim() || null;

      const { error } = await supabase
        .from("posts")
        .update({
          caption: nextCaption,
          text: media.length === 0 ? nextCaption : post.text ?? null,
        })
        .eq("id", post.id)
        .eq("author_id", userId);

      if (error) throw error;

      Alert.alert("Saved", "Your post has been updated.");
      router.replace(`/post/${post.id}` as any);
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
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
            Alert.alert("Deleted", "Your post has been deleted.");
            router.replace("/(tabs)/profile");
          } catch (error: any) {
            Alert.alert("Delete failed", error?.message ?? "Please try again.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: BRAND.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: BRAND.bg,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "900", color: BRAND.text }}>
          Post not found
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              backgroundColor: "#fff",
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: BRAND.border,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: BRAND.text, fontWeight: "900" }}>Back</Text>
          </Pressable>

          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: BRAND.text,
            }}
          >
            Edit Post
          </Text>

          <View style={{ width: 64 }} />
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFFEE",
            borderWidth: 1.5,
            borderColor: BRAND.border,
            borderRadius: 28,
            padding: 16,
          }}
        >
          {media.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
            >
              <View style={{ flexDirection: "row", gap: 12, paddingRight: 8 }}>
                {media.map((item, index) => (
                  <Image
                    key={`${item.media_url}-${index}`}
                    source={{ uri: item.media_url }}
                    style={{
                      width: 170,
                      height: 190,
                      borderRadius: 18,
                      backgroundColor: "#000",
                    }}
                    resizeMode="cover"
                  />
                ))}
              </View>
            </ScrollView>
          ) : null}

          <Text
            style={{
              fontSize: 18,
              fontWeight: "900",
              color: BRAND.text,
              marginBottom: 10,
            }}
          >
            Caption
          </Text>

          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write your caption..."
            placeholderTextColor="#A79AA2"
            multiline
            textAlignVertical="top"
            style={{
              minHeight: 170,
              borderWidth: 1.5,
              borderColor: BRAND.border,
              borderRadius: 20,
              backgroundColor: "#fff",
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 16,
              fontSize: 16,
              color: BRAND.text,
            }}
          />

          <Text
            style={{
              marginTop: 12,
              color: BRAND.muted,
              fontSize: 13,
              lineHeight: 20,
            }}
          >
            Media editing is not enabled yet here. This screen updates the post caption and keeps your existing media attached.
          </Text>

          <Pressable
            onPress={handleSave}
            disabled={!canSave || saving}
            style={{
              marginTop: 18,
              minHeight: 56,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: !canSave || saving ? "#EDC7DB" : BRAND.pink,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 17 }}>
              {saving ? "Saving..." : "Save Changes"}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleDelete}
            disabled={deleting}
            style={{
              marginTop: 12,
              minHeight: 54,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#111",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
              {deleting ? "Deleting..." : "Delete Post"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}