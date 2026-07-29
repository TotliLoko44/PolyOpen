import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { useAuth } from "../../lib/auth";
import { BRAND } from "../../lib/brand";
import { supabase } from "../../lib/supabase";

type MatchRow = {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at?: string | null;
};

type ProfileRow = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  state?: string | null;
};

type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  body?: string | null;
  type?: string | null;
  created_at?: string | null;
  read_by?: any;
};

type Conversation = {
  matchId: string;
  userId: string;
  name: string;
  username: string | null;
  imageUrl: string | null;
  location: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unread: boolean;
  fromMe: boolean;
  requestLike: boolean;
};

type MessageFilter = "all" | "unread" | "requests";

const POLYOPEN_LOGO = require("../../assets/images/polyopen-logo.png");

function formatMessageTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
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

function getMessagePreview(message?: MessageRow | null, currentUserId?: string | null) {
  if (!message) return "Tap to start the conversation.";

  const prefix = message.sender_id === currentUserId ? "You: " : "";

  if (message.type === "audio") return `${prefix}Voice message`;
  if (message.type === "image") return `${prefix}Photo`;
  if (message.type === "video") return `${prefix}Video`;

  const body = message.body?.trim() || "Message";
  return `${prefix}${body}`;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { width: viewportWidth } = useWindowDimensions();

  const isDesktopWeb = viewportWidth >= 1024;
  const isWideDesktopWeb = viewportWidth >= 1440;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState<MessageFilter>("all");
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    loadConversations();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`messages-inbox-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        async () => {
          await loadConversations(false);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        async () => {
          await loadConversations(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function loadConversations(showLoader = true) {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (showLoader) setLoading(true);

      const { data: matches, error } = await supabase
        .from("matches")
        .select("id, user1_id, user2_id, created_at")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const matchRows = (matches ?? []) as MatchRow[];

      const otherIds = matchRows
        .map((match) =>
          match.user1_id === userId ? match.user2_id : match.user1_id
        )
        .filter(Boolean);

      const matchIds = matchRows.map((match) => match.id);

      let profileMap = new Map<string, ProfileRow>();
      let latestMessageMap = new Map<string, MessageRow>();

      if (otherIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select(
            "id, display_name, username, profile_photo_url, avatar_url, city, state"
          )
          .in("id", otherIds);

        if (profilesError) throw profilesError;

        profileMap = new Map(
          ((profiles ?? []) as ProfileRow[]).map((profile) => [
            profile.id,
            profile,
          ])
        );
      }

      if (matchIds.length > 0) {
        const { data: messages, error: messagesError } = await supabase
          .from("messages")
          .select("id, match_id, sender_id, body, type, created_at, read_by")
          .in("match_id", matchIds)
          .order("created_at", { ascending: false })
          .limit(500);

        if (messagesError) throw messagesError;

        for (const message of (messages ?? []) as MessageRow[]) {
          if (!latestMessageMap.has(message.match_id)) {
            latestMessageMap.set(message.match_id, message);
          }
        }
      }

      const formatted: Conversation[] = matchRows
        .map((match) => {
          const otherId =
            match.user1_id === userId ? match.user2_id : match.user1_id;

          const profile = profileMap.get(otherId);
          const latestMessage = latestMessageMap.get(match.id);
          const readByIds = getReadByIds(latestMessage?.read_by);
          const fromMe = latestMessage?.sender_id === userId;
          const hasIncomingMessage = !!latestMessage && latestMessage.sender_id !== userId;

          return {
            matchId: match.id,
            userId: otherId,
            name: profile?.display_name || profile?.username || "PolyOpen User",
            username: profile?.username || null,
            imageUrl: profile?.profile_photo_url || profile?.avatar_url || null,
            location: [profile?.city, profile?.state].filter(Boolean).join(", "),
            lastMessage: getMessagePreview(latestMessage, userId),
            lastMessageAt: latestMessage?.created_at || match.created_at || null,
            unread:
              !!latestMessage &&
              latestMessage.sender_id !== userId &&
              !readByIds.includes(userId),
            fromMe,
            requestLike: hasIncomingMessage && !fromMe,
          };
        })
        .sort((a, b) => {
          if (a.unread !== b.unread) return a.unread ? -1 : 1;

          const aTime = a.lastMessageAt
            ? new Date(a.lastMessageAt).getTime()
            : 0;
          const bTime = b.lastMessageAt
            ? new Date(b.lastMessageAt).getTime()
            : 0;

          return bTime - aTime;
        });

      setConversations(formatted);
    } catch (error) {
      console.log("MESSAGES LOAD ERROR:", error);
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadConversations(false);
  }

  const unreadCount = useMemo(() => {
    return conversations.filter((conversation) => conversation.unread).length;
  }, [conversations]);

  const requestCount = useMemo(() => {
    return conversations.filter((conversation) => conversation.requestLike).length;
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    let list = conversations;

    if (activeFilter === "unread") {
      list = list.filter((conversation) => conversation.unread);
    }

    if (activeFilter === "requests") {
      list = list.filter((conversation) => conversation.requestLike);
    }

    if (!query) return list;

    return list.filter((conversation) => {
      return (
        conversation.name.toLowerCase().includes(query) ||
        conversation.username?.toLowerCase().includes(query) ||
        conversation.location.toLowerCase().includes(query) ||
        conversation.lastMessage.toLowerCase().includes(query)
      );
    });
  }, [conversations, searchText, activeFilter]);

  function toggleFilter(filter: MessageFilter) {
    setActiveFilter((prev) => (prev === filter ? "all" : filter));
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.header}>Messages</Text>
          <Text style={styles.subheader}>Matches, chats, and real connections</Text>
        </View>

        <View style={styles.headerPills}>
          {unreadCount > 0 ? (
            <Pressable
              onPress={() => toggleFilter("unread")}
              style={[
                styles.unreadPill,
                activeFilter === "unread" ? styles.unreadPillActive : null,
              ]}
            >
              <Text style={styles.unreadPillText}>{unreadCount} new</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => toggleFilter("all")}
            style={[
              styles.countPill,
              activeFilter === "all" ? styles.countPillActive : null,
            ]}
          >
            <Text style={styles.countPillText}>{conversations.length}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsStrip}>
        <Pressable
          onPress={() => toggleFilter("all")}
          style={[
            styles.statBox,
            activeFilter === "all" ? styles.statBoxActive : null,
          ]}
        >
          <Text style={styles.statNumber}>{conversations.length}</Text>
          <Text style={styles.statLabel}>Chats</Text>
        </Pressable>

        <Pressable
          onPress={() => toggleFilter("unread")}
          style={[
            styles.statBox,
            activeFilter === "unread" ? styles.statBoxActivePink : null,
          ]}
        >
          <Text style={styles.statNumber}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </Pressable>

        <Pressable
          onPress={() => toggleFilter("requests")}
          style={[
            styles.statBox,
            activeFilter === "requests" ? styles.statBoxActiveBlue : null,
          ]}
        >
          <Text style={styles.statNumber}>{requestCount}</Text>
          <Text style={styles.statLabel}>Requests</Text>
        </Pressable>
      </View>

      {activeFilter !== "all" ? (
        <View style={styles.filterNotice}>
          <Text style={styles.filterNoticeText}>
            Showing {activeFilter === "unread" ? "unread chats" : "message requests"}
          </Text>

          <Pressable onPress={() => setActiveFilter("all")}>
            <Text style={styles.filterNoticeClear}>Show all</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.searchBox}>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search matches, messages, locations"
          placeholderTextColor={BRAND.muted}
          style={styles.searchInput}
        />

        {!!searchText.trim() && (
          <Pressable onPress={() => setSearchText("")} style={styles.clearSearch}>
            <Text style={styles.clearSearchText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <Image
            source={POLYOPEN_LOGO}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyCard}>
          <Image
            source={POLYOPEN_LOGO}
            style={styles.emptyLogo}
            resizeMode="contain"
          />

          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            When you match with someone, your chat will show up here.
          </Text>

          <Pressable
            onPress={() => router.push("/(tabs)/swipe" as any)}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>Start Swiping</Text>
          </Pressable>
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {activeFilter === "unread"
              ? "No unread chats"
              : activeFilter === "requests"
                ? "No message requests"
                : "No matches found"}
          </Text>
          <Text style={styles.emptyText}>
            {activeFilter === "unread"
              ? "All caught up. New unread messages will appear here."
              : activeFilter === "requests"
                ? "Incoming messages that need attention will appear here."
                : "Try searching another name, username, message, or location."}
          </Text>
        </View>
      ) : (
        filteredConversations.map((conversation) => (
          <Pressable
            key={conversation.matchId}
            onPress={() => router.push(`/chat/${conversation.matchId}` as any)}
            style={[
              styles.conversationCard,
              isDesktopWeb
                ? styles.conversationCardDesktop
                : null,
              isWideDesktopWeb
                ? styles.conversationCardWideDesktop
                : null,
              conversation.unread
                ? styles.conversationCardUnread
                : null,
            ]}
          >
            <Pressable
              onPress={() => router.push(`/profile/${conversation.userId}` as any)}
              style={styles.avatarWrap}
            >
              {conversation.imageUrl ? (
                <Image
                  source={{ uri: conversation.imageUrl }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Image
                    source={POLYOPEN_LOGO}
                    style={styles.avatarLogo}
                    resizeMode="contain"
                  />
                </View>
              )}

              {conversation.unread ? <View style={styles.unreadDot} /> : null}
            </Pressable>

            <View style={styles.conversationBody}>
              <View style={styles.conversationTopRow}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.conversationName,
                    conversation.unread ? styles.conversationNameUnread : null,
                  ]}
                >
                  {conversation.name}
                </Text>

                <Text
                  style={[
                    styles.timeText,
                    conversation.unread ? styles.timeTextUnread : null,
                  ]}
                >
                  {formatMessageTime(conversation.lastMessageAt)}
                </Text>
              </View>

              <View style={styles.metaRow}>
                {!!conversation.username && (
                  <Text numberOfLines={1} style={styles.username}>
                    @{conversation.username}
                  </Text>
                )}

                {conversation.requestLike ? (
                  <View style={styles.requestPill}>
                    <Text style={styles.requestPillText}>Request</Text>
                  </View>
                ) : null}

                {conversation.unread ? (
                  <View style={styles.newPill}>
                    <Text style={styles.newPillText}>New</Text>
                  </View>
                ) : null}
              </View>

              <Text
                numberOfLines={1}
                style={[
                  styles.previewText,
                  conversation.unread ? styles.previewUnread : null,
                ]}
              >
                {conversation.lastMessage}
              </Text>

              {!!conversation.location && (
                <Text numberOfLines={1} style={styles.locationText}>
                  {conversation.location}
                </Text>
              )}
            </View>

            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  content: {
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 130,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },

  headerTextWrap: {
    flex: 1,
  },

  header: {
    fontSize: 34,
    fontWeight: "900",
    color: BRAND.text,
  },

  subheader: {
    marginTop: 4,
    color: BRAND.muted,
    fontWeight: "700",
  },

  headerPills: {
    alignItems: "flex-end",
    gap: 8,
  },

  countPill: {
    minWidth: 42,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },

  countPillActive: {
    borderColor: BRAND.pink,
  },

  countPillText: {
    color: BRAND.pink,
    fontWeight: "900",
    fontSize: 16,
  },

  unreadPill: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  unreadPillActive: {
    backgroundColor: "#111111",
  },

  unreadPillText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },

  statsStrip: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  statBox: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    alignItems: "center",
  },

  statBoxActive: {
    borderColor: BRAND.pink,
    backgroundColor: "#FFF7FB",
  },

  statBoxActivePink: {
    borderColor: BRAND.pink,
    backgroundColor: "#FFF7FB",
  },

  statBoxActiveBlue: {
    borderColor: BRAND.blue,
    backgroundColor: "#F8FBFF",
  },

  statNumber: {
    color: BRAND.text,
    fontSize: 20,
    fontWeight: "900",
  },

  statLabel: {
    marginTop: 2,
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  filterNotice: {
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  filterNoticeText: {
    color: BRAND.text,
    fontWeight: "900",
  },

  filterNoticeClear: {
    color: BRAND.blue,
    fontWeight: "900",
  },

  searchBox: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    justifyContent: "center",
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
  },

  searchInput: {
    flex: 1,
    color: BRAND.text,
    fontWeight: "800",
    fontSize: 15,
  },

  clearSearch: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#DCE5FF",
  },

  clearSearchText: {
    color: BRAND.blue,
    fontWeight: "900",
    fontSize: 12,
  },

  loadingCard: {
    marginTop: 18,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    padding: 24,
    alignItems: "center",
  },

  loadingLogo: {
    width: 88,
    height: 88,
    opacity: 0.16,
    marginBottom: 12,
  },

  loadingText: {
    marginTop: 10,
    color: BRAND.muted,
    fontWeight: "700",
  },

  emptyCard: {
    marginTop: 18,
    padding: 22,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },

  emptyLogo: {
    width: 96,
    height: 96,
    marginBottom: 14,
  },

  emptyTitle: {
    fontWeight: "900",
    fontSize: 22,
    color: BRAND.text,
    textAlign: "center",
  },

  emptyText: {
    marginTop: 8,
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
  },

  emptyButton: {
    marginTop: 18,
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },

  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },

  conversationCardDesktop: {
    minHeight: 104,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    marginBottom: 12,
  },

  conversationCardWideDesktop: {
    minHeight: 112,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },

  conversationCardUnread: {
    borderColor: "#F4CFE4",
    backgroundColor: "#FFF7FB",
  },

  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 999,
    overflow: "visible",
    backgroundColor: "#FFFFFF",
  },

  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },

  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarLogo: {
    width: 54,
    height: 54,
  },

  unreadDot: {
    position: "absolute",
    right: 0,
    top: 2,
    width: 13,
    height: 13,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  conversationBody: {
    flex: 1,
    marginLeft: 12,
  },

  conversationTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  conversationName: {
    flex: 1,
    fontWeight: "900",
    fontSize: 17,
    color: BRAND.text,
  },

  conversationNameUnread: {
    color: BRAND.pink,
  },

  timeText: {
    color: BRAND.muted,
    fontWeight: "800",
    fontSize: 12,
  },

  timeTextUnread: {
    color: BRAND.pink,
    fontWeight: "900",
  },

  metaRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  username: {
    color: BRAND.blue,
    fontWeight: "800",
    fontSize: 12,
  },

  requestPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#DCE5FF",
  },

  requestPillText: {
    color: BRAND.blue,
    fontWeight: "900",
    fontSize: 10,
  },

  newPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
  },

  newPillText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
  },

  previewText: {
    marginTop: 5,
    color: "#666",
    fontWeight: "700",
    fontSize: 14,
  },

  previewUnread: {
    color: BRAND.text,
    fontWeight: "900",
  },

  locationText: {
    marginTop: 5,
    color: BRAND.muted,
    fontWeight: "700",
    fontSize: 12,
  },

  chevron: {
    marginLeft: 8,
    color: BRAND.muted,
    fontSize: 34,
    fontWeight: "300",
  },
});