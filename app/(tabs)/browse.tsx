import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { BRAND } from "../../lib/brand";
import { supabase } from "../../lib/supabase";

type Visibility = "public" | "followers" | "connections";

type HostProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
};

type LiveRoom = {
  id: string;
  title: string | null;
  topic: string | null;
  viewer_count: number | null;
  host_id: string;
  created_at: string;
  status?: string | null;
  ended_at?: string | null;
  host?: HostProfile | null;
};

function VisibilityChip({
  label,
  selected,
  onPress,
}: {
  label: Visibility;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      {selected ? (
        <LinearGradient
          colors={[BRAND.pink, BRAND.magenta, BRAND.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.visibilitySelected}
        >
          <Text style={styles.visibilitySelectedText}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.visibilityChip}>
          <Text style={styles.visibilityChipText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function SponsorCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.sponsorCard}>
      <View style={styles.sponsorTopRow}>
        <Image
          source={require("../../assets/images/polyopen-logo.png")}
          style={styles.sponsorLogo}
          resizeMode="contain"
        />

        <View style={{ flex: 1 }}>
          <Text style={styles.sponsorLabel}>Sponsored</Text>
          <Text style={styles.sponsorTitle}>Sponsor Live & Browse</Text>
        </View>
      </View>

      <Text style={styles.sponsorText}>
        Promote a retreat, event, podcast, community, brand, or creator project
        where PolyOpen members discover live rooms.
      </Text>

      <View style={styles.sponsorButton}>
        <Text style={styles.sponsorButtonText}>Advertise on PolyOpen</Text>
      </View>
    </Pressable>
  );
}

function isFreshEnough(room: LiveRoom) {
  if (room.status !== "live") return false;
  if (!room.created_at) return false;

  const created = new Date(room.created_at).getTime();
  if (Number.isNaN(created)) return false;

  return Date.now() - created <= 1000 * 60 * 60 * 8;
}

function hasNoAdsAccess(profile?: any) {
  return Boolean(profile?.no_ads || profile?.premium_bundle || profile?.is_premium);
}

function getHostName(room: LiveRoom) {
  return (
    room.host?.display_name?.trim() ||
    room.host?.username?.trim() ||
    "PolyOpen Creator"
  );
}

function getHostHandle(room: LiveRoom) {
  const username = room.host?.username?.trim();
  return username ? `@${username}` : "Live now";
}

function getLiveImage(room: LiveRoom) {
  return (
    room.host?.profile_photo_url ||
    room.host?.avatar_url ||
    room.host?.cover_photo_url ||
    null
  );
}

function LiveTile({
  room,
  onPress,
  tileWidth,
  tileHeight,
}: {
  room: LiveRoom;
  onPress: () => void;
  tileWidth: `${number}%`;
  tileHeight: number;
}) {
  const imageUrl = getLiveImage(room);

  return (
    <Pressable
      style={[
        styles.liveTile,
        {
          width: tileWidth,
          height: tileHeight,
        },
      ]}
      onPress={onPress}
    >
      {imageUrl ? (
        <ImageBackground
          source={{ uri: imageUrl }}
          style={styles.liveTileImage}
          imageStyle={styles.liveTileImageRadius}
          resizeMode="cover"
        >
          <LinearGradient
            colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.72)"]}
            style={styles.liveTileOverlay}
          >
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>

            <View style={styles.liveTileBottom}>
              <Text numberOfLines={1} style={styles.liveTitle}>
                {room.title?.trim() || "Untitled Live"}
              </Text>
              <Text numberOfLines={1} style={styles.liveHost}>
                {getHostName(room)}
              </Text>
              <View style={styles.liveMetaPill}>
                <Text style={styles.liveMetaText}>
                  {room.viewer_count ?? 0} watching
                </Text>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={["#FFF4FA", "#F7E8FF", "#EAF7FF"]}
          style={styles.liveTileImage}
        >
          <View style={styles.fallbackLogoWrap}>
            <Image
              source={require("../../assets/images/polyopen-logo.png")}
              style={styles.fallbackLogo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>

          <View style={styles.liveTileBottom}>
            <Text numberOfLines={1} style={[styles.liveTitle, styles.darkLiveTitle]}>
              {room.title?.trim() || "Untitled Live"}
            </Text>
            <Text numberOfLines={1} style={[styles.liveHost, styles.darkLiveHost]}>
              {getHostName(room)}
            </Text>
            <View style={styles.liveMetaPillLight}>
              <Text style={styles.liveMetaTextLight}>
                {room.viewer_count ?? 0} watching
              </Text>
            </View>
          </View>
        </LinearGradient>
      )}
    </Pressable>
  );
}

export default function BrowseScreen() {
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();
  const channelNameRef = useRef(`browse-live-rooms-${Date.now()}`);

  const isDesktopWeb = viewportWidth >= 1024;
  const isWideDesktopWeb = viewportWidth >= 1440;

  const liveTileWidth: `${number}%` = isWideDesktopWeb
    ? "23.5%"
    : isDesktopWeb
      ? "32%"
      : "48%";

  const liveTileHeight = isWideDesktopWeb
    ? 286
    : isDesktopWeb
      ? 264
      : 232;

  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [noAdsActive, setNoAdsActive] = useState(false);
  const [myLiveRoom, setMyLiveRoom] = useState<LiveRoom | null>(null);

  const [hostModalVisible, setHostModalVisible] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [allowGuests, setAllowGuests] = useState(true);

  const isLive = useMemo(() => myLiveRoom?.status === "live", [myLiveRoom]);

  const canStart = useMemo(() => {
    return !!userId && title.trim().length > 0 && !starting;
  }, [userId, title, starting]);

  const loadRooms = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const uid = user?.id ?? null;
      setUserId(uid);

      const liveRoomsPromise = supabase
        .from("live_rooms")
        .select("id, title, topic, viewer_count, host_id, created_at, status, ended_at")
        .eq("status", "live")
        .order("created_at", { ascending: false });

      const myRoomPromise = uid
        ? supabase
            .from("live_rooms")
            .select("id, title, topic, viewer_count, host_id, created_at, status, ended_at")
            .eq("host_id", uid)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any);

      const myProfilePromise = uid
        ? supabase
            .from("profiles")
            .select("no_ads, premium_bundle, is_premium")
            .eq("id", uid)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any);

      const [roomsRes, myRoomRes, myProfileRes] = await Promise.all([
        liveRoomsPromise,
        myRoomPromise,
        myProfilePromise,
      ]);

      if (roomsRes.error) throw roomsRes.error;
      if (myRoomRes?.error) throw myRoomRes.error;
      if (myProfileRes?.error) throw myProfileRes.error;

      setNoAdsActive(hasNoAdsAccess(myProfileRes?.data));

      const rawRooms = ((roomsRes.data ?? []) as LiveRoom[]).filter(
        (room) => room.id && room.host_id && isFreshEnough(room)
      );

      const hostIds = Array.from(new Set(rawRooms.map((room) => room.host_id)));

      let hostMap = new Map<string, HostProfile>();

      if (hostIds.length > 0) {
        const { data: hostProfiles, error: hostProfilesError } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, profile_photo_url, cover_photo_url")
          .in("id", hostIds);

        if (hostProfilesError) throw hostProfilesError;

        hostMap = new Map(
          ((hostProfiles ?? []) as HostProfile[]).map((profile) => [
            profile.id,
            profile,
          ])
        );
      }

      const hydratedRooms = rawRooms.map((room) => ({
        ...room,
        host: hostMap.get(room.host_id) ?? null,
      }));

      setRooms(hydratedRooms);

      const mine = (myRoomRes?.data as LiveRoom | null) ?? null;
      setMyLiveRoom(mine?.status === "live" ? mine : null);

      if (mine?.status === "live") {
        setTitle(mine.title ?? "");
        setTopic(mine.topic ?? "");
      }
    } catch (err) {
      console.log("browse load error", err);
      setRooms([]);
      setMyLiveRoom(null);
      setNoAdsActive(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();

    const existingChannels = supabase
      .getChannels()
      .filter((channel) => channel.topic.includes("browse-live-rooms"));

    existingChannels.forEach((channel) => {
      supabase.removeChannel(channel);
    });

    const channel = supabase.channel(channelNameRef.current);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "live_rooms",
      },
      () => {
        loadRooms();
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRooms]);

  async function handleStartLive() {
    if (!canStart || !userId) {
      Alert.alert("Missing title", "Give your live a title first.");
      return;
    }

    try {
      setStarting(true);

      if (myLiveRoom?.id) {
        const { data, error } = await supabase
          .from("live_rooms")
          .update({
            title: title.trim(),
            topic: topic.trim() || null,
            status: "live",
            ended_at: null,
            viewer_count: 0,
            created_at: new Date().toISOString(),
          })
          .eq("id", myLiveRoom.id)
          .select("id, title, topic, viewer_count, host_id, created_at, status, ended_at")
          .single();

        if (error) throw error;

        setMyLiveRoom(data as LiveRoom);
        setHostModalVisible(false);

        router.push({
          pathname: "/live-room/[roomId]",
          params: { roomId: (data as LiveRoom).id },
        } as any);
      } else {
        const { data, error } = await supabase
          .from("live_rooms")
          .insert({
            host_id: userId,
            title: title.trim(),
            topic: topic.trim() || null,
            status: "live",
            viewer_count: 0,
          })
          .select("id, title, topic, viewer_count, host_id, created_at, status, ended_at")
          .single();

        if (error) throw error;

        setMyLiveRoom(data as LiveRoom);
        setHostModalVisible(false);

        router.push({
          pathname: "/live-room/[roomId]",
          params: { roomId: (data as LiveRoom).id },
        } as any);
      }

      await loadRooms();
    } catch (error: any) {
      Alert.alert("Could not start live", error?.message ?? "Please try again.");
    } finally {
      setStarting(false);
    }
  }

  async function handleEndLive() {
    if (!myLiveRoom?.id) return;

    try {
      setEnding(true);

      const roomId = myLiveRoom.id;

      const { error } = await supabase
        .from("live_rooms")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          viewer_count: 0,
        })
        .eq("id", roomId);

      if (error) throw error;

      setMyLiveRoom(null);
      setRooms((prev) => prev.filter((room) => room.id !== roomId));

      Alert.alert("Live ended", "Your stream has been closed.");
      loadRooms();
    } catch (error: any) {
      Alert.alert("Could not end live", error?.message ?? "Please try again.");
    } finally {
      setEnding(false);
    }
  }

  function openStartLive() {
    if (myLiveRoom) {
      setTitle(myLiveRoom.title ?? "");
      setTopic(myLiveRoom.topic ?? "");
    } else {
      setTitle("");
      setTopic("");
    }

    setHostModalVisible(true);
  }

  function openAdvertise() {
    router.push("/premium" as any);
  }

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.logoLayer}>
        <Image
          source={require("../../assets/images/polyopen-logo.png")}
          style={styles.bgLogo}
          resizeMode="contain"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadRooms();
            }}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Browse</Text>
            <Text style={styles.subtitle}>Live rooms happening now</Text>
          </View>

          <Pressable style={styles.startLiveButton} onPress={openStartLive}>
            <Text style={styles.startLiveButtonText}>
              {isLive ? "Edit Live" : "Start Live"}
            </Text>
          </Pressable>
        </View>

        {noAdsActive ? (
          <View style={styles.noAdsNotice}>
            <Text style={styles.noAdsNoticeText}>No Ads active</Text>
          </View>
        ) : null}

        {!noAdsActive ? <SponsorCard onPress={openAdvertise} /> : null}

        {isLive && myLiveRoom ? (
          <View style={styles.myLiveCard}>
            <Text style={styles.myLiveLabel}>YOU ARE LIVE</Text>
            <Text style={styles.myLiveTitle}>
              {myLiveRoom.title?.trim() || "Untitled Live"}
            </Text>
            <Text style={styles.myLiveTopic}>
              {myLiveRoom.topic?.trim() || "PolyOpen live stream"}
            </Text>
            <Text style={styles.myLiveMeta}>
              {myLiveRoom.viewer_count ?? 0} viewers
            </Text>

            <View style={styles.myLiveActions}>
              <Pressable
                style={styles.openRoomButton}
                onPress={() =>
                  router.push({
                    pathname: "/live-room/[roomId]",
                    params: { roomId: myLiveRoom.id },
                  } as any)
                }
              >
                <Text style={styles.openRoomButtonText}>Open Room</Text>
              </Pressable>

              <Pressable
                style={styles.endLiveButton}
                onPress={handleEndLive}
                disabled={ending}
              >
                <Text style={styles.endLiveButtonText}>
                  {ending ? "Ending..." : "End Live"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator style={styles.loader} />
        ) : rooms.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Live Now</Text>
                <Text style={styles.sectionSub}>
                  Tap a creator to join their room
                </Text>
              </View>

              <Text style={styles.sectionMeta}>{rooms.length}</Text>
            </View>

            <View style={styles.liveGrid}>
              {rooms.map((room) => (
                <LiveTile
                  key={room.id}
                  room={room}
                  tileWidth={liveTileWidth}
                  tileHeight={liveTileHeight}
                  onPress={() =>
                    router.push({
                      pathname: "/live-room/[roomId]",
                      params: { roomId: room.id },
                    } as any)
                  }
                />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No live rooms right now</Text>
            <Text style={styles.emptyText}>
              Start a live room or check back when someone goes live.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={hostModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHostModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              isDesktopWeb && styles.modalSheetDesktop,
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>
                {isLive ? "Update Live" : "Start Live"}
              </Text>

              <Text style={styles.label}>Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Late night vibes, tarot room, numerology chat..."
                placeholderTextColor="#A79AA2"
                style={styles.input}
              />

              <Text style={styles.label}>Topic</Text>
              <TextInput
                value={topic}
                onChangeText={setTopic}
                placeholder="What is this live about?"
                placeholderTextColor="#A79AA2"
                style={styles.input}
              />

              <Text style={styles.label}>Visibility</Text>
              <View style={styles.visibilityRow}>
                <VisibilityChip
                  label="public"
                  selected={visibility === "public"}
                  onPress={() => setVisibility("public")}
                />
                <VisibilityChip
                  label="followers"
                  selected={visibility === "followers"}
                  onPress={() => setVisibility("followers")}
                />
                <VisibilityChip
                  label="connections"
                  selected={visibility === "connections"}
                  onPress={() => setVisibility("connections")}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Allow guests on stage</Text>
                  <Text style={styles.toggleSub}>
                    Let viewers join your room and speak live later in the build.
                  </Text>
                </View>
                <Switch value={allowGuests} onValueChange={setAllowGuests} />
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setHostModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.confirmButton,
                    !canStart ? styles.confirmButtonDisabled : null,
                  ]}
                  onPress={handleStartLive}
                  disabled={!canStart}
                >
                  <Text style={styles.confirmButtonText}>
                    {starting ? "Starting..." : isLive ? "Save & Go Live" : "Go Live"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  logoLayer: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  bgLogo: {
    width: 260,
    height: 260,
    opacity: 0.05,
  },

  content: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 120,
    minHeight: "100%",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    color: BRAND.text,
  },

  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: BRAND.muted,
  },

  startLiveButton: {
    minHeight: 54,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  startLiveButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  noAdsNotice: {
    backgroundColor: "#EEF9F1",
    borderWidth: 1.5,
    borderColor: "#B7E4C7",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },

  noAdsNoticeText: {
    color: "#1B7F46",
    fontWeight: "900",
    fontSize: 13,
  },

  sponsorCard: {
    borderRadius: 28,
    padding: 18,
    marginBottom: 18,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
  },

  sponsorTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  sponsorLogo: {
    width: 54,
    height: 54,
    marginRight: 12,
  },

  sponsorLabel: {
    color: BRAND.blue,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  sponsorTitle: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "900",
    color: BRAND.text,
  },

  sponsorText: {
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 22,
    fontSize: 14,
  },

  sponsorButton: {
    marginTop: 14,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: BRAND.blue,
  },

  sponsorButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  myLiveCard: {
    borderRadius: 28,
    padding: 18,
    marginBottom: 18,
    backgroundColor: "#FFF6FB",
    borderWidth: 1.5,
    borderColor: "#F0D6E7",
  },

  myLiveLabel: {
    color: BRAND.magenta,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  myLiveTitle: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "900",
    color: BRAND.text,
  },

  myLiveTopic: {
    marginTop: 8,
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 22,
  },

  myLiveMeta: {
    marginTop: 10,
    color: BRAND.text,
    fontSize: 14,
    fontWeight: "700",
  },

  myLiveActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  openRoomButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },

  openRoomButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },

  endLiveButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#F43F5E",
    alignItems: "center",
    justifyContent: "center",
  },

  endLiveButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },

  loader: {
    marginTop: 40,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: BRAND.text,
  },

  sectionSub: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "700",
    color: BRAND.muted,
  },

  sectionMeta: {
    width: 38,
    height: 38,
    borderRadius: 19,
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 38,
    overflow: "hidden",
    backgroundColor: "#FCEAF4",
    color: BRAND.magenta,
    fontWeight: "900",
    fontSize: 16,
  },

  liveGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },

  liveTile: {
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#F7F7F7",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EFE1EA",
  },

  liveTileImage: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
  },

  liveTileImageRadius: {
    borderRadius: 28,
  },

  liveTileOverlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 10,
  },

  liveBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F43F5E",
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },

  liveBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  liveTileBottom: {
    width: "100%",
  },

  liveTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  liveHost: {
    marginTop: 2,
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "800",
  },

  liveMetaPill: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  liveMetaText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  liveMetaPillLight: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },

  liveMetaTextLight: {
    color: BRAND.text,
    fontSize: 12,
    fontWeight: "900",
  },

  darkLiveTitle: {
    color: BRAND.text,
  },

  darkLiveHost: {
    color: BRAND.muted,
  },

  fallbackLogoWrap: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  fallbackLogo: {
    width: 90,
    height: 90,
    opacity: 0.9,
  },

  emptyCard: {
    marginTop: 40,
    alignItems: "center",
    paddingHorizontal: 20,
  },

  emptyTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: BRAND.text,
    textAlign: "center",
  },

  emptyText: {
    marginTop: 10,
    color: BRAND.muted,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "flex-end",
  },

  modalSheetDesktop: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "88%",
    alignSelf: "center",
    borderRadius: 30,
  },

  modalSheet: {
    maxHeight: "82%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#F0D6E7",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
  },

  modalScrollContent: {
    paddingBottom: 10,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: BRAND.text,
    marginBottom: 8,
  },

  label: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "800",
    color: BRAND.text,
  },

  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    fontSize: 16,
    color: BRAND.text,
  },

  visibilityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
  },

  visibilityChip: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    backgroundColor: "#F8FBFF",
    justifyContent: "center",
  },

  visibilitySelected: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 999,
    justifyContent: "center",
  },

  visibilityChipText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2045A6",
  },

  visibilitySelectedText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 18,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#FFF7FB",
    borderWidth: 1,
    borderColor: "#F1DCE8",
  },

  toggleTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: BRAND.text,
  },

  toggleSub: {
    fontSize: 13,
    color: BRAND.muted,
    marginTop: 4,
    fontWeight: "600",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },

  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#F4F7FF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    color: "#2045A6",
    fontWeight: "900",
    fontSize: 15,
  },

  confirmButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  confirmButtonDisabled: {
    opacity: 0.5,
  },

  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
});