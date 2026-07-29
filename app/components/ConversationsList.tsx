import { router } from "expo-router";
import React from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

export type ConversationItem = {
  matchId: string;
  display_name: string | null;
  birth_year: number | null;
  relationship_style?: string | null;
  orientation?: string | null;
  avatar_url: string | null;
  lastMessage: string;
  lastMessageAt: string;
};

function getAgeFromBirthYear(birthYear?: number | null) {
  if (!birthYear) return null;
  const age = new Date().getFullYear() - birthYear;
  return age > 0 && age < 120 ? age : null;
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "";
  const now = Date.now();
  const then = new Date(value).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSec < 60) return "now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;

  return new Date(value).toLocaleDateString();
}

function buildMetaLine(item: ConversationItem) {
  const parts = [item.relationship_style, item.orientation].filter(Boolean);
  return parts.join(" • ");
}

export default function ConversationsList({ items }: { items: ConversationItem[] }) {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.matchId}
      contentContainerStyle={{ paddingBottom: 24 }}
      renderItem={({ item }) => {
        const age = getAgeFromBirthYear(item.birth_year);
        const metaLine = buildMetaLine(item);

        return (
          <Pressable style={styles.row} onPress={() => router.push(`/chat/${item.matchId}`)}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholder]} />
            )}

            <View style={styles.textWrap}>
              <Text style={styles.name}>
                {item.display_name ?? "Unnamed"}
                {typeof age === "number" ? `, ${age}` : ""}
              </Text>

              {!!metaLine && <Text style={styles.meta}>{metaLine}</Text>}

              <Text style={styles.preview} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            </View>

            <Text style={styles.time}>{formatRelativeTime(item.lastMessageAt)}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#efefef",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#111",
    marginRight: 12,
  },
  placeholder: {
    opacity: 0.2,
  },
  textWrap: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
  },
  meta: {
    marginTop: 3,
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  preview: {
    marginTop: 4,
    fontSize: 13,
    color: "#666",
  },
  time: {
    fontSize: 12,
    color: "#888",
    marginLeft: 10,
  },
});