import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth";
import { BRAND } from "../../lib/brand";
import {
  createFollowNotification,
  createProfileViewNotification,
  getProfileDisplayName,
} from "../../lib/notifications";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  profile_photo_url?: string | null;
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
  boost_expires_at?: string | null;
};

type Media = {
  id: string;
  media_url: string | null;
};


const POLYOPEN_LOGO = require("../../assets/images/polyopen-logo.png");

function getAge(year?: number | null) {
  if (!year) return null;
  const currentYear = new Date().getFullYear();
  if (year > currentYear || year < 1900) return null;
  return currentYear - year;
}

function getWesternZodiacSymbol(sign?: string | null) {
  if (!sign) return "";
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
  return map[sign.trim().toLowerCase()] ?? "";
}

function getChineseZodiacSymbol(sign?: string | null) {
  if (!sign) return "";
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
  return map[sign.trim().toLowerCase()] ?? "";
}

function isBoostActive(profile?: Profile | null) {
  if (!profile?.boost_active || !profile?.boost_expires_at) return false;
  const expires = new Date(profile.boost_expires_at).getTime();
  return !Number.isNaN(expires) && expires > Date.now();
}

function maskName(name: string) {
  if (!name) return "Someone";
  return `${name.charAt(0)}•••`;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{children}</Text>
    </View>
  );
}

function SoftChip({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.softChip}>
      <Text style={styles.softChipText}>{children}</Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function DefaultAvatar({ locked = false }: { locked?: boolean }) {
  return (
    <View style={styles.avatarFallback}>
      <Image
        source={POLYOPEN_LOGO}
        style={[styles.avatarFallbackLogo, locked ? styles.lockedLogo : null]}
        resizeMode="contain"
      />
    </View>
  );
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userId: myUserId } = useAuth();

  const hasTrackedView = useRef(false);

  const profileId = useMemo(() => {
    const raw = params.userId ?? params.id;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return null;
  }, [params.userId, params.id]);

  const lockedPreview = useMemo(() => {
    const raw = params.lockedPreview;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value === "1" || value === "true";
  }, [params.lockedPreview]);

  const notificationSource = useMemo(() => {
    const raw = params.source;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.source]);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [secretAdmirerLoading, setSecretAdmirerLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  async function loadProfile() {
    if (!profileId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [
        { data: profileData, error: profileError },
        { data: mediaData },
        { count: followers },
        { count: following },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", profileId).maybeSingle(),
        supabase
          .from("profile_media")
          .select("id, media_url")
          .eq("user_id", profileId)
          .order("created_at", { ascending: false }),
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("following_id", profileId),
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", profileId),
      ]);

      if (profileError) throw profileError;

      setProfile((profileData as Profile | null) ?? null);
      setMedia((mediaData as Media[]) ?? []);
      setFollowersCount(followers ?? 0);
      setFollowingCount(following ?? 0);
    } catch (error: any) {
      console.log("PROFILE ERROR:", error);
      Alert.alert("Profile Error", error?.message ?? "Could not load profile.");
      setProfile(null);
      setMedia([]);
      setFollowersCount(0);
      setFollowingCount(0);
    } finally {
      setLoading(false);
    }
  }

  async function checkIfFollowing() {
    if (!myUserId || !profileId || myUserId === profileId) {
      setIsFollowing(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", myUserId)
        .eq("following_id", profileId)
        .maybeSingle();

      if (error) throw error;

      setIsFollowing(!!data);
    } catch (error) {
      console.log("FOLLOW CHECK ERROR:", error);
      setIsFollowing(false);
    }
  }

  async function toggleFollow() {
    if (!myUserId || !profileId || myUserId === profileId || followLoading) return;

    try {
      setFollowLoading(true);

      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", myUserId)
          .eq("following_id", profileId);

        if (error) throw error;

        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase.from("follows").upsert(
          {
            follower_id: myUserId,
            following_id: profileId,
          },
          { onConflict: "follower_id,following_id" }
        );

        if (error) throw error;

        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);

        try {
          const followerName = await getProfileDisplayName(myUserId);

          await createFollowNotification({
            followedUserId: profileId,
            followerUserId: myUserId,
            followerName,
          });
        } catch (notificationError) {
          console.log("FOLLOW NOTIFICATION ERROR:", notificationError);
        }
      }
    } catch (error: any) {
      Alert.alert("Follow Error", error?.message ?? "Could not update follow.");
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleBlockUser() {
    if (!myUserId || !profileId || myUserId === profileId || blockLoading) return;

    const blockedName = profile?.display_name || profile?.username || "this user";

    Alert.alert(
      "Block User",
      `Block ${blockedName}? They will be hidden from your feed, swipe, and profile areas where blocking is enforced.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              setBlockLoading(true);

              const { error: blockError } = await supabase
                .from("user_blocks")
                .upsert(
                  {
                    blocker_id: myUserId,
                    blocked_id: profileId,
                  },
                  { onConflict: "blocker_id,blocked_id" }
                );

              if (blockError) throw blockError;

              await Promise.all([
                supabase
                  .from("follows")
                  .delete()
                  .eq("follower_id", myUserId)
                  .eq("following_id", profileId),
                supabase
                  .from("follows")
                  .delete()
                  .eq("follower_id", profileId)
                  .eq("following_id", myUserId),
              ]);

              Alert.alert("Blocked", `${blockedName} has been blocked.`);
              router.replace("/(tabs)/feed" as any);
            } catch (error: any) {
              Alert.alert("Block Error", error?.message ?? "Could not block user.");
            } finally {
              setBlockLoading(false);
            }
          },
        },
      ]
    );
  }

  async function trackProfileView() {
    if (
      lockedPreview ||
      !myUserId ||
      !profileId ||
      myUserId === profileId ||
      hasTrackedView.current
    ) {
      return;
    }

    try {
      hasTrackedView.current = true;

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: recentView, error: recentViewError } = await supabase
        .from("profile_views")
        .select("id")
        .eq("viewer_id", myUserId)
        .eq("viewed_id", profileId)
        .gte("created_at", since)
        .maybeSingle();

      if (recentViewError) throw recentViewError;
      if (recentView) return;

      const { error: insertError } = await supabase.from("profile_views").insert({
        viewer_id: myUserId,
        viewed_id: profileId,
      });

      if (insertError) throw insertError;

      try {
        const viewerName = await getProfileDisplayName(myUserId);

        await createProfileViewNotification({
          viewedUserId: profileId,
          viewerUserId: myUserId,
          viewerName,
        });
      } catch (notificationError) {
        console.log("PROFILE VIEW NOTIFICATION ERROR:", notificationError);
      }
    } catch (error) {
      console.log("PROFILE VIEW TRACK ERROR:", error);
    }
  }
async function handleMessage() {
    if (!myUserId || !profileId || myUserId === profileId || messageLoading) {
      return;
    }

    try {
      setMessageLoading(true);
} catch (error: any) {
      console.log("MESSAGE ROUTE ERROR:", error);
      Alert.alert("Chat unavailable", error?.message ?? "Could not open conversation.");
    } finally {
      setMessageLoading(false);
    }
  }


  async function sendSecretAdmirer() {
    if (!myUserId || !profileId || secretAdmirerLoading) {
      return;
    }

    try {
      setSecretAdmirerLoading(true);

      const { error } = await supabase.rpc(
        "send_secret_admirer",
        {
          target_user_id: profileId,
        }
      );

      if (error) throw error;

      Alert.alert(
        "Secret Admirer 💘",
        "Sent privately. They’ll know someone is interested, but Premium is required to reveal who."
      );
    } catch (error: any) {
      console.log(
        "SECRET ADMIRER SEND ERROR:",
        error
      );

      Alert.alert(
        "Secret Admirer",
        error?.message ??
          "PolyOpen could not send your Secret Admirer right now."
      );
    } finally {
      setSecretAdmirerLoading(false);
    }
  }

  function openPremium() {
    router.push("/premium" as any);
  }

  useEffect(() => {
    hasTrackedView.current = false;
    loadProfile();
  }, [profileId]);

  useEffect(() => {
    trackProfileView();
    checkIfFollowing();
  }, [myUserId, profileId, lockedPreview]);

  const avatarUrl = profile?.profile_photo_url || profile?.avatar_url || null;
  const realDisplayName = profile?.display_name || profile?.username || "PolyOpen User";
  const displayName = lockedPreview ? maskName(realDisplayName) : realDisplayName;

  const location = useMemo(() => {
    return [profile?.city, profile?.state].filter(Boolean).join(", ");
  }, [profile]);

  const age = useMemo(() => getAge(profile?.birth_year), [profile?.birth_year]);

  const relationshipText = useMemo(() => {
    if (profile?.relationship_styles?.length) {
      return profile.relationship_styles.join(" • ");
    }
    return profile?.relationship_style || "";
  }, [profile]);

  const spiritualText = useMemo(() => {
    if (profile?.spiritual_paths?.length) {
      return profile.spiritual_paths.join(" • ");
    }
    return profile?.spiritual_path || "";
  }, [profile]);

  const westernLabel = useMemo(() => {
    if (!profile?.western_zodiac) return "";
    const symbol = getWesternZodiacSymbol(profile.western_zodiac);
    return symbol ? `${symbol} ${profile.western_zodiac}` : profile.western_zodiac;
  }, [profile?.western_zodiac]);

  const chineseLabel = useMemo(() => {
    if (!profile?.chinese_zodiac) return "";
    const symbol = getChineseZodiacSymbol(profile.chinese_zodiac);
    return symbol ? `${symbol} ${profile.chinese_zodiac}` : profile.chinese_zodiac;
  }, [profile?.chinese_zodiac]);

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;

    const fields = [
      profile.display_name || profile.username,
      avatarUrl,
      profile.bio,
      location,
      relationshipText,
      spiritualText,
      profile.western_zodiac,
      profile.aztec_zodiac,
      profile.chinese_zodiac,
      profile.numerology_life_path,
      profile.hobbies?.length ? "hobbies" : "",
      media.length ? "media" : "",
    ];

    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [profile, avatarUrl, location, relationshipText, spiritualText, media.length]);

  const hasAboutDetails =
    !!profile?.orientation ||
    !!relationshipText ||
    !!spiritualText ||
    !!profile?.likes_text ||
    !!profile?.hobbies?.length ||
    !!profile?.western_zodiac ||
    !!profile?.aztec_zodiac ||
    !!profile?.chinese_zodiac ||
    !!profile?.numerology_life_path;

  const hasCompatibilityDetails =
    !!westernLabel ||
    !!profile?.aztec_zodiac ||
    !!chineseLabel ||
    !!profile?.numerology_life_path ||
    !!relationshipText ||
    !!spiritualText;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator style={styles.loader} />
        ) : !profile ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Profile not found</Text>
            <Text style={styles.emptyText}>
              This profile may have been removed or is unavailable.
            </Text>
          </View>
        ) : (
          <>
            {lockedPreview ? (
              <View style={styles.lockedNotice}>
                <Text style={styles.lockedNoticeTitle}>
                  {notificationSource === "profile_like_notification"
                    ? "Someone liked your profile"
                    : "Someone viewed your profile"}
                </Text>
                <Text style={styles.lockedNoticeText}>
                  Preview their card below. Unlock to reveal the full profile.
                </Text>
              </View>
            ) : null}

            <View style={styles.heroCard}>
              <View style={styles.cover}>
                {profile.cover_photo_url ? (
                  <Image
                    source={{ uri: profile.cover_photo_url }}
                    style={styles.coverImage}
                    blurRadius={lockedPreview ? 28 : 0}
                    resizeMode="cover"
                  />
                ) : (
                  <Image source={POLYOPEN_LOGO} style={styles.coverLogo} resizeMode="contain" />
                )}

                {lockedPreview ? <View style={styles.lockedOverlay} /> : null}

                {isBoostActive(profile) && !lockedPreview ? (
                  <View style={styles.boostBadge}>
                    <Text style={styles.boostBadgeText}>⚡ Boosted</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.profileCenter}>
                <View style={styles.avatarWrap}>
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={styles.avatar}
                      blurRadius={lockedPreview ? 24 : 0}
                      resizeMode="cover"
                    />
                  ) : (
                    <DefaultAvatar locked={lockedPreview} />
                  )}

                  {lockedPreview ? (
                    <View style={styles.avatarLockBadge}>
                      <Text style={styles.avatarLockText}>🔒</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.name}>
                  {displayName}
                  {!lockedPreview && typeof age === "number" ? `, ${age}` : ""}
                </Text>

                {!lockedPreview && !!profile.username && (
                  <Text style={styles.username}>@{profile.username}</Text>
                )}

                <Text style={styles.location}>
                  {lockedPreview ? "Unlock to reveal details" : location || "PolyOpen member"}
                </Text>

                <View style={styles.statsRow}>
                  <View style={styles.statPill}>
                    <Text style={styles.statNumber}>{lockedPreview ? "••" : followersCount}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                  </View>

                  <View style={styles.statPill}>
                    <Text style={styles.statNumber}>{lockedPreview ? "••" : followingCount}</Text>
                    <Text style={styles.statLabel}>Following</Text>
                  </View>

                  <View style={styles.statPill}>
                    <Text style={styles.statNumber}>{lockedPreview ? "••" : `${profileCompletion}%`}</Text>
                    <Text style={styles.statLabel}>Complete</Text>
                  </View>
                </View>

                <View style={styles.chipRow}>
                  {!!westernLabel && <Chip>{westernLabel}</Chip>}
                  {!!profile.aztec_zodiac && <Chip>🗿 {profile.aztec_zodiac}</Chip>}
                  {!!chineseLabel && <Chip>{chineseLabel}</Chip>}
                  {!!profile.numerology_life_path && (
                    <Chip>🔢 Life Path {profile.numerology_life_path}</Chip>
                  )}
                  {isBoostActive(profile) && !lockedPreview && <Chip>⚡ Priority Profile</Chip>}
                </View>

                {lockedPreview ? (
                  <>
                    <Text style={styles.bioMuted}>
                      This profile is locked from notifications. Unlock to reveal their full photos,
                      name, location, and details.
                    </Text>

                    <Pressable onPress={openPremium} style={styles.unlockButton}>
                      <Text style={styles.unlockButtonText}>Unlock Profile</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {!!relationshipText && <Text style={styles.relationship}>{relationshipText}</Text>}
                    {!!spiritualText && <Text style={styles.spiritual}>✨ {spiritualText}</Text>}
                    {!!profile.bio ? (
                      <Text style={styles.bio}>{profile.bio}</Text>
                    ) : (
                      <Text style={styles.bioMuted}>
                        This profile is still being filled out.
                      </Text>
                    )}

                    {myUserId !== profile.id ? (
                      <View style={styles.actionRow}>
                        <Pressable
                          onPress={handleMessage}
                          disabled={messageLoading}
                          style={[
                            styles.messageAction,
                            messageLoading ? styles.actionDisabled : null,
                          ]}
                        >
                          <Text style={styles.messageActionText}>
                            {messageLoading ? "..." : "Message"}
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={toggleFollow}
                          disabled={followLoading}
                          style={[
                            styles.secondaryAction,
                            isFollowing ? styles.followingAction : null,
                            followLoading ? styles.actionDisabled : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.secondaryActionText,
                              isFollowing ? styles.followingActionText : null,
                            ]}
                          >
                            {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
                          </Text>
                        </Pressable>

                    <Pressable
                      onPress={sendSecretAdmirer}
                      disabled={secretAdmirerLoading}
                      style={[
                        styles.secretAdmirerButton,
                        secretAdmirerLoading
                          ? { opacity: 0.6 }
                          : null,
                      ]}
                    >
                      <Text style={styles.secretAdmirerButtonText}>
                        {secretAdmirerLoading
                          ? "Sending..."
                          : "💘 Secret Admirer"}
                      </Text>
                    </Pressable>


                        <Pressable
                          onPress={handleBlockUser}
                          disabled={blockLoading}
                          style={[styles.moreAction, blockLoading ? styles.actionDisabled : null]}
                        >
                          <Text style={styles.moreActionText}>
                            {blockLoading ? "..." : "⋯"}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Compatibility</Text>

              {lockedPreview ? (
                <Text style={styles.emptySectionText}>
                  Unlock this profile to reveal compatibility details.
                </Text>
              ) : hasCompatibilityDetails ? (
                <View style={styles.compatibilityGrid}>
                  {!!westernLabel && <SoftChip>{westernLabel}</SoftChip>}
                  {!!profile.aztec_zodiac && <SoftChip>🗿 Aztec {profile.aztec_zodiac}</SoftChip>}
                  {!!chineseLabel && <SoftChip>{chineseLabel}</SoftChip>}
                  {!!profile.numerology_life_path && (
                    <SoftChip>🔢 Life Path {profile.numerology_life_path}</SoftChip>
                  )}
                  {!!relationshipText && <SoftChip>{relationshipText}</SoftChip>}
                  {!!spiritualText && <SoftChip>✨ {spiritualText}</SoftChip>}
                </View>
              ) : (
                <Text style={styles.emptySectionText}>
                  Compatibility details will appear here when this person adds more profile info.
                </Text>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>About</Text>

              {lockedPreview ? (
                <Text style={styles.emptySectionText}>
                  Unlock to see their full About section.
                </Text>
              ) : hasAboutDetails ? (
                <>
                  <DetailRow label="Orientation" value={profile.orientation || ""} />
                  <DetailRow label="Relationship Style" value={relationshipText} />
                  <DetailRow label="Spiritual Path" value={spiritualText} />
                  <DetailRow label="Likes" value={profile.likes_text || ""} />
                  <DetailRow
                    label="Hobbies"
                    value={profile.hobbies?.length ? profile.hobbies.join(", ") : ""}
                  />
                  <DetailRow label="Western Zodiac" value={profile.western_zodiac || ""} />
                  <DetailRow label="Aztec Zodiac" value={profile.aztec_zodiac || ""} />
                  <DetailRow label="Chinese Zodiac" value={profile.chinese_zodiac || ""} />
                  <DetailRow
                    label="Life Path"
                    value={profile.numerology_life_path ? String(profile.numerology_life_path) : ""}
                  />
                </>
              ) : (
                <Text style={styles.emptySectionText}>
                  This person has not filled out their About section yet.
                </Text>
              )}
            </View>

            {!lockedPreview && !!profile.hobbies?.length && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Interests</Text>

                <View style={styles.interestWrap}>
                  {profile.hobbies.map((hobby) => (
                    <SoftChip key={hobby}>{hobby}</SoftChip>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Public Photos</Text>

              {media.length === 0 ? (
                <View style={styles.noPhotos}>
                  <Text style={styles.noPhotosTitle}>No public photos yet</Text>
                  <Text style={styles.noPhotosText}>
                    This person has not added public gallery photos.
                  </Text>
                </View>
              ) : (
                <View style={styles.galleryGrid}>
                  {media.map((item) =>
                    item.media_url ? (
                      <Image
                        key={item.id}
                        source={{ uri: item.media_url }}
                        style={styles.galleryImage}
                        blurRadius={lockedPreview ? 24 : 0}
                        resizeMode="cover"
                      />
                    ) : null
                  )}
                </View>
              )}

              {lockedPreview ? (
                <Pressable onPress={openPremium} style={styles.unlockPhotosButton}>
                  <Text style={styles.unlockPhotosButtonText}>Unlock Full Gallery</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  content: {
    padding: 18,
    paddingBottom: 140,
  },

  backButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  backText: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 15,
  },

  loader: {
    marginTop: 50,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    padding: 18,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: BRAND.text,
  },

  emptyText: {
    marginTop: 8,
    color: BRAND.muted,
    lineHeight: 22,
  },

  lockedNotice: {
    backgroundColor: "#111111",
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
  },

  lockedNoticeTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },

  lockedNoticeText: {
    marginTop: 6,
    color: "#E9E9E9",
    fontWeight: "700",
    lineHeight: 21,
  },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    overflow: "hidden",
    marginBottom: 18,
  },

  cover: {
    height: 165,
    backgroundColor: "#F3F7FF",
    alignItems: "center",
    justifyContent: "center",
  },

  coverImage: {
    width: "100%",
    height: "100%",
  },

  coverLogo: {
    width: 150,
    height: 150,
    opacity: 0.08,
  },

  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.24)",
  },

  boostBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F59E0B",
  },

  boostBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },

  profileCenter: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 22,
  },

  avatarWrap: {
    marginTop: -62,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    padding: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  avatar: {
    width: 128,
    height: 128,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },

  avatarLockBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#111111",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarLockText: {
    fontSize: 15,
  },

  avatarFallback: {
    width: 128,
    height: 128,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarFallbackLogo: {
    width: 112,
    height: 112,
  },

  lockedLogo: {
    opacity: 0.35,
  },

  name: {
    marginTop: 12,
    fontSize: 30,
    fontWeight: "900",
    color: BRAND.text,
    textAlign: "center",
  },

  username: {
    marginTop: 4,
    color: BRAND.blue,
    fontWeight: "800",
  },

  location: {
    marginTop: 6,
    color: BRAND.muted,
    fontWeight: "700",
    textAlign: "center",
  },

  statsRow: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },

  statPill: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE5FF",
    backgroundColor: "#F8FBFF",
    paddingVertical: 12,
    alignItems: "center",
  },

  statNumber: {
    color: BRAND.text,
    fontSize: 18,
    fontWeight: "900",
  },

  statLabel: {
    marginTop: 3,
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },

  chip: {
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  chipText: {
    color: BRAND.text,
    fontWeight: "800",
    fontSize: 13,
  },

  relationship: {
    marginTop: 14,
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },

  spiritual: {
    marginTop: 8,
    color: "#666",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  bio: {
    marginTop: 14,
    color: "#555",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  bioMuted: {
    marginTop: 14,
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "700",
  },

  unlockButton: {
    marginTop: 16,
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  unlockButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  actionRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },

  messageAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },

  messageActionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },

  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryActionText: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 15,
  },

  moreAction: {
    width: 52,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },

  moreActionText: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 24,
    marginTop: -6,
  },

  actionDisabled: {
    opacity: 0.55,
  },

  followingAction: {
    backgroundColor: BRAND.pink,
    borderColor: BRAND.pink,
  },

  followingActionText: {
    color: "#FFFFFF",
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    padding: 16,
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: BRAND.text,
    marginBottom: 12,
  },

  compatibilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  softChip: {
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#DFE7FA",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  softChipText: {
    color: BRAND.text,
    fontWeight: "800",
    fontSize: 13,
  },

  emptySectionText: {
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },

  detailRow: {
    marginBottom: 14,
  },

  detailLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: BRAND.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  detailValue: {
    fontSize: 16,
    fontWeight: "700",
    color: BRAND.text,
    lineHeight: 22,
  },

  interestWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  noPhotos: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },

  noPhotosTitle: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 16,
  },

  noPhotosText: {
    color: BRAND.muted,
    marginTop: 6,
    lineHeight: 21,
  },

  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  galleryImage: {
    width: "48%",
    height: 190,
    borderRadius: 18,
    backgroundColor: "#000",
  },

  unlockPhotosButton: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },

  unlockPhotosButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secretAdmirerButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#FCE3F2",
    borderWidth: 1,
    borderColor: "#E63DA1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  secretAdmirerButtonText: {
    color: "#A90D67",
    fontSize: 15,
    fontWeight: "800",
  },

});