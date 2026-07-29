import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BRAND } from "../../lib/brand";
import { createPostWithMedia } from "../../lib/social";

type Visibility = "public" | "followers";

export default function PostComposer({
  userId,
  onPosted,
}: {
  userId: string;
  onPosted: () => Promise<void> | void;
}) {
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  const canPost = useMemo(() => {
    return Boolean(caption.trim()) || mediaUris.length > 0;
  }, [caption, mediaUris.length]);

  async function pickMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow media access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 5,
    });

    if (result.canceled) return;

    const nextUris = result.assets.map((asset) => asset.uri).filter(Boolean);

    setMediaUris((prev) => {
      const merged = [...prev, ...nextUris];
      return Array.from(new Set(merged)).slice(0, 5);
    });
  }

  function removeMedia(uri: string) {
    setMediaUris((prev) => prev.filter((item) => item !== uri));
  }

  async function handlePost() {
    const cleanCaption = caption.trim();

    if (!cleanCaption && mediaUris.length === 0) {
      Alert.alert("Empty post", "Add text, a photo, or a video.");
      return;
    }

    if (!userId) {
      Alert.alert("Not signed in", "Please log in again.");
      return;
    }

    try {
      setPosting(true);

      await createPostWithMedia({
        authorId: userId,
        caption: cleanCaption,
        visibility,
        mediaUris,
      });

      setCaption("");
      setMediaUris([]);

      await onPosted();
    } catch (error: any) {
      Alert.alert("Post failed", error?.message ?? "Unknown error");
    } finally {
      setPosting(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Create a post</Text>
          <Text style={styles.subtitle}>
            Share a thought, photo, meme, video, or community update.
          </Text>
        </View>
      </View>

      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="What do you want to share?"
        placeholderTextColor="#9C8F99"
        multiline
        style={styles.input}
      />

      <View style={styles.visibilityRow}>
        {(["public", "followers"] as const).map((option) => {
          const selected = visibility === option;

          return (
            <Pressable
              key={option}
              onPress={() => setVisibility(option)}
              style={[
                styles.visibilityButton,
                selected ? styles.visibilityButtonActive : null,
              ]}
            >
              <Text
                style={[
                  styles.visibilityButtonText,
                  selected ? styles.visibilityButtonTextActive : null,
                ]}
              >
                {option === "followers" ? "Friends" : "Public"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mediaUris.length > 0 ? (
        <View style={styles.mediaSection}>
          <View style={styles.mediaHeaderRow}>
            <Text style={styles.mediaTitle}>
              Media selected: {mediaUris.length}/5
            </Text>
            <Pressable onPress={() => setMediaUris([])}>
              <Text style={styles.clearMediaText}>Clear</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mediaScroll}
          >
            <View style={styles.mediaRow}>
              {mediaUris.map((uri) => (
                <View key={uri} style={styles.mediaItem}>
                  <Image source={{ uri }} style={styles.mediaPreview} />

                  <Pressable
                    onPress={() => removeMedia(uri)}
                    style={styles.removeMediaButton}
                  >
                    <Text style={styles.removeMediaButtonText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.emptyMediaBox}>
          <Text style={styles.emptyMediaTitle}>No media selected</Text>
          <Text style={styles.emptyMediaText}>
            Add up to 5 images or videos to make the post stand out.
          </Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <Pressable onPress={pickMedia} style={styles.mediaButton}>
          <Text style={styles.mediaButtonText}>Add Media</Text>
        </Pressable>

        <Pressable
          onPress={handlePost}
          disabled={posting || !canPost}
          style={[
            styles.postButton,
            posting || !canPost ? styles.postButtonDisabled : null,
          ]}
        >
          <Text style={styles.postButtonText}>
            {posting ? "Posting..." : "Post"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFFF7",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 26,
    padding: 16,
    marginBottom: 14,
  },

  headerRow: {
    marginBottom: 12,
  },

  title: {
    color: BRAND.text,
    fontSize: 22,
    fontWeight: "900",
  },

  subtitle: {
    marginTop: 4,
    color: BRAND.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },

  input: {
    minHeight: 112,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#F0D6E7",
    backgroundColor: "#FFF9FC",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: "top",
    color: BRAND.text,
    fontWeight: "600",
  },

  visibilityRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },

  visibilityButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  visibilityButtonActive: {
    backgroundColor: BRAND.pink,
    borderColor: BRAND.pink,
  },

  visibilityButtonText: {
    color: BRAND.blue,
    fontWeight: "900",
    fontSize: 13,
  },

  visibilityButtonTextActive: {
    color: "#FFFFFF",
  },

  mediaSection: {
    marginTop: 14,
  },

  mediaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  mediaTitle: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 14,
  },

  clearMediaText: {
    color: BRAND.pink,
    fontWeight: "900",
    fontSize: 13,
  },

  mediaScroll: {
    marginTop: 10,
  },

  mediaRow: {
    flexDirection: "row",
    gap: 10,
  },

  mediaItem: {
    width: 96,
    height: 96,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#eee",
  },

  mediaPreview: {
    width: "100%",
    height: "100%",
  },

  removeMediaButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },

  removeMediaButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 22,
  },

  emptyMediaBox: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    backgroundColor: "#F8FBFF",
    padding: 14,
  },

  emptyMediaTitle: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 14,
  },

  emptyMediaText: {
    marginTop: 4,
    color: BRAND.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  mediaButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  mediaButtonText: {
    color: BRAND.blue,
    fontWeight: "900",
    fontSize: 15,
  },

  postButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  postButtonDisabled: {
    opacity: 0.5,
  },

  postButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
});