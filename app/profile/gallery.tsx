import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { useAuth } from "../../lib/auth";
import { BRAND } from "../../lib/brand";
import {
    deleteProfileMediaItems,
    listProfileMedia,
    uploadProfileMedia,
    type ProfileMediaItem,
} from "../../lib/profile";
import { getPostsForProfile } from "../../lib/social";
import { supabase } from "../../lib/supabase";

const POLYOPEN_LOGO = require("../../assets/images/polyopen-logo.png");

type ProfilePost = {
  id: string;
  caption?: string | null;
  post_type?: string | null;
  first_media_url?: string | null;
  media_urls?: string[];
  created_at?: string | null;
};

type GalleryItem = {
  id: string;
  url: string;
  source: "profile" | "post";
  postId?: string;
  rawProfileItem?: ProfileMediaItem;
};

function isVideoUrl(url?: string | null) {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();

  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".mov") ||
    clean.endsWith(".m4v") ||
    clean.endsWith(".webm")
  );
}

export default function ProfileGalleryScreen() {
  const router = useRouter();
  const { userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profileMedia, setProfileMedia] = useState<ProfileMediaItem[]>([]);
  const [posts, setPosts] = useState<ProfilePost[]>([]);

  const galleryItems = useMemo<GalleryItem[]>(() => {
    const profileItems: GalleryItem[] = profileMedia
      .filter((item) => !!item.media_url)
      .map((item) => ({
        id: `profile-${item.id}`,
        url: item.media_url,
        source: "profile",
        rawProfileItem: item,
      }));

    const postItems: GalleryItem[] = posts
      .flatMap((post) => {
        const urls = post.media_urls?.length
          ? post.media_urls
          : post.first_media_url
            ? [post.first_media_url]
            : [];

        return urls
          .filter(Boolean)
          .map((url, index) => ({
            id: `post-${post.id}-${index}`,
            url,
            source: "post" as const,
            postId: post.id,
          }));
      })
      .filter((item) => !!item.url);

    return [...profileItems, ...postItems];
  }, [profileMedia, posts]);

  async function loadGallery() {
    if (!userId) {
      setProfilePhotoUrl(null);
      setProfileMedia([]);
      setPosts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [{ data: profileData, error: profileError }, mediaData, postData] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("profile_photo_url, avatar_url")
            .eq("id", userId)
            .maybeSingle(),
          listProfileMedia(userId),
          getPostsForProfile(userId),
        ]);

      if (profileError) throw profileError;

      setProfilePhotoUrl(
        profileData?.profile_photo_url || profileData?.avatar_url || null
      );
      setProfileMedia(mediaData ?? []);
      setPosts((postData ?? []) as ProfilePost[]);
    } catch (error: any) {
      Alert.alert("Gallery Error", error?.message ?? "Could not load gallery.");
    } finally {
      setLoading(false);
    }
  }

  async function pickAndUploadPhotos() {
    if (!userId || uploading) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Permission needed", "Please allow photo access to upload.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        allowsEditing: false,
        quality: 0.88,
      });

      if (result.canceled) return;

      const uris = result.assets.map((asset) => asset.uri).filter(Boolean);

      if (uris.length === 0) return;

      setUploading(true);

      const nextSortOrder = profileMedia.length;
      const uploaded = await uploadProfileMedia(userId, uris, nextSortOrder);

      setProfileMedia((prev) => [...prev, ...uploaded]);

      if (!profilePhotoUrl && uploaded[0]?.media_url) {
        await setPrimaryPhoto(uploaded[0].media_url, false);
      }
    } catch (error: any) {
      Alert.alert("Upload Error", error?.message ?? "Could not upload photos.");
    } finally {
      setUploading(false);
    }
  }

  async function setPrimaryPhoto(url: string, showAlert = true) {
    if (!userId || !url || isVideoUrl(url)) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          profile_photo_url: url,
          avatar_url: url,
        })
        .eq("id", userId);

      if (error) throw error;

      setProfilePhotoUrl(url);

      if (showAlert) {
        Alert.alert("Updated", "This is now your main profile photo.");
      }
    } catch (error: any) {
      Alert.alert("Profile Photo Error", error?.message ?? "Could not update photo.");
    }
  }

  async function deleteProfilePhoto(item: ProfileMediaItem) {
    Alert.alert("Delete Photo", "Remove this photo from your public gallery?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteProfileMediaItems([item]);
            setProfileMedia((prev) => prev.filter((photo) => photo.id !== item.id));

            if (profilePhotoUrl === item.media_url) {
              const nextPhoto = profileMedia.find((photo) => photo.id !== item.id);
              const nextUrl = nextPhoto?.media_url ?? null;

              await supabase
                .from("profiles")
                .update({
                  profile_photo_url: nextUrl,
                  avatar_url: nextUrl,
                })
                .eq("id", userId);

              setProfilePhotoUrl(nextUrl);
            }
          } catch (error: any) {
            Alert.alert("Delete Error", error?.message ?? "Could not delete photo.");
          }
        },
      },
    ]);
  }

  useEffect(() => {
    loadGallery();
  }, [userId]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <Pressable
          onPress={pickAndUploadPhotos}
          disabled={uploading}
          style={[styles.uploadButton, uploading ? styles.disabledButton : null]}
        >
          <Text style={styles.uploadButtonText}>
            {uploading ? "Uploading..." : "Upload"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Profile Gallery</Text>
      <Text style={styles.subtitle}>
        Manage your selfies, profile photos, and pictures from your posts.
      </Text>

      <View style={styles.currentCard}>
        <Text style={styles.sectionTitle}>Current Profile Photo</Text>

        <View style={styles.currentPhotoWrap}>
          {profilePhotoUrl ? (
            <Image
              source={{ uri: profilePhotoUrl }}
              style={styles.currentPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.currentFallback}>
              <Image
                source={POLYOPEN_LOGO}
                style={styles.currentFallbackLogo}
                resizeMode="contain"
              />
            </View>
          )}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>All Photos</Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading gallery...</Text>
          </View>
        ) : galleryItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No photos yet</Text>
            <Text style={styles.emptyText}>
              Upload public profile photos or create posts with images to build your gallery.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {galleryItems.map((item) => {
              const isVideo = isVideoUrl(item.url);
              const isPrimary = profilePhotoUrl === item.url;

              return (
                <View key={item.id} style={styles.photoCard}>
                  {isVideo ? (
                    <View style={styles.videoWrap}>
                      <Video
                        source={{ uri: item.url }}
                        style={styles.photo}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                        isMuted
                        useNativeControls={false}
                      />
                      <View style={styles.videoBadge}>
                        <Text style={styles.videoBadgeText}>Video</Text>
                      </View>
                    </View>
                  ) : (
                    <Image source={{ uri: item.url }} style={styles.photo} resizeMode="cover" />
                  )}

                  <View style={styles.photoInfo}>
                    <Text style={styles.photoSource}>
                      {item.source === "profile" ? "Profile photo" : "Post photo"}
                    </Text>

                    {isPrimary ? (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    ) : null}

                    {!isVideo ? (
                      <Pressable
                        onPress={() => setPrimaryPhoto(item.url)}
                        style={styles.setPrimaryButton}
                      >
                        <Text style={styles.setPrimaryButtonText}>Set as Profile</Text>
                      </Pressable>
                    ) : null}

                    {item.source === "profile" && item.rawProfileItem ? (
                      <Pressable
                        onPress={() => deleteProfilePhoto(item.rawProfileItem!)}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </Pressable>
                    ) : item.postId ? (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/post/[id]",
                            params: { id: item.postId, returnTo: "profile_gallery" },
                          } as any)
                        }
                        style={styles.openPostButton}
                      >
                        <Text style={styles.openPostButtonText}>Open Post</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  content: {
    padding: 16,
    paddingBottom: 140,
  },

  topRow: {
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

  uploadButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  uploadButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  disabledButton: {
    opacity: 0.6,
  },

  title: {
    marginTop: 20,
    color: BRAND.text,
    fontSize: 34,
    fontWeight: "900",
  },

  subtitle: {
    marginTop: 6,
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 18,
  },

  currentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    padding: 16,
    alignItems: "center",
    marginBottom: 18,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    padding: 16,
  },

  sectionTitle: {
    alignSelf: "flex-start",
    color: BRAND.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
  },

  currentPhotoWrap: {
    width: 170,
    height: 170,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: "#F8FBFF",
    overflow: "hidden",
  },

  currentPhoto: {
    width: "100%",
    height: "100%",
  },

  currentFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  currentFallbackLogo: {
    width: 145,
    height: 145,
  },

  loadingWrap: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    color: BRAND.muted,
    fontWeight: "700",
  },

  emptyCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },

  emptyTitle: {
    color: BRAND.text,
    fontSize: 18,
    fontWeight: "900",
  },

  emptyText: {
    marginTop: 6,
    color: BRAND.muted,
    lineHeight: 21,
    fontWeight: "700",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  photoCard: {
    width: "48%",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
  },

  photo: {
    width: "100%",
    height: 210,
    backgroundColor: "#000",
  },

  videoWrap: {
    width: "100%",
    height: 210,
    backgroundColor: "#000",
  },

  videoBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  videoBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  photoInfo: {
    padding: 10,
  },

  photoSource: {
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
  },

  primaryBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#111111",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },

  primaryBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  setPrimaryButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  setPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  deleteButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  openPostButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },

  openPostButtonText: {
    color: BRAND.text,
    fontSize: 12,
    fontWeight: "900",
  },
});