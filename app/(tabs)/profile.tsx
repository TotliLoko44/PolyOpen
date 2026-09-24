import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useAuth } from "../../lib/auth";
import { BRAND } from "../../lib/brand";
import { listProfileMedia, type ProfileMediaItem } from "../../lib/profile";
import { deletePost, getPostsForProfile } from "../../lib/social";
import { supabase } from "../../lib/supabase";
import { PostMediaVideo } from "../../components/PostMediaVideo";

const POLYOPEN_LOGO = require("../../assets/images/polyopen-logo.png");

type ProfilePost = {
  id: string;
  caption?: string | null;
  visibility?: string | null;
  created_at?: string | null;
  post_type?: string | null;
  first_media_url?: string | null;
  media_urls?: string[];
};

type FollowProfile = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  state?: string | null;
};

type SelfProfileRow = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
  cover_photo_url?: string | null;
  bio?: string | null;
  city?: string | null;
  state?: string | null;
  orientation?: string | null;
  relationship_style?: string | null;
  relationship_styles?: string[] | null;
  spiritual_path?: string | null;
  spiritual_paths?: string[] | null;
  likes_text?: string | null;
  hobbies?: string[] | null;
  western_zodiac?: string | null;
  aztec_zodiac?: string | null;
  chinese_zodiac?: string | null;
  numerology_life_path?: number | null;
  birth_year?: number | null;
  boost_active?: boolean | null;
  boost_started_at?: string | null;
  boost_expires_at?: string | null;
  is_premium?: boolean | null;
  is_verified?: boolean | null;
  verification_tier?: string | null;
  verification_status?: string | null;
  verification_submitted_at?: string | null;
  verification_approved_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function getAge(year?: number | null) {
  if (!year) return null;
  const currentYear = new Date().getFullYear();
  if (year > currentYear || year < 1900) return null;
  return currentYear - year;
}

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

function isVideoPost(post: ProfilePost) {
  return post.post_type === "video" || isVideoUrl(post.first_media_url);
}

function getWesternZodiacSymbol(sign?: string | null) {
  if (!sign) return "";
  const normalized = sign.trim().toLowerCase();

  const map: Record<string, string> = {
    aries: "♈",
    taurus: "♉",
    gemini: "♊",
    cancer: "♋",
    leo: "♌",
    virgo: "♍",
    libra: "♎",
    scorpio: "♏",
    sagittarius: "♐",
    capricorn: "♑",
    aquarius: "♒",
    pisces: "♓",
  };

  return map[normalized] ?? "";
}

function getChineseZodiacSymbol(sign?: string | null) {
  if (!sign) return "";
  const normalized = sign.trim().toLowerCase();

  const map: Record<string, string> = {
    rat: "🐀",
    ox: "🐂",
    tiger: "🐅",
    rabbit: "🐇",
    dragon: "🐉",
    snake: "🐍",
    horse: "🐎",
    goat: "🐐",
    sheep: "🐐",
    ram: "🐐",
    monkey: "🐒",
    rooster: "🐓",
    dog: "🐕",
    pig: "🐖",
  };

  return map[normalized] ?? "";
}

function getVerificationLabel(profile?: SelfProfileRow | null) {
  if (!profile?.is_verified) return "Not verified";
  if (profile.verification_tier === "gold") return "Gold Verified";
  return "Verified";
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillText}>
        {label}: <Text style={styles.infoPillValue}>{value}</Text>
      </Text>
    </View>
  );
}

function AboutRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <View style={styles.aboutRow}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <Text style={styles.aboutValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { width: viewportWidth } = useWindowDimensions();

  const isDesktopWeb = viewportWidth >= 1024;
  const isWideDesktopWeb = viewportWidth >= 1440;

  const { userId } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<SelfProfileRow | null>(null);
  const [publicPhotos, setPublicPhotos] = useState<ProfileMediaItem[]>([]);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [followers, setFollowers] = useState<FollowProfile[]>([]);
  const [following, setFollowing] = useState<FollowProfile[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadFollowLists(currentUserId: string) {
    try {
      const [
        { data: followerRows, error: followerError },
        { data: followingRows, error: followingError },
      ] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", currentUserId),
        supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUserId),
      ]);

      if (followerError) throw followerError;
      if (followingError) throw followingError;

      const followerIds = Array.from(
        new Set(
          ((followerRows ?? []) as { follower_id?: string | null }[])
            .map((row) => row.follower_id)
            .filter(Boolean) as string[],
        ),
      );

      const followingIds = Array.from(
        new Set(
          ((followingRows ?? []) as { following_id?: string | null }[])
            .map((row) => row.following_id)
            .filter(Boolean) as string[],
        ),
      );

      const [
        { data: followerProfiles, error: followerProfilesError },
        { data: followingProfiles, error: followingProfilesError },
      ] = await Promise.all([
        followerIds.length
          ? supabase
              .from("profiles")
              .select(
                "id, display_name, username, profile_photo_url, avatar_url, city, state",
              )
              .in("id", followerIds)
          : Promise.resolve({ data: [], error: null } as any),
        followingIds.length
          ? supabase
              .from("profiles")
              .select(
                "id, display_name, username, profile_photo_url, avatar_url, city, state",
              )
              .in("id", followingIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (followerProfilesError) throw followerProfilesError;
      if (followingProfilesError) throw followingProfilesError;

      setFollowers((followerProfiles ?? []) as FollowProfile[]);
      setFollowing((followingProfiles ?? []) as FollowProfile[]);
    } catch (error: any) {
      setFollowers([]);
      setFollowing([]);
      console.log("Failed to load follow lists:", error?.message ?? error);
    }
  }

  async function loadProfileScreen() {
    if (!userId) {
      setProfile(null);
      setPublicPhotos([]);
      setPosts([]);
      setFollowers([]);
      setFollowing([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [{ data: profileData, error: profileError }, mediaData, postData] =
        await Promise.all([
          supabase
            .from("profiles")
            .select(
              "id, display_name, username, profile_photo_url, avatar_url, cover_photo_url, bio, city, state, orientation, relationship_style, relationship_styles, spiritual_path, spiritual_paths, likes_text, hobbies, western_zodiac, aztec_zodiac, chinese_zodiac, numerology_life_path, birth_year, boost_active, boost_started_at, boost_expires_at, is_premium, is_verified, verification_tier, verification_status, verification_submitted_at, verification_approved_at",
            )
            .eq("id", userId)
            .maybeSingle(),
          listProfileMedia(userId),
          getPostsForProfile(userId),
        ]);

      if (profileError) throw profileError;

      setProfile((profileData as SelfProfileRow | null) ?? null);
      setPublicPhotos(mediaData ?? []);
      setPosts((postData ?? []) as ProfilePost[]);

      await loadFollowLists(userId);
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(postId: string) {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(postId);
            await loadProfileScreen();
          } catch (error: any) {
            Alert.alert("Error", error?.message ?? "Failed to delete post.");
          }
        },
      },
    ]);
  }

  function openProfileGallery() {
    router.push("/profile/gallery" as any);
  }

  useEffect(() => {
    loadProfileScreen();
  }, [userId]);

  const avatarUrl = profile?.profile_photo_url || profile?.avatar_url || null;
  const displayName =
    profile?.display_name || profile?.username || "Your Profile";
  const locationText = [profile?.city, profile?.state]
    .filter(Boolean)
    .join(", ");
  const age = useMemo(() => getAge(profile?.birth_year), [profile?.birth_year]);
  const isGoldVerified = Boolean(profile?.is_verified);

  const relationshipText = useMemo(() => {
    if (profile?.relationship_styles?.length)
      return profile.relationship_styles.join(" • ");
    return profile?.relationship_style || "";
  }, [profile]);

  const spiritualText = useMemo(() => {
    if (profile?.spiritual_paths?.length)
      return profile.spiritual_paths.join(" • ");
    return profile?.spiritual_path || "";
  }, [profile]);

  const westernZodiacLabel = useMemo(() => {
    if (!profile?.western_zodiac) return "";
    const symbol = getWesternZodiacSymbol(profile.western_zodiac);
    return symbol
      ? `${symbol} ${profile.western_zodiac}`
      : profile.western_zodiac;
  }, [profile?.western_zodiac]);

  const aztecZodiacLabel = useMemo(() => {
    if (!profile?.aztec_zodiac) return "";
    return `🗿 ${profile.aztec_zodiac}`;
  }, [profile?.aztec_zodiac]);

  const chineseZodiacLabel = useMemo(() => {
    if (!profile?.chinese_zodiac) return "";
    const symbol = getChineseZodiacSymbol(profile.chinese_zodiac);
    return symbol
      ? `${symbol} ${profile.chinese_zodiac}`
      : profile.chinese_zodiac;
  }, [profile?.chinese_zodiac]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerActionsOnly}>
        <Pressable
          onPress={() => router.push("/premium" as any)}
          style={styles.premiumButton}
        >
          <Text style={styles.premiumButtonText}>Premium</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/wallet" as any)}
          style={styles.walletButton}
        >
          <Text style={styles.walletButtonText}>Wallet</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(tabs)/settings")}
          style={styles.settingsButton}
        >
          <Text style={styles.settingsButtonText}>Settings</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/profile/edit")}
          style={styles.editButton}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.heroCard,
          isDesktopWeb && styles.heroDesktop,
          isWideDesktopWeb && styles.heroWideDesktop,
        ]}
      >
        <View style={styles.cover}>
          {profile?.cover_photo_url ? (
            <Image
              source={{ uri: profile.cover_photo_url }}
              style={styles.coverImage}
              resizeMode={typeof document !== "undefined" ? "contain" : "cover"}
            />
          ) : null}
        </View>

        <View style={styles.profileBody}>
          <Pressable
            onPress={openProfileGallery}
            style={({ pressed }) => [
              styles.avatarWrap,
              pressed ? styles.avatarWrapPressed : null,
            ]}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                resizeMode={
                  typeof document !== "undefined" ? "contain" : "cover"
                }
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Image
                  source={POLYOPEN_LOGO}
                  style={styles.avatarFallbackLogo}
                  resizeMode="contain"
                />
              </View>
            )}

            {isGoldVerified ? (
              <View style={styles.verifiedAvatarBadge}>
                <Text style={styles.verifiedAvatarBadgeText}>★</Text>
              </View>
            ) : null}

            <View style={styles.galleryHintBadge}>
              <Text style={styles.galleryHintText}>＋</Text>
            </View>
          </Pressable>

          <Text style={styles.avatarHintText}>Tap photo to manage gallery</Text>

          <View style={styles.nameRow}>
            <Text style={styles.displayName}>
              {displayName}
              {typeof age === "number" ? `, ${age}` : ""}
            </Text>

            {isGoldVerified ? (
              <View style={styles.goldNameBadge}>
                <Text style={styles.goldNameBadgeText}>★ Verified</Text>
              </View>
            ) : null}
          </View>

          {!!locationText ? (
            <Text style={styles.locationText}>{locationText}</Text>
          ) : null}

          <View style={styles.followStatsRow}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/follows",
                  params: { userId, type: "followers" },
                } as any)
              }
              style={styles.followStat}
            >
              <Text style={styles.followStatNumber}>{followers.length}</Text>
              <Text style={styles.followStatLabel}>Followers</Text>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/follows",
                  params: { userId, type: "following" },
                } as any)
              }
              style={styles.followStat}
            >
              <Text style={styles.followStatNumber}>{following.length}</Text>
              <Text style={styles.followStatLabel}>Following</Text>
            </Pressable>
          </View>

          <View style={styles.tagRow}>
            {isGoldVerified ? (
              <Text style={styles.goldTag}>
                ★ {getVerificationLabel(profile)}
              </Text>
            ) : null}
            {!!westernZodiacLabel && (
              <Text style={styles.tag}>{westernZodiacLabel}</Text>
            )}
            {!!aztecZodiacLabel && (
              <Text style={styles.tag}>{aztecZodiacLabel}</Text>
            )}
            {!!chineseZodiacLabel && (
              <Text style={styles.tag}>{chineseZodiacLabel}</Text>
            )}
            {profile?.numerology_life_path ? (
              <Text style={styles.tag}>
                🔢 Life Path {profile.numerology_life_path}
              </Text>
            ) : null}
          </View>

          {!!relationshipText ? (
            <Text style={styles.relationshipText}>{relationshipText}</Text>
          ) : null}
          {!!spiritualText ? (
            <Text style={styles.spiritualText}>✨ {spiritualText}</Text>
          ) : null}
          {!!profile?.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}

          <Pressable
            onPress={() => router.push("/profile/edit")}
            style={styles.editPublicButton}
          >
            <Text style={styles.editPublicButtonText}>Edit Public Profile</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.sectionCard, isDesktopWeb && styles.sectionDesktop]}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.infoWrap}>
          {!!relationshipText && (
            <InfoPill label="Style" value={relationshipText} />
          )}
          {!!profile?.orientation && (
            <InfoPill label="Orientation" value={profile.orientation} />
          )}
          {!!spiritualText && <InfoPill label="Path" value={spiritualText} />}
          {!!locationText && <InfoPill label="Location" value={locationText} />}
          <InfoPill
            label="Verification"
            value={getVerificationLabel(profile)}
          />
        </View>
      </View>

      <View style={[styles.sectionCard, isDesktopWeb && styles.sectionDesktop]}>
        <Text style={styles.sectionTitle}>About</Text>
        <AboutRow label="Username" value={profile?.username || ""} />
        <AboutRow label="City" value={profile?.city || ""} />
        <AboutRow label="State" value={profile?.state || ""} />
        <AboutRow label="Orientation" value={profile?.orientation || ""} />
        <AboutRow label="Relationship Style" value={relationshipText} />
        <AboutRow label="Spiritual Path" value={spiritualText} />
        <AboutRow label="Likes" value={profile?.likes_text || ""} />
        <AboutRow
          label="Hobbies"
          value={profile?.hobbies?.length ? profile.hobbies.join(", ") : ""}
        />
        <AboutRow
          label="Western Zodiac"
          value={profile?.western_zodiac || ""}
        />
        <AboutRow label="Aztec Zodiac" value={profile?.aztec_zodiac || ""} />
        <AboutRow
          label="Chinese Zodiac"
          value={profile?.chinese_zodiac || ""}
        />
        <AboutRow
          label="Life Path"
          value={
            profile?.numerology_life_path
              ? String(profile.numerology_life_path)
              : ""
          }
        />
        <AboutRow
          label="Premium"
          value={profile?.is_premium ? "Active" : "Not active"}
        />
        <AboutRow label="Verification" value={getVerificationLabel(profile)} />
      </View>

      <View style={[styles.sectionCard, isDesktopWeb && styles.sectionDesktop]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Public Photos</Text>
          <Pressable onPress={openProfileGallery}>
            <Text style={styles.manageText}>Manage</Text>
          </Pressable>
        </View>

        {publicPhotos.length === 0 ? (
          <View style={styles.emptyPhotoCard}>
            <Text style={styles.emptyPhotoTitle}>No public photos yet</Text>
            <Text style={styles.emptyPhotoText}>
              Add public profile photos from your gallery.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoScrollContent}
          >
            {publicPhotos.map((item) => (
              <Pressable key={item.id} onPress={openProfileGallery}>
                <Image
                  source={{ uri: item.media_url }}
                  style={styles.publicPhoto}
                  resizeMode={
                    typeof document !== "undefined" ? "contain" : "cover"
                  }
                />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <Pressable
        onPress={() => router.push("/create-post")}
        style={styles.createPostButton}
      >
        <Text style={styles.createPostButtonText}>Create Post</Text>
      </Pressable>

      <View style={styles.postsHeaderRow}>
        <Text style={styles.postsTitle}>Private Posts</Text>
        <Text style={styles.postsCount}>{posts.length}</Text>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : posts.length === 0 ? (
        <View style={styles.noPostsCard}>
          <Text style={styles.noPostsTitle}>No posts yet</Text>
          <Text style={styles.noPostsText}>
            Start posting photos, videos, thoughts, or memes to build your
            private profile content.
          </Text>

          <Pressable
            onPress={() => router.push("/create-post")}
            style={styles.firstPostButton}
          >
            <Text style={styles.firstPostButtonText}>Create First Post</Text>
          </Pressable>
        </View>
      ) : (
        posts.map((post) => {
          const mediaUrl = post.first_media_url ?? null;
          const videoPost = isVideoPost(post);

          return (
            <View key={post.id} style={styles.postCard}>
              {mediaUrl ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/post/[id]",
                      params: { id: post.id, returnTo: "profile" },
                    } as any)
                  }
                >
                  {videoPost ? (
                    <View
                      style={[
                        styles.videoPreviewWrap,
                        {
                          aspectRatio:
                            typeof document !== "undefined" ? 4 / 5 : 4 / 3,
                        },
                      ]}
                    >
                      <PostMediaVideo
                        uri={mediaUrl}
                        fit={
                          typeof document !== "undefined" ? "contain" : "cover"
                        }
                      />
                      <View style={styles.videoBadge}>
                        <Text style={styles.videoBadgeText}>Video</Text>
                      </View>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: mediaUrl }}
                      style={styles.postImage}
                      resizeMode={
                        typeof document !== "undefined" ? "contain" : "cover"
                      }
                    />
                  )}
                </Pressable>
              ) : (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/post/[id]",
                      params: { id: post.id, returnTo: "profile" },
                    } as any)
                  }
                  style={styles.textPostPreview}
                >
                  <Text style={styles.textPostPreviewText}>Text Post</Text>
                </Pressable>
              )}

              <View style={styles.postBody}>
                {post.caption ? (
                  <Text style={styles.postCaption}>{post.caption}</Text>
                ) : null}
                <Text style={styles.postDate}>
                  {formatDate(post.created_at)}
                </Text>

                <View style={styles.postActions}>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/post/[id]",
                        params: { id: post.id, returnTo: "profile" },
                      } as any)
                    }
                    style={styles.openPostButton}
                  >
                    <Text style={styles.openPostButtonText}>Open</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => router.push(`/edit-post/${post.id}` as any)}
                    style={styles.editPostButton}
                  >
                    <Text style={styles.editPostButtonText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleDelete(post.id)}
                    style={styles.deletePostButton}
                  >
                    <Text style={styles.deletePostButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.bg },

  content: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    padding: 14,
    paddingBottom: 140,
  },

  headerActionsOnly: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },

  premiumButton: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    borderWidth: 1.5,
    borderColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
  },

  premiumButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },

  walletButton: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "#111111",
    borderWidth: 1.5,
    borderColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
  },

  walletButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },

  settingsButton: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
  },

  settingsButtonText: {
    color: BRAND.blue,
    fontWeight: "900",
    fontSize: 13,
  },

  editButton: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
  },

  editButtonText: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 13,
  },

  heroDesktop: {
    paddingHorizontal: 28,
  },

  heroWideDesktop: {
    maxWidth: 980,
    alignSelf: "center",
  },

  heroCard: {
    backgroundColor: "#FFFFFFEE",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 18,
  },

  cover: { width: "100%", height: 145, backgroundColor: "#F3F7FF" },
  coverImage: { width: "100%", height: "100%" },

  profileBody: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 20,
  },

  avatarWrap: {
    marginTop: -52,
    backgroundColor: "#fff",
    borderRadius: 999,
    padding: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },

  avatarWrapPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },

  avatar: {
    width: 118,
    height: 118,
    borderRadius: 999,
    backgroundColor: "#fff",
  },

  avatarFallback: {
    width: 118,
    height: 118,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarFallbackLogo: { width: 104, height: 104 },

  verifiedAvatarBadge: {
    position: "absolute",
    right: 3,
    bottom: 8,
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#F6C343",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  verifiedAvatarBadgeText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 18,
  },

  galleryHintBadge: {
    position: "absolute",
    left: 3,
    bottom: 8,
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  galleryHintText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 22,
    lineHeight: 24,
  },

  avatarHintText: {
    marginTop: 8,
    color: BRAND.muted,
    fontWeight: "800",
    fontSize: 12,
  },

  nameRow: {
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  displayName: {
    fontSize: 28,
    fontWeight: "900",
    color: BRAND.text,
    textAlign: "center",
  },

  goldNameBadge: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#111111",
    borderWidth: 1.5,
    borderColor: "#F6C343",
  },

  goldNameBadgeText: {
    color: "#F6C343",
    fontWeight: "900",
    fontSize: 13,
  },

  locationText: {
    marginTop: 6,
    color: BRAND.muted,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },

  followStatsRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  followStat: {
    minWidth: 112,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },

  followStatNumber: { color: BRAND.text, fontSize: 20, fontWeight: "900" },
  followStatLabel: {
    marginTop: 2,
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: "800",
  },

  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 16,
  },

  tag: {
    fontWeight: "800",
    color: BRAND.text,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  goldTag: {
    fontWeight: "900",
    color: "#111111",
    backgroundColor: "#F6C343",
    borderWidth: 1.5,
    borderColor: "#111111",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  relationshipText: {
    marginTop: 14,
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 18,
  },

  spiritualText: {
    marginTop: 8,
    color: "#666",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 18,
  },

  bio: {
    marginTop: 14,
    color: "#555",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  editPublicButton: {
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  editPublicButtonText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  sectionCard: {
    backgroundColor: "#FFFFFFEE",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
  },

  sectionDesktop: {
    padding: 24,
    borderRadius: 28,
  },

  sectionTitle: {
    fontWeight: "900",
    fontSize: 20,
    color: BRAND.text,
    marginBottom: 12,
  },

  infoWrap: { flexDirection: "row", flexWrap: "wrap" },

  infoPill: {
    backgroundColor: "#F8FAFF",
    borderWidth: 1,
    borderColor: "#DFE7FA",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },

  infoPillText: { color: "#2045A6", fontWeight: "800", fontSize: 13 },
  infoPillValue: { color: BRAND.text },

  aboutRow: { marginBottom: 14 },
  aboutLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: BRAND.muted,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  aboutValue: {
    fontSize: 16,
    fontWeight: "700",
    color: BRAND.text,
    lineHeight: 22,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  manageText: { color: BRAND.blue, fontWeight: "900" },

  emptyPhotoCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: "#fff",
    padding: 16,
  },

  emptyPhotoTitle: { color: BRAND.text, fontWeight: "800", fontSize: 16 },
  emptyPhotoText: { color: BRAND.muted, marginTop: 6, lineHeight: 21 },

  photoScrollContent: { paddingRight: 8 },

  publicPhoto: {
    width: 170,
    height: 220,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: "#000",
  },

  createPostButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.pink,
    marginBottom: 18,
  },

  createPostButtonText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  postsHeaderRow: {
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  postsTitle: { fontWeight: "900", fontSize: 20, color: BRAND.text },
  postsCount: { color: BRAND.muted, fontWeight: "700" },
  loadingText: { marginTop: 12, color: BRAND.muted },

  noPostsCard: {
    marginTop: 10,
    backgroundColor: "#FFFFFFEE",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 24,
    padding: 18,
  },

  noPostsTitle: { fontSize: 20, fontWeight: "900", color: BRAND.text },
  noPostsText: { marginTop: 8, color: BRAND.muted, lineHeight: 22 },

  firstPostButton: {
    marginTop: 16,
    alignSelf: "flex-start",
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: BRAND.text,
    alignItems: "center",
    justifyContent: "center",
  },

  firstPostButtonText: { color: "#fff", fontWeight: "900" },

  postCard: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#fff",
  },

  postImage: { width: "100%", aspectRatio: 4 / 3, backgroundColor: "#000" },

  postVideo: {
    width: "100%",
    height: "100%",
    alignSelf: "center",
    backgroundColor: "#000",
  },

  videoPreviewWrap: {
    width: "100%",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
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

  textPostPreview: {
    height: 120,
    backgroundColor: "#F8FBFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  textPostPreviewText: { color: BRAND.blue, fontWeight: "900", fontSize: 16 },

  postBody: { padding: 14 },
  postCaption: { fontSize: 15, color: BRAND.text, lineHeight: 22 },
  postDate: { marginTop: 8, color: BRAND.muted, fontWeight: "600" },

  postActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    gap: 10,
  },

  openPostButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F4F7FF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  openPostButtonText: { color: BRAND.blue, fontWeight: "900" },

  editPostButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#FFF0F7",
    borderWidth: 1.5,
    borderColor: "#F7B8DA",
    alignItems: "center",
    justifyContent: "center",
  },

  editPostButtonText: { color: BRAND.pink, fontWeight: "900" },

  deletePostButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  deletePostButtonText: { color: "#fff", fontWeight: "900" },
});
