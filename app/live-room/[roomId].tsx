import { AudioSession, LiveKitRoom, useTracks, VideoTrack } from "../../lib/liveKitComponents";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Track } from "livekit-client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BRAND } from "../../lib/brand";
import { supabase } from "../../lib/supabase";

type LiveRoomRow = {
  id: string;
  host_id: string;
  title: string | null;
  topic: string | null;
  status: string | null;
  viewer_count: number | null;
  total_gifts?: number | null;
  total_diamonds?: number | null;
  created_at: string | null;
  ended_at: string | null;
};

type PermissionState = {
  cameraGranted: boolean;
  micGranted: boolean;
};

type LiveMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  user_id?: string | null;
  body: string;
  created_at: string;
};

type LiveGift = {
  id: string;
  name: string;
  emoji: string;
  coin_cost: number;
  diamond_value: number;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function RoomStage({
  title,
  topic,
  isHost,
  connected,
  onLeave,
  onEndLive,
  ending,
  messages,
  currentUserId,
  chatText,
  setChatText,
  onSendChat,
  sendingChat,
  gifts,
  onSendGift,
  onTip,
  onSubscribe,
}: {
  title: string;
  topic: string;
  isHost: boolean;
  connected: boolean;
  onLeave: () => void;
  onEndLive: () => void;
  ending: boolean;
  messages: LiveMessage[];
  currentUserId: string | null;
  chatText: string;
  setChatText: (value: string) => void;
  onSendChat: () => void;
  sendingChat: boolean;
  gifts: LiveGift[];
  onSendGift: (gift: LiveGift) => void;
  onTip: () => void;
  onSubscribe: () => void;
}) {
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const firstCameraTrack = cameraTracks?.[0] ?? null;
  const chatListRef = useRef<FlatList<LiveMessage>>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        chatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    }
  }, [messages.length]);

  return (
    <KeyboardAvoidingView
      style={styles.stageShell}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <View style={styles.videoWrap}>
        {firstCameraTrack ? (
          <VideoTrack
            trackRef={firstCameraTrack as any}
            style={styles.video}
            objectFit="cover"
          />
        ) : (
          <LinearGradient
            colors={["#0E0E12", "#1B1631", "#2E1248"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.videoFallback}
          >
            <Text style={styles.videoFallbackTop}>
              {connected
                ? isHost
                  ? "You are live"
                  : "Connected to live room"
                : isHost
                  ? "Starting camera and mic..."
                  : "Joining live room..."}
            </Text>

            <Text style={styles.videoFallbackTitle}>{title}</Text>
            <Text style={styles.videoFallbackText}>{topic}</Text>

            <Text style={styles.viewerWaitingText}>
              {connected
                ? isHost
                  ? "LiveKit host connection is active. Waiting for published camera track."
                  : "LiveKit viewer connection is active. Waiting for live video."
                : "Waiting for LiveKit connection..."}
            </Text>
          </LinearGradient>
        )}

        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>

        <View style={styles.stageOverlayBottom}>
          <Text style={styles.stageTitle}>{title}</Text>
          <Text style={styles.stageTopic}>{topic}</Text>
        </View>

        <View style={styles.chatOverlay}>
          <FlatList
            ref={chatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chatListContent}
            renderItem={({ item }) => {
              const mine =
                item.sender_id === currentUserId || item.user_id === currentUserId;

              return (
                <View
                  style={[
                    styles.chatBubble,
                    mine ? styles.chatBubbleMine : styles.chatBubbleTheirs,
                  ]}
                >
                  <Text style={styles.chatName}>{mine ? "You" : "Viewer"}</Text>
                  <Text style={styles.chatMessage}>{item.body}</Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyChatOverlay}>
                <Text style={styles.emptyChatOverlayText}>Live chat is open.</Text>
              </View>
            }
          />
        </View>
      </View>

      <View style={styles.bottomControls}>
        <View style={styles.giftTray}>
          {gifts.slice(0, 6).map((gift) => (
            <Pressable
              key={gift.id}
              onPress={() => onSendGift(gift)}
              style={styles.giftButton}
            >
              <Text style={styles.giftEmoji}>{gift.emoji}</Text>
              <Text style={styles.giftCost}>{gift.coin_cost}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.monetizationActions}>
          <Pressable onPress={onTip} style={styles.miniMoneyButton}>
            <Text style={styles.miniMoneyButtonText}>💸 Tip</Text>
          </Pressable>

          <Pressable onPress={onSubscribe} style={styles.miniMoneyButton}>
            <Text style={styles.miniMoneyButtonText}>⭐ Subscribe</Text>
          </Pressable>
        </View>

        <View style={styles.chatInputRow}>
          <TextInput
            value={chatText}
            onChangeText={setChatText}
            placeholder="Say something..."
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.chatInput}
            returnKeyType="send"
            onSubmitEditing={onSendChat}
          />

          <Pressable
            onPress={onSendChat}
            disabled={sendingChat || !chatText.trim()}
            style={[
              styles.chatSendButton,
              sendingChat || !chatText.trim()
                ? styles.chatSendButtonDisabled
                : null,
            ]}
          >
            <Text style={styles.chatSendButtonText}>
              {sendingChat ? "..." : "Send"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.stageActions}>
          <Pressable style={styles.leaveButton} onPress={onLeave}>
            <Text style={styles.leaveButtonText}>
              {isHost ? "Back to Browse" : "Leave Live"}
            </Text>
          </Pressable>

          {isHost ? (
            <Pressable
              style={styles.endButton}
              onPress={onEndLive}
              disabled={ending}
            >
              <Text style={styles.endButtonText}>
                {ending ? "Ending..." : "End Live"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function LiveRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ roomId: string }>();
  const roomId = Array.isArray(params.roomId) ? params.roomId[0] : params.roomId;

  const [booting, setBooting] = useState(true);
  const [ending, setEnding] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [roomRow, setRoomRow] = useState<LiveRoomRow | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connect, setConnect] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionState>({
    cameraGranted: Platform.OS === "ios",
    micGranted: Platform.OS === "ios",
  });

  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [gifts, setGifts] = useState<LiveGift[]>([]);
  const [chatText, setChatText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [moneyBusy, setMoneyBusy] = useState(false);

  const mountedRef = useRef(true);
  const viewerCountBumpedRef = useRef(false);
  const hostEndedRef = useRef(false);
  const navigatingAwayRef = useRef(false);

  const livekitUrl = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? "";

  const isHost = useMemo(() => {
    if (!userId || !roomRow?.host_id) return false;
    return roomRow.host_id === userId;
  }, [userId, roomRow?.host_id]);

  const roomTitle = useMemo(() => {
    return roomRow?.title?.trim() || "Untitled Live";
  }, [roomRow?.title]);

  const roomTopic = useMemo(() => {
    return roomRow?.topic?.trim() || "PolyOpen live stream";
  }, [roomRow?.topic]);

  const permissionError =
    errorText === "Camera and microphone permissions are required to host a live.";

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      handleLeave();
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);

    return () => sub.remove();
  });

  useEffect(() => {
    if (!roomId) {
      setBooting(false);
      setErrorText("Missing room id.");
      return;
    }

    bootstrap();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    const roomChannel = supabase
      .channel(`live-room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_rooms",
          filter: `id=eq.${roomId}`,
        },
        async () => {
          await loadRoomOnly();
        }
      )
      .subscribe();

    const messageChannel = supabase
      .channel(`live-room-messages-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          await loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !roomRow || !userId || isHost) return;
    if (viewerCountBumpedRef.current) return;
    if (roomRow.status !== "live") return;

    viewerCountBumpedRef.current = true;
    bumpViewerCount(1);

    return () => {
      if (viewerCountBumpedRef.current) {
        bumpViewerCount(-1);
        viewerCountBumpedRef.current = false;
      }
    };
  }, [roomId, roomRow, userId, isHost]);

  useEffect(() => {
    if (!isHost || !roomRow?.id || roomRow.status !== "live") return;

    const sub = AppState.addEventListener(
      "change",
      async (nextState: AppStateStatus) => {
        if (nextState === "inactive" || nextState === "background") {
          await endLiveSilently();
        }
      }
    );

    return () => {
      sub.remove();
    };
  }, [isHost, roomRow?.id, roomRow?.status]);

  useEffect(() => {
    return () => {
      if (isHost && roomRow?.id && roomRow.status === "live") {
        endLiveSilently();
      }
    };
  }, [isHost, roomRow?.id, roomRow?.status]);

  function forceBrowseRoute() {
    if (navigatingAwayRef.current) return;

    navigatingAwayRef.current = true;

    setConnect(false);
    setConnected(false);
    setToken(null);
    setErrorText(null);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          router.dismissAll();
        } catch (error) {
          console.log("dismiss all error", error);
        }

        router.replace("/browse" as any);
      });
    });
  }

  function goToBrowse() {
    forceBrowseRoute();
  }

  async function requestAndroidPermissions() {
    if (Platform.OS !== "android") {
      setPermissions({
        cameraGranted: true,
        micGranted: true,
      });
      setErrorText(null);
      return true;
    }

    try {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);

      const nextPermissions = {
        cameraGranted:
          results[PermissionsAndroid.PERMISSIONS.CAMERA] ===
          PermissionsAndroid.RESULTS.GRANTED,
        micGranted:
          results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
          PermissionsAndroid.RESULTS.GRANTED,
      };

      setPermissions(nextPermissions);

      if (!nextPermissions.cameraGranted || !nextPermissions.micGranted) {
        setErrorText("Camera and microphone permissions are required to host a live.");
        return false;
      }

      setErrorText(null);
      return true;
    } catch (error: any) {
      setErrorText(error?.message ?? "Permission request failed.");
      return false;
    }
  }

  async function retryOpenLive() {
    setBooting(true);
    setConnecting(false);
    setConnected(false);
    setConnect(false);
    setToken(null);
    setErrorText(null);
    navigatingAwayRef.current = false;
    await bootstrap();
  }

  async function loadRoomOnly() {
    if (!roomId) return;

    try {
      const { data, error } = await supabase
        .from("live_rooms")
        .select(
          "id, host_id, title, topic, status, viewer_count, total_gifts, total_diamonds, created_at, ended_at"
        )
        .eq("id", roomId)
        .maybeSingle();

      if (error) throw error;

      const row = (data as LiveRoomRow | null) ?? null;
      setRoomRow(row);

      if (row && row.status === "ended" && mountedRef.current) {
        goToBrowse();
      }
    } catch (error) {
      console.log("load room only error", error);
    }
  }

  async function loadMessages() {
    if (!roomId) return;

    const { data, error } = await supabase
      .from("live_room_messages")
      .select("id, room_id, sender_id, user_id, body, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(150);

    if (!error) {
      setMessages((data ?? []) as LiveMessage[]);
    }
  }

  async function loadGifts() {
    const { data, error } = await supabase
      .from("live_gifts")
      .select("id, name, emoji, coin_cost, diamond_value")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (!error) {
      setGifts((data ?? []) as LiveGift[]);
    }
  }

  async function bootstrap() {
    try {
      setBooting(true);
      setConnecting(true);
      setConnected(false);
      setErrorText(null);
      navigatingAwayRef.current = false;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const uid = user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        setErrorText("You must be logged in to open a live room.");
        return;
      }

      const { data: roomData, error: roomError } = await supabase
        .from("live_rooms")
        .select(
          "id, host_id, title, topic, status, viewer_count, total_gifts, total_diamonds, created_at, ended_at"
        )
        .eq("id", roomId)
        .maybeSingle();

      if (roomError) throw roomError;

      const row = (roomData as LiveRoomRow | null) ?? null;
      setRoomRow(row);

      if (!row) {
        setErrorText("This live room could not be found.");
        return;
      }

      if (row.status !== "live") {
        setErrorText("This live room has ended.");
        return;
      }

      await Promise.all([loadMessages(), loadGifts()]);

      const amHost = row.host_id === uid;

      if (amHost) {
        const granted = await requestAndroidPermissions();
        if (!granted) return;
      }

      if (!livekitUrl) {
        setErrorText("Missing EXPO_PUBLIC_LIVEKIT_URL in your app env.");
        return;
      }

      const { data: tokenData, error: tokenError } =
        await supabase.functions.invoke("livekit-token", {
          body: {
            roomId: row.id,
            title: row.title ?? "Untitled Live",
            topic: row.topic ?? "PolyOpen live stream",
          },
        });

      if (tokenError) throw tokenError;

      const nextToken =
        tokenData?.token || tokenData?.accessToken || tokenData?.jwt || null;

      if (!nextToken) {
        setErrorText("No token was returned by livekit-token.");
        return;
      }

      try {
        await AudioSession.startAudioSession();
      } catch (audioError) {
        console.log("audio session start error", audioError);
      }

      setToken(nextToken);
      setConnect(true);
    } catch (error: any) {
      console.log("live room bootstrap error", error);
      setErrorText(error?.message ?? "Could not open the live room.");
    } finally {
      if (mountedRef.current) {
        setBooting(false);
        setConnecting(false);
      }
    }
  }

  async function bumpViewerCount(delta: number) {
    try {
      const current = roomRow?.viewer_count ?? 0;
      const next = Math.max(0, current + delta);

      await supabase
        .from("live_rooms")
        .update({ viewer_count: next })
        .eq("id", roomId);
    } catch (error) {
      console.log("viewer count update error", error);
    }
  }

  async function endLiveSilently() {
    if (!roomRow?.id) return;
    if (hostEndedRef.current) return;

    hostEndedRef.current = true;

    try {
      await supabase
        .from("live_rooms")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          viewer_count: 0,
        })
        .eq("id", roomRow.id);
    } catch (error) {
      console.log("silent end live error", error);
    }
  }

  async function handleLeave() {
    if (isHost && roomRow?.status === "live") {
      await endLiveSilently();
    }

    goToBrowse();
  }

  async function handleEndLive() {
    if (!roomRow?.id || ending) return;

    try {
      setEnding(true);
      hostEndedRef.current = true;

      const { error } = await supabase
        .from("live_rooms")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          viewer_count: 0,
        })
        .eq("id", roomRow.id);

      if (error) throw error;

      goToBrowse();
    } catch (error: any) {
      hostEndedRef.current = false;
      Alert.alert("Could not end live", error?.message ?? "Please try again.");
    } finally {
      setEnding(false);
    }
  }

  async function sendChatMessage() {
    if (!roomId || !userId || sendingChat) return;

    const body = chatText.trim();
    if (!body) return;

    try {
      setSendingChat(true);

      const { error } = await supabase.from("live_room_messages").insert({
        room_id: roomId,
        sender_id: userId,
        user_id: userId,
        body,
      });

      if (error) throw error;

      setChatText("");
      await loadMessages();
    } catch (error: any) {
      Alert.alert("Chat Error", error?.message ?? "Could not send message.");
    } finally {
      setSendingChat(false);
    }
  }

  async function sendGift(gift: LiveGift) {
    if (!userId || !roomRow?.id || moneyBusy) return;

    if (userId === roomRow.host_id) {
      Alert.alert("Creator Account", "You cannot send gifts to your own live room.");
      return;
    }

    try {
      setMoneyBusy(true);

      const { error } = await supabase.rpc("send_gift", {
        p_room_id: roomRow.id,
        p_gift_id: gift.id,
      });

      if (error) throw error;

      await Promise.all([loadRoomOnly(), loadMessages()]);
      Alert.alert("Gift Sent", `${gift.emoji} ${gift.name} sent.`);
    } catch (error: any) {
      Alert.alert("Gift Error", error?.message ?? "Could not send gift.");
    } finally {
      setMoneyBusy(false);
    }
  }

  async function sendTip() {
    if (!userId || !roomRow?.id || moneyBusy) return;

    if (userId === roomRow.host_id) {
      Alert.alert("Creator Account", "You cannot tip your own live.");
      return;
    }

    try {
      setMoneyBusy(true);

      const { error } = await supabase.rpc("send_live_tip", {
        p_room_id: roomRow.id,
        p_coin_amount: 100,
        p_diamond_amount: 50,
        p_cash_amount_cents: 100,
      });

      if (error) throw error;

      await Promise.all([loadRoomOnly(), loadMessages()]);
      Alert.alert("Tip Sent", "Your support was recorded.");
    } catch (error: any) {
      Alert.alert("Tip Error", error?.message ?? "Could not send tip.");
    } finally {
      setMoneyBusy(false);
    }
  }

  async function subscribeToCreator() {
    if (!userId || !roomRow?.id || moneyBusy) return;

    if (userId === roomRow.host_id) {
      Alert.alert("Creator Account", "You cannot subscribe to yourself.");
      return;
    }

    try {
      setMoneyBusy(true);

      const { error } = await supabase.rpc("subscribe_to_creator_from_live", {
        p_room_id: roomRow.id,
      });

      if (error) throw error;

      await loadMessages();
      Alert.alert("Subscribed", "You are now subscribed.");
    } catch (error: any) {
      Alert.alert("Subscription Error", error?.message ?? "Could not subscribe.");
    } finally {
      setMoneyBusy(false);
    }
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={BRAND.pink} />
          <Text style={styles.loadingTitle}>Opening live room...</Text>
          <Text style={styles.loadingText}>Getting your room ready.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (permissionError && roomRow) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={handleLeave} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Camera and mic needed</Text>
          <Text style={styles.permissionText}>
            To host your live, allow camera and microphone access for PolyOpen.
            After allowing, tap Try Again.
          </Text>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Room title</Text>
            <Text style={styles.statusValue}>{roomTitle}</Text>

            <Text style={styles.statusLabel}>Started</Text>
            <Text style={styles.statusValue}>{formatDate(roomRow.created_at)}</Text>
          </View>

          <Pressable style={styles.primaryAction} onPress={retryOpenLive}>
            <Text style={styles.primaryActionText}>Try Again</Text>
          </Pressable>

          <Pressable style={styles.secondaryAction} onPress={handleLeave}>
            <Text style={styles.secondaryActionText}>Back to Browse</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!roomRow || roomRow.status !== "live" || errorText) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={handleLeave} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>
            {roomRow?.status === "ended" ? "This live has ended" : "Could not open live"}
          </Text>

          <Text style={styles.errorText}>
            {errorText ||
              "This room is not active right now. Go back to Browse and try another room."}
          </Text>

          {roomRow ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>Room title</Text>
              <Text style={styles.statusValue}>{roomTitle}</Text>

              <Text style={styles.statusLabel}>Started</Text>
              <Text style={styles.statusValue}>{formatDate(roomRow.created_at)}</Text>

              {roomRow.ended_at ? (
                <>
                  <Text style={styles.statusLabel}>Ended</Text>
                  <Text style={styles.statusValue}>{formatDate(roomRow.ended_at)}</Text>
                </>
              ) : null}
            </View>
          ) : null}

          <Pressable style={styles.primaryAction} onPress={handleLeave}>
            <Text style={styles.primaryActionText}>Back to Browse</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const hostNeedsPermissions =
    isHost && (!permissions.cameraGranted || !permissions.micGranted);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={handleLeave} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.topBarRight}>
          <Text style={styles.viewerPill}>
            {roomRow.viewer_count ?? 0} watching
          </Text>

          <Text style={styles.viewerPill}>
            {roomRow.total_diamonds ?? 0} diamonds
          </Text>
        </View>
      </View>

      {hostNeedsPermissions ? (
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Camera and mic needed</Text>
          <Text style={styles.permissionText}>
            To host your live, allow camera and microphone access on this device.
          </Text>

          <Pressable style={styles.primaryAction} onPress={retryOpenLive}>
            <Text style={styles.primaryActionText}>Try Again</Text>
          </Pressable>

          <Pressable style={styles.secondaryAction} onPress={handleLeave}>
            <Text style={styles.secondaryActionText}>Back to Browse</Text>
          </Pressable>
        </View>
      ) : token && connect ? (
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={token}
          connect={connect}
          audio={isHost ? permissions.micGranted : false}
          video={isHost ? permissions.cameraGranted : false}
          onConnected={() => {
            setConnected(true);
            setConnecting(false);
          }}
          onDisconnected={() => {
            setConnected(false);
            setConnect(false);
            setToken(null);

            if (isHost && roomRow?.status === "live") {
              endLiveSilently();
            }

            forceBrowseRoute();
          }}
          onError={(error: any) => {
            console.log("livekit room error", error);
            setConnected(false);
            setConnect(false);
            setToken(null);

            if (isHost && roomRow?.status === "live") {
              endLiveSilently();
            }

            forceBrowseRoute();
          }}
        >
          <RoomStage
            title={roomTitle}
            topic={roomTopic}
            isHost={isHost}
            connected={connected}
            onLeave={handleLeave}
            onEndLive={handleEndLive}
            ending={ending}
            messages={messages}
            currentUserId={userId}
            chatText={chatText}
            setChatText={setChatText}
            onSendChat={sendChatMessage}
            sendingChat={sendingChat}
            gifts={gifts}
            onSendGift={sendGift}
            onTip={sendTip}
            onSubscribe={subscribeToCreator}
          />
        </LiveKitRoom>
      ) : (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={BRAND.pink} />
          <Text style={styles.loadingTitle}>
            {connecting ? "Connecting to live..." : "Preparing stream..."}
          </Text>
          <Text style={styles.loadingText}>
            {isHost
              ? "Opening your host tools and camera."
              : "Joining the live room now."}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050507",
  },

  topBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#050507",
  },

  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  backButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },

  viewerPill: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },

  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },

  loadingTitle: {
    marginTop: 18,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },

  loadingText: {
    marginTop: 10,
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  stageShell: {
    flex: 1,
  },

  videoWrap: {
    flex: 1,
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#111111",
    minHeight: 260,
  },

  video: {
    width: "100%",
    height: "100%",
  },

  videoFallback: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "flex-end",
    padding: 22,
  },

  videoFallbackTop: {
    color: "#FF93DD",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  videoFallbackTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 28,
  },

  videoFallbackText: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: "600",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },

  viewerWaitingText: {
    color: "rgba(255,255,255,0.62)",
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },

  liveBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "#FF2E6D",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  liveBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.7,
  },

  stageOverlayBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 18,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  stageTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },

  stageTopic: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    fontWeight: "600",
  },

  chatOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 92,
    maxHeight: 190,
  },

  chatListContent: {
    paddingTop: 30,
  },

  emptyChatOverlay: {
    alignSelf: "flex-start",
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.32)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  emptyChatOverlayText: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: "800",
    fontSize: 12,
  },

  chatBubble: {
    alignSelf: "flex-start",
    maxWidth: "86%",
    marginBottom: 7,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  chatBubbleMine: {
    backgroundColor: "rgba(255,79,203,0.72)",
  },

  chatBubbleTheirs: {
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  chatName: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
    opacity: 0.8,
  },

  chatMessage: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 2,
  },

  bottomControls: {
    backgroundColor: "#050507",
  },

  giftTray: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    flexDirection: "row",
    gap: 8,
  },

  giftButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#15151A",
    borderWidth: 1,
    borderColor: "#30303A",
    alignItems: "center",
    justifyContent: "center",
  },

  giftEmoji: {
    fontSize: 22,
  },

  giftCost: {
    color: "#FF93DD",
    fontWeight: "900",
    fontSize: 11,
    marginTop: 1,
  },

  monetizationActions: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    flexDirection: "row",
    gap: 10,
  },

  miniMoneyButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#1A1A1E",
    borderWidth: 1,
    borderColor: "#30303A",
    alignItems: "center",
    justifyContent: "center",
  },

  miniMoneyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },

  chatInputRow: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    gap: 10,
  },

  chatInput: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "#30303A",
    paddingHorizontal: 14,
    color: "#FFFFFF",
    fontWeight: "700",
  },

  chatSendButton: {
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  chatSendButtonDisabled: {
    opacity: 0.5,
  },

  chatSendButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  stageActions: {
    paddingHorizontal: 14,
    paddingBottom: 18,
    flexDirection: "row",
    gap: 10,
  },

  leaveButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#1A1A1E",
    borderWidth: 1,
    borderColor: "#30303A",
    alignItems: "center",
    justifyContent: "center",
  },

  leaveButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  endButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#FF4569",
    alignItems: "center",
    justifyContent: "center",
  },

  endButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  permissionCard: {
    margin: 18,
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "#2A2A30",
    borderRadius: 28,
    padding: 20,
  },

  permissionTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },

  permissionText: {
    marginTop: 10,
    color: "rgba(255,255,255,0.75)",
    fontSize: 15,
    lineHeight: 22,
  },

  primaryAction: {
    marginTop: 20,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  primaryActionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  secondaryAction: {
    marginTop: 10,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#1A1A1E",
    borderWidth: 1,
    borderColor: "#30303A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  secondaryActionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  errorCard: {
    margin: 18,
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "#2A2A30",
    borderRadius: 28,
    padding: 20,
  },

  errorTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },

  errorText: {
    marginTop: 10,
    color: "rgba(255,255,255,0.75)",
    fontSize: 15,
    lineHeight: 22,
  },

  statusBox: {
    marginTop: 18,
    backgroundColor: "#18181C",
    borderWidth: 1,
    borderColor: "#2A2A30",
    borderRadius: 20,
    padding: 14,
  },

  statusLabel: {
    color: "#FF93DD",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    marginTop: 8,
  },

  statusValue: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
    marginTop: 4,
  },
});