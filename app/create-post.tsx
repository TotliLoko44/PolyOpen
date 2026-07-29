import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BRAND } from "../lib/brand";
import { createPostWithMedia } from "../lib/social";
import { supabase } from "../lib/supabase";

const POLYOPEN_LOGO = require("../assets/images/polyopen-logo.png");

function isVideoUri(uri: string) {
  const clean = uri.split("?")[0].toLowerCase();

  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".mov") ||
    clean.endsWith(".m4v") ||
    clean.endsWith(".webm")
  );
}

export default function CreatePostScreen() {
  const router = useRouter();

  const [caption, setCaption] = useState("");
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"public" | "followers">(
    "public"
  );
  const [posting, setPosting] = useState(false);

  const canPost = useMemo(() => {
    return caption.trim().length > 0 || mediaUris.length > 0;
  }, [caption, mediaUris]);

  async function requestPermission(mode: "camera" | "library") {
    if (mode === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Permission required", "Please allow camera access.");
        return false;
      }

      return true;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow photo access.");
      return false;
    }

    return true;
  }

  function openMediaPicker() {
    Alert.alert("Add Media", "Choose how you want to add media.", [
      {
        text: "Cancel",
        style: "cancel",
      },

      {
        text: "Camera",
        onPress: async () => {
          const allowed = await requestPermission("camera");

          if (!allowed) return;

          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            quality: 0.9,
            allowsEditing: false,
          });

          if (!result.canceled && result.assets.length > 0) {
            setMediaUris((prev) => [
              ...prev,
              result.assets[0].uri,
            ].slice(0, 8));
          }
        },
      },

      {
        text: "Photo Library",
        onPress: async () => {
          const allowed = await requestPermission("library");

          if (!allowed) return;

          const result = await ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: true,
            selectionLimit: 8,
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            quality: 0.9,
          });

          if (!result.canceled) {
            setMediaUris((prev) => {
              const merged = [...prev];

              for (const asset of result.assets) {
                if (!merged.includes(asset.uri)) {
                  merged.push(asset.uri);
                }
              }

              return merged.slice(0, 8);
            });
          }
        },
      },
    ]);
  }

  function removeMedia(uri: string) {
    setMediaUris((prev) => prev.filter((item) => item !== uri));
  }

  async function handlePost() {
    if (posting || !canPost) return;

    try {
      setPosting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Not signed in", "Please log in again.");
        return;
      }

      await createPostWithMedia({
        authorId: user.id,
        caption: caption.trim(),
        visibility,
        mediaUris,
      });

      Alert.alert("Posted", "Your post is now live.");

      router.back();
    } catch (error: any) {
      Alert.alert(
        "Could not create post",
        error?.message ?? "Unknown error"
      );
    } finally {
      setPosting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Image
        source={POLYOPEN_LOGO}
        style={styles.backgroundLogo}
        resizeMode="contain"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>‹ Back</Text>
            </Pressable>

            <Text style={styles.pageTitle}>Create Post</Text>

            <View style={{ width: 72 }} />
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.logoWrap}>
                <Image
                  source={POLYOPEN_LOGO}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Share with the community</Text>

                <Text style={styles.heroText}>
                  Post thoughts, updates, spiritual ideas, memes, moments,
                  photos, or videos.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Caption</Text>

            <TextInput
              placeholder="What’s on your mind?"
              placeholderTextColor="#A79AA2"
              value={caption}
              onChangeText={setCaption}
              multiline
              textAlignVertical="top"
              style={styles.input}
            />

            <View style={styles.captionFooter}>
              <Text style={styles.captionHint}>
                Keep it authentic. Strong posts create engagement.
              </Text>

              <Text style={styles.characterCount}>
                {caption.length}
              </Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Media</Text>

              <Text style={styles.mediaCount}>
                {mediaUris.length}/8
              </Text>
            </View>

            <Pressable
              onPress={openMediaPicker}
              style={styles.addMediaButton}
            >
              <Text style={styles.addMediaButtonText}>
                Add Photos or Videos
              </Text>
            </Pressable>

            {mediaUris.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mediaRow}
              >
                {mediaUris.map((uri) => {
                  const isVideo = isVideoUri(uri);

                  return (
                    <View key={uri} style={styles.mediaCard}>
                      {isVideo ? (
                        <Video
                          source={{ uri }}
                          style={styles.mediaPreview}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay={false}
                          useNativeControls={false}
                          isLooping={false}
                        />
                      ) : (
                        <Image
                          source={{ uri }}
                          style={styles.mediaPreview}
                          resizeMode="cover"
                        />
                      )}

                      <Pressable
                        onPress={() => removeMedia(uri)}
                        style={styles.removeButton}
                      >
                        <Text style={styles.removeButtonText}>Remove</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.emptyMediaBox}>
                <Image
                  source={POLYOPEN_LOGO}
                  style={styles.emptyMediaLogo}
                  resizeMode="contain"
                />

                <Text style={styles.emptyMediaTitle}>
                  No media selected
                </Text>

                <Text style={styles.emptyMediaText}>
                  Add photos or videos to boost visibility and interaction.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Visibility</Text>

            <View style={styles.visibilityRow}>
              <Pressable
                onPress={() => setVisibility("public")}
                style={[
                  styles.visibilityButton,
                  visibility === "public"
                    ? styles.visibilityButtonActive
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.visibilityButtonText,
                    visibility === "public"
                      ? styles.visibilityButtonTextActive
                      : null,
                  ]}
                >
                  Public Feed
                </Text>

                <Text
                  style={[
                    styles.visibilityButtonSubtext,
                    visibility === "public"
                      ? styles.visibilityButtonSubtextActive
                      : null,
                  ]}
                >
                  Everyone can see this post
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setVisibility("followers")}
                style={[
                  styles.visibilityButton,
                  visibility === "followers"
                    ? styles.visibilityButtonActive
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.visibilityButtonText,
                    visibility === "followers"
                      ? styles.visibilityButtonTextActive
                      : null,
                  ]}
                >
                  Friends Only
                </Text>

                <Text
                  style={[
                    styles.visibilityButtonSubtext,
                    visibility === "followers"
                      ? styles.visibilityButtonSubtextActive
                      : null,
                  ]}
                >
                  Limited to your connections
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handlePost}
            disabled={!canPost || posting}
            style={[
              styles.postButton,
              !canPost || posting ? styles.postButtonDisabled : null,
            ]}
          >
            <Text style={styles.postButtonText}>
              {posting ? "Posting..." : "Post to Feed"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  backgroundLogo: {
    position: "absolute",
    width: "125%",
    height: "100%",
    alignSelf: "center",
    opacity: 0.035,
  },

  content: {
    padding: 18,
    paddingBottom: 120,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
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
    fontSize: 32,
    fontWeight: "900",
    color: BRAND.text,
  },

  heroCard: {
    backgroundColor: "#FFFFFFF5",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 28,
    padding: 16,
    marginBottom: 14,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#FFF7FB",
    borderWidth: 1.5,
    borderColor: "#F4CFE4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  logo: {
    width: 52,
    height: 52,
  },

  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: BRAND.text,
  },

  heroText: {
    marginTop: 4,
    color: BRAND.muted,
    lineHeight: 21,
    fontWeight: "700",
    fontSize: 13,
  },

  sectionCard: {
    backgroundColor: "#FFFFFFF5",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 26,
    padding: 16,
    marginBottom: 14,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: BRAND.text,
  },

  mediaCount: {
    color: BRAND.muted,
    fontWeight: "900",
    fontSize: 12,
  },

  input: {
    marginTop: 12,
    minHeight: 150,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#FFF9FC",
    color: BRAND.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },

  captionFooter: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  captionHint: {
    color: BRAND.muted,
    fontWeight: "700",
    fontSize: 12,
  },

  characterCount: {
    color: BRAND.pink,
    fontWeight: "900",
    fontSize: 12,
  },

  addMediaButton: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
  },

  addMediaButtonText: {
    color: BRAND.blue,
    fontWeight: "900",
    fontSize: 15,
  },

  mediaRow: {
    paddingTop: 16,
    paddingRight: 10,
  },

  mediaCard: {
    width: 165,
    marginRight: 14,
  },

  mediaPreview: {
    width: 165,
    height: 205,
    borderRadius: 22,
    backgroundColor: "#000",
  },

  removeButton: {
    marginTop: 8,
    minHeight: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
  },

  removeButtonText: {
    color: "#BE123C",
    fontWeight: "900",
    fontSize: 13,
  },

  emptyMediaBox: {
    marginTop: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    backgroundColor: "#F8FBFF",
    padding: 22,
    alignItems: "center",
  },

  emptyMediaLogo: {
    width: 64,
    height: 64,
    opacity: 0.75,
    marginBottom: 10,
  },

  emptyMediaTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: BRAND.text,
  },

  emptyMediaText: {
    marginTop: 6,
    color: BRAND.muted,
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "700",
    fontSize: 13,
  },

  visibilityRow: {
    marginTop: 12,
    gap: 10,
  },

  visibilityButton: {
    minHeight: 74,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "center",
  },

  visibilityButtonActive: {
    backgroundColor: BRAND.pink,
    borderColor: BRAND.pink,
  },

  visibilityButtonText: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 16,
  },

  visibilityButtonTextActive: {
    color: "#FFFFFF",
  },

  visibilityButtonSubtext: {
    marginTop: 4,
    color: BRAND.muted,
    fontWeight: "700",
    fontSize: 12,
  },

  visibilityButtonSubtextActive: {
    color: "#FFFFFFE0",
  },

  postButton: {
    minHeight: 58,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.pink,
    marginTop: 4,
  },

  postButtonDisabled: {
    opacity: 0.55,
  },

  postButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 17,
  },
});