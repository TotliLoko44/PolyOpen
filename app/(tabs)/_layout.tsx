import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  AppState,
  Image,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BRAND } from "../../lib/brand";
import { registerForPushNotifications } from "../../lib/push";
import { supabase } from "../../lib/supabase";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();

  const isDesktopWeb =
    Platform.OS === "web" &&
    viewportWidth >= 1024;

  const isWideDesktopWeb =
    Platform.OS === "web" &&
    viewportWidth >= 1440;

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const bottomInset = isDesktopWeb
    ? 0
    : Math.max(
        insets.bottom,
        Platform.OS === "android" ? 14 : 10
      );

  const desktopRailWidth =
    isWideDesktopWeb ? 280 : 252;

  useEffect(() => {
    bootstrap();

    const notificationsChannel = supabase
      .channel("tabs-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        async () => {
          await loadUnreadNotifications();
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel("tabs-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        async () => {
          await loadUnreadMessages();
        }
      )
      .subscribe();

    const appStateSubscription = AppState.addEventListener(
      "change",
      async (state) => {
        if (state === "active") {
          await Promise.all([
            loadUnreadNotifications(),
            loadUnreadMessages(),
            loadAvatar(),
          ]);
        }
      }
    );

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(messagesChannel);
      appStateSubscription.remove();
    };
  }, []);

  async function bootstrap() {
    await Promise.all([
      loadAvatar(),
      loadUnreadNotifications(),
      loadUnreadMessages(),
      registerPushToken(),
    ]);
  }

  async function registerPushToken() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) return;

    await registerForPushNotifications(user.id);
  }

  async function loadAvatar() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setAvatarUrl(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("profile_photo_url, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      setAvatarUrl(data?.profile_photo_url || data?.avatar_url || null);
    } catch (error) {
      console.log("LOAD AVATAR ERROR:", error);
    }
  }

  async function loadUnreadNotifications() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setUnreadNotifications(0);
        return;
      }

      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);

      if (error) throw error;

      setUnreadNotifications(count ?? 0);
    } catch (error) {
      console.log("NOTIFICATION COUNT ERROR:", error);
      setUnreadNotifications(0);
    }
  }

  async function loadUnreadMessages() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setUnreadMessages(0);
        return;
      }

      const { data: matches, error: matchesError } = await supabase
        .from("matches")
        .select("id, user1_id, user2_id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (matchesError) throw matchesError;

      const matchIds = (matches ?? []).map((match) => match.id);

      if (matchIds.length === 0) {
        setUnreadMessages(0);
        return;
      }

      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("id, sender_id, read_by")
        .in("match_id", matchIds);

      if (messagesError) throw messagesError;

      let unreadCount = 0;

      for (const message of messages ?? []) {
        const readBy = Array.isArray(message.read_by)
          ? message.read_by
          : [];

        const unread =
          message.sender_id !== user.id &&
          !readBy.includes(user.id);

        if (unread) unreadCount += 1;
      }

      setUnreadMessages(unreadCount);
    } catch (error) {
      console.log("UNREAD MESSAGE COUNT ERROR:", error);
      setUnreadMessages(0);
    }
  }

  const totalActivity = useMemo(() => {
    return unreadNotifications + unreadMessages;
  }, [unreadNotifications, unreadMessages]);

  function renderBadge(count: number) {
    if (count <= 0) return null;

    return (
      <View
        style={{
          position: "absolute",
          top: -5,
          right: -8,
          minWidth: 18,
          height: 18,
          borderRadius: 999,
          backgroundColor: BRAND.pink,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 4,
          borderWidth: 2,
          borderColor: "#FFFFFF",
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: "900",
          }}
        >
          {count > 9 ? "9+" : count}
        </Text>
      </View>
    );
  }

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: true,
        headerTitle: "",
        headerStyle: {
          backgroundColor: "#FFFFFF",
          height: isDesktopWeb ? 76 : 58,
          borderBottomWidth: isDesktopWeb ? 1 : 0,
          borderBottomColor: isDesktopWeb ? "#F0E5EC" : "transparent",
        },
        headerShadowVisible: false,
        sceneStyle: {
          width: "100%",
          maxWidth: isWideDesktopWeb ? 1560 : 1380,
          alignSelf: "center",
          backgroundColor: isDesktopWeb ? "#FCFAFC" : "#FFFFFF",
        },

        tabBarPosition:
          isDesktopWeb
            ? "left"
            : "bottom",

        tabBarLabelPosition:
          isDesktopWeb
            ? "beside-icon"
            : "below-icon",

        tabBarBackground: isDesktopWeb
          ? () => (
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#FBF7FC",
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    top: 24,
                    left: 20,
                    right: 20,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      backgroundColor: "#FFFFFF",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "#F0DCE8",
                      shadowColor: "#7B3FE4",
                      shadowOpacity: 0.1,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 5 },
                    }}
                  >
                    <Image
                      source={require("../../assets/images/polyopen-logo.png")}
                      style={{ width: 39, height: 39 }}
                      resizeMode="contain"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: BRAND.text,
                        fontSize: 19,
                        fontWeight: "900",
                        letterSpacing: -0.4,
                      }}
                    >
                      PolyOpen
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 2,
                        color: BRAND.muted,
                        fontSize: 10,
                        fontWeight: "700",
                      }}
                    >
                      Ethical Love~Open Spirituality
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    position: "absolute",
                    top: 94,
                    left: 20,
                    right: 20,
                    height: 1,
                    backgroundColor: "#EEDFE8",
                  }}
                />
              </View>
            )
          : undefined,

        headerRight: () => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginRight: isDesktopWeb ? 28 : 14,
              gap: 12,
            }}
          >
            <Pressable
              onPress={() => {
                router.push("/notifications" as any);
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: totalActivity > 0 ? "#FFF5FA" : "#F8FBFF",
                borderWidth: 1.5,
                borderColor:
                  totalActivity > 0 ? "#F3C4DD" : "#DCE5FF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={
                  unreadNotifications > 0
                    ? "notifications"
                    : "notifications-outline"
                }
                size={21}
                color={
                  unreadNotifications > 0
                    ? BRAND.pink
                    : BRAND.blue
                }
              />

              {renderBadge(unreadNotifications)}
            </Pressable>

            <Pressable
              onPress={() => router.push("/(tabs)/profile" as any)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                overflow: "visible",
              }}
            >
              <Image
                source={
                  avatarUrl
                    ? { uri: avatarUrl }
                    : require("../../assets/images/polyopen-logo.png")
                }
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#FFFFFF",
                }}
                resizeMode="cover"
              />

              {totalActivity > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    right: -4,
                    bottom: -4,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 999,
                    backgroundColor: BRAND.magenta,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: "#FFFFFF",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontWeight: "900",
                      fontSize: 10,
                    }}
                  >
                    {totalActivity > 9 ? "9+" : totalActivity}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        ),

        tabBarActiveTintColor: BRAND.magenta,
        tabBarInactiveTintColor: "#526078",
        tabBarActiveBackgroundColor: isDesktopWeb
          ? "#FFFFFF"
          : "transparent",
        tabBarInactiveBackgroundColor: "transparent",
        tabBarHideOnKeyboard: true,

        tabBarStyle: isDesktopWeb
          ? {
              position: "relative",
              width: desktopRailWidth,
              height: "100%",
              paddingTop: 112,
              paddingHorizontal: 16,
              paddingBottom: 26,
              backgroundColor: "transparent",
              borderTopWidth: 0,
              borderRightWidth: 1,
              borderRightColor: "#EEDFE8",
              borderRadius: 0,
              shadowColor: "#7B3FE4",
              shadowOpacity: 0.06,
              shadowRadius: 24,
              shadowOffset: { width: 8, height: 0 },
            }
          : {
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 8,
              height: 70 + bottomInset,
              paddingBottom: bottomInset,
              backgroundColor: "#FFF9FC",
              borderTopWidth: 1,
              borderTopColor: BRAND.border,
              borderRadius: 24,
            },

        tabBarItemStyle: isDesktopWeb
          ? {
              minHeight: 54,
              maxHeight: 54,
              marginVertical: 5,
              borderRadius: 17,
              paddingHorizontal: 12,
            }
          : undefined,

        tabBarIconStyle: isDesktopWeb
          ? {
              marginRight: 8,
            }
          : undefined,

        tabBarLabelStyle: {
          fontWeight: "800",
          fontSize: isDesktopWeb ? 14 : 11,
          letterSpacing: isDesktopWeb ? 0.1 : 0,
          marginBottom: isDesktopWeb ? 0 : 2,
          textAlign: "left",
        },
      }}
    >
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "compass" : "compass-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="swipe"
        options={{
          title: "Speed Date",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "heart" : "heart-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "images" : "images-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",

          tabBarBadge:
            unreadMessages > 0
              ? unreadMessages > 9
                ? "9+"
                : unreadMessages
              : undefined,

          tabBarBadgeStyle: {
            backgroundColor: BRAND.pink,
            color: "#FFFFFF",
            fontWeight: "900",
          },

          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="matches"
        options={{
          title: "Connections",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "flame" : "flame-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen name="live" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
    </Tabs>
  );
}