import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth";
import { getBlockedUserIds } from "../../lib/block";
import { BRAND } from "../../lib/brand";
import {
  createMessageNotification,
  getProfileDisplayName,
} from "../../lib/notifications";
import { supabase } from "../../lib/supabase";

type MatchRow = {
  id: string;
  user1_id: string;
  user2_id: string;
};

type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string | null;
  type?: string | null;
  created_at: string;
  read_by?: any;
};

type OtherProfile = {
  id: string;
  display_name: string | null;
  username?: string | null;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
  boost_active?: boolean | null;
  boost_expires_at?: string | null;
};

const POLYOPEN_LOGO = require("../../assets/images/polyopen-logo.png");

function formatMessageTime(value: string) {
  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMessageDate(value: string) {
  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getReadByIds(readBy: any): string[] {
  if (!readBy) return [];

  if (Array.isArray(readBy)) {
    return readBy.filter((id) => typeof id === "string");
  }

  if (typeof readBy === "object") {
    return Object.keys(readBy).filter((key) => !!readBy[key]);
  }

  return [];
}

function isBoostActive(profile?: OtherProfile | null) {
  if (!profile?.boost_active || !profile?.boost_expires_at) {
    return false;
  }

  const expires = new Date(profile.boost_expires_at).getTime();

  return !Number.isNaN(expires) && expires > Date.now();
}

function DefaultAvatar({ size }: { size: number }) {
  return (
    <View
      style={[
        styles.defaultAvatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Image
        source={POLYOPEN_LOGO}
        style={{
          width: size * 0.82,
          height: size * 0.82,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const flatListRef = useRef<FlatList<MessageRow>>(null);

  const { matchId } = useLocalSearchParams<{
    matchId: string;
  }>();

  const { userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [otherUserId, setOtherUserId] = useState<string | null>(null);

  const [otherProfile, setOtherProfile] = useState<OtherProfile | null>(null);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");

  const title = useMemo(() => {
    return otherProfile?.display_name || otherProfile?.username || "Chat";
  }, [otherProfile]);

  const otherImage =
    otherProfile?.profile_photo_url || otherProfile?.avatar_url || null;

  async function markMessagesRead(rows: MessageRow[]) {
    if (!userId || !matchId) return;

    const unreadRows = rows.filter((row) => {
      if (row.sender_id === userId) return false;

      return !getReadByIds(row.read_by).includes(userId);
    });

    await Promise.all(
      unreadRows.map((row) => {
        const current = getReadByIds(row.read_by);

        return supabase
          .from("messages")
          .update({
            read_by: [...new Set([...current, userId])],
          })
          .eq("id", row.id);
      })
    );
  }

  async function fetchMessages(currentMatchId: string) {
    const { data } = await supabase
      .from("messages")
      .select("id, match_id, sender_id, body, type, created_at, read_by")
      .eq("match_id", currentMatchId)
      .order("created_at", { ascending: true });

    const rows = (data ?? []) as MessageRow[];

    setMessages(rows);

    await markMessagesRead(rows);
  }

  useEffect(() => {
    let alive = true;

    async function loadChat() {
      if (!matchId || !userId) {
        if (alive) setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const { data: match, error: matchError } = await supabase
          .from("matches")
          .select("id, user1_id, user2_id")
          .eq("id", matchId)
          .maybeSingle();

        if (matchError) throw matchError;

        if (!match) {
          Alert.alert("Chat not found");

          router.replace("/(tabs)/messages");

          return;
        }

        const typedMatch = match as MatchRow;

        const other =
          typedMatch.user1_id === userId
            ? typedMatch.user2_id
            : typedMatch.user1_id;

        const blockedIds = await getBlockedUserIds(userId);

        if (blockedIds.includes(other)) {
          Alert.alert("Unavailable", "You cannot access this chat.");

          router.replace("/(tabs)/messages");

          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select(
            `
            id,
            display_name,
            username,
            profile_photo_url,
            avatar_url,
            boost_active,
            boost_expires_at
          `
          )
          .eq("id", other)
          .maybeSingle();

        if (!alive) return;

        setOtherUserId(other);

        setOtherProfile((profile as OtherProfile | null) ?? null);

        await fetchMessages(matchId);
      } catch (error) {
        console.log("CHAT LOAD ERROR:", error);

        Alert.alert("Could not load chat");

        router.replace("/(tabs)/messages");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadChat();

    return () => {
      alive = false;
    };
  }, [matchId, userId, router]);

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`chat-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        async () => {
          await fetchMessages(matchId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, userId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({
          animated: true,
        });
      }, 70);
    }
  }, [messages]);

  async function handleSend() {
    if (!userId || !matchId || !otherUserId || sending) {
      return;
    }

    const body = text.trim();

    if (!body) return;

    try {
      setSending(true);

      const blockedIds = await getBlockedUserIds(userId);

      if (blockedIds.includes(otherUserId)) {
        Alert.alert("Unavailable", "You cannot message this user.");

        router.replace("/(tabs)/messages");

        return;
      }

      const { error } = await supabase.from("messages").insert({
        match_id: matchId,
        sender_id: userId,
        body,
        type: "text",
        read_by: [userId],
      });

      if (error) throw error;

      setText("");

      try {
        const senderName = await getProfileDisplayName(userId);

        await createMessageNotification({
          receiverUserId: otherUserId,
          senderUserId: userId,
          senderName,
          matchId,
          messagePreview: body.length > 120 ? `${body.slice(0, 120)}...` : body,
        });
      } catch (notificationError) {
        console.log("MESSAGE NOTIFICATION ERROR:", notificationError);
      }
    } catch (error: any) {
      Alert.alert(
        "Could not send message",
        error?.message ?? "Unknown error"
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Image
          source={POLYOPEN_LOGO}
          style={styles.loadingLogo}
          resizeMode="contain"
        />

        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (otherUserId) {
                router.push(`/profile/${otherUserId}` as any);
              }
            }}
            style={styles.profileHeader}
          >
            <View>
              {otherImage ? (
                <Image
                  source={{ uri: otherImage }}
                  style={styles.headerAvatar}
                  resizeMode="cover"
                />
              ) : (
                <DefaultAvatar size={52} />
              )}

              {isBoostActive(otherProfile) ? (
                <View style={styles.boostBadge}>
                  <Text style={styles.boostBadgeText}>⚡</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.headerTextWrap}>
              <Text numberOfLines={1} style={styles.headerTitle}>
                {title}
              </Text>

              <Text style={styles.headerSubtext}>Tap to view profile</Text>
            </View>
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.matchIntro}>
              {otherImage ? (
                <Image
                  source={{ uri: otherImage }}
                  style={styles.introAvatar}
                  resizeMode="cover"
                />
              ) : (
                <DefaultAvatar size={92} />
              )}

              <Text style={styles.introTitle}>{title}</Text>

              {!!otherProfile?.username && (
                <Text style={styles.introUsername}>
                  @{otherProfile.username}
                </Text>
              )}

              <Text style={styles.introText}>
                You matched. Start something real.
              </Text>

              {isBoostActive(otherProfile) ? (
                <View style={styles.introBoost}>
                  <Text style={styles.introBoostText}>⚡ Boosted Profile</Text>
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyTitle}>Start the conversation</Text>

              <Text style={styles.emptyText}>
                Send the first message and break the ice.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const mine = item.sender_id === userId;

            const previous = index > 0 ? messages[index - 1] : null;

            const next = index < messages.length - 1 ? messages[index + 1] : null;

            const showDate =
              !previous ||
              formatMessageDate(previous.created_at) !==
                formatMessageDate(item.created_at);

            const groupedWithNext = !!next && next.sender_id === item.sender_id;

            return (
              <View>
                {showDate ? (
                  <View style={styles.dateWrap}>
                    <View style={styles.datePill}>
                      <Text style={styles.dateText}>
                        {formatMessageDate(item.created_at)}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View
                  style={[
                    styles.messageRow,
                    mine ? styles.messageRowMine : styles.messageRowTheirs,
                    groupedWithNext ? styles.messageRowGrouped : null,
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.myBubble : styles.theirBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        mine ? styles.myMessageText : styles.theirMessageText,
                      ]}
                    >
                      {item.body ?? ""}
                    </Text>
                  </View>

                  {!groupedWithNext ? (
                    <Text style={styles.messageTime}>
                      {formatMessageTime(item.created_at)}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
        />

        <View
          style={[
            styles.inputBar,
            {
              paddingBottom: Math.max(insets.bottom + 8, 12),
            },
          ]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write a message..."
            placeholderTextColor="#999"
            multiline
            maxLength={1200}
            style={styles.input}
          />

          <Pressable
            onPress={handleSend}
            disabled={sending || !text.trim()}
            style={[
              styles.sendButton,
              sending || !text.trim() ? styles.sendButtonDisabled : null,
            ]}
          >
            <Text style={styles.sendButtonText}>{sending ? "..." : "Send"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  keyboardView: {
    flex: 1,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: BRAND.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingLogo: {
    width: 120,
    height: 120,
    opacity: 0.14,
    position: "absolute",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#FFFFFFEE",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },

  backButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
  },

  backText: {
    fontWeight: "900",
    color: BRAND.text,
  },

  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 12,
  },

  defaultAvatar: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  headerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },

  boostBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  boostBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  headerTextWrap: {
    marginLeft: 12,
    flex: 1,
  },

  headerTitle: {
    fontWeight: "900",
    fontSize: 18,
    color: BRAND.text,
  },

  headerSubtext: {
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },

  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },

  matchIntro: {
    alignItems: "center",
    marginBottom: 20,
  },

  introAvatar: {
    width: 92,
    height: 92,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },

  introTitle: {
    marginTop: 12,
    fontWeight: "900",
    fontSize: 22,
    color: BRAND.text,
  },

  introUsername: {
    marginTop: 4,
    color: BRAND.blue,
    fontWeight: "800",
  },

  introText: {
    marginTop: 6,
    color: BRAND.muted,
    textAlign: "center",
    fontWeight: "700",
  },

  introBoost: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFF4D6",
    borderWidth: 1,
    borderColor: "#F7D27A",
  },

  introBoostText: {
    color: "#9A5B00",
    fontWeight: "900",
    fontSize: 12,
  },

  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 44,
  },

  emptyTitle: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 22,
  },

  emptyText: {
    color: BRAND.muted,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
    fontWeight: "700",
  },

  dateWrap: {
    alignItems: "center",
    marginVertical: 10,
  },

  datePill: {
    backgroundColor: "#F4F7FF",
    borderWidth: 1,
    borderColor: "#DCE5FF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  dateText: {
    color: "#2045A6",
    fontWeight: "900",
    fontSize: 12,
  },

  messageRow: {
    marginBottom: 10,
  },

  messageRowGrouped: {
    marginBottom: 3,
  },

  messageRowMine: {
    alignItems: "flex-end",
  },

  messageRowTheirs: {
    alignItems: "flex-start",
  },

  bubble: {
    maxWidth: "82%",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  myBubble: {
    backgroundColor: BRAND.pink,
    borderBottomRightRadius: 8,
  },

  theirBubble: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderBottomLeftRadius: 8,
  },

  messageText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },

  myMessageText: {
    color: "#FFFFFF",
  },

  theirMessageText: {
    color: BRAND.text,
  },

  messageTime: {
    marginTop: 4,
    fontSize: 12,
    color: "#777",
    paddingHorizontal: 4,
    fontWeight: "700",
  },

  inputBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "#FFFFFFEE",
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },

  input: {
    flex: 1,
    minHeight: 54,
    maxHeight: 120,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 16,
    color: BRAND.text,
    fontWeight: "600",
  },

  sendButton: {
    minWidth: 84,
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  sendButtonDisabled: {
    backgroundColor: "#EDC7DB",
  },

  sendButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});