import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Image, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initializeAds } from "../lib/ads";
import { AuthProvider, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

import "../lib/liveKitBootstrap";
if (typeof (globalThis as any).DOMException === "undefined") {
  class PolyfilledDOMException extends Error {
    code: number;

    constructor(message?: string, name?: string) {
      super(message);
      this.name = name ?? "Error";
      this.code = 0;
    }
  }

  (globalThis as any).DOMException = PolyfilledDOMException;
}

const { registerGlobals } = require("@livekit/react-native");
registerGlobals();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type PushData = {
  type?: string;
  matchId?: string;
  profileId?: string;
  postId?: string;
  notificationId?: string;
  userId?: string;
};

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <Image
        source={require("../assets/images/polyopen-logo.png")}
        style={{ width: 150, height: 150, marginBottom: 22 }}
        resizeMode="contain"
      />

      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: "#111111",
          textAlign: "center",
        }}
      >
        Ethical love~Open spirituality
      </Text>
    </View>
  );
}

function normalizePushData(rawData: any): PushData {
  return {
    type: typeof rawData?.type === "string" ? rawData.type : undefined,
    matchId: typeof rawData?.matchId === "string" ? rawData.matchId : undefined,
    profileId:
      typeof rawData?.profileId === "string" ? rawData.profileId : undefined,
    postId: typeof rawData?.postId === "string" ? rawData.postId : undefined,
    notificationId:
      typeof rawData?.notificationId === "string"
        ? rawData.notificationId
        : undefined,
    userId: typeof rawData?.userId === "string" ? rawData.userId : undefined,
  };
}

function routeFromPushData(data: PushData) {
  if (data.type === "match" && data.matchId) {
    return `/chat/${data.matchId}`;
  }

  if (data.type === "chat_message" && data.matchId) {
    return `/chat/${data.matchId}`;
  }

  if ((data.type === "like" || data.type === "comment") && data.postId) {
    return {
      pathname: "/post/[id]",
      params: { id: data.postId, returnTo: "notifications" },
    };
  }

  if (data.type === "follow" && data.profileId) {
    return `/profile/${data.profileId}`;
  }

  if (data.postId) {
    return {
      pathname: "/post/[id]",
      params: { id: data.postId, returnTo: "notifications" },
    };
  }

  if (data.matchId) {
    return `/chat/${data.matchId}`;
  }

  if (data.profileId) {
    return `/profile/${data.profileId}`;
  }

  return "/notifications";
}

function getNotificationKey(response: Notifications.NotificationResponse) {
  const rawData = response.notification.request.content.data as any;
  const data = normalizePushData(rawData);

  return (
    data.notificationId ||
    response.notification.request.identifier ||
    `${data.type ?? "unknown"}-${data.postId ?? ""}-${data.profileId ?? ""}-${data.matchId ?? ""}`
  );
}

function AppNavigator() {
  const router = useRouter();
  const handledNotificationKeys = useRef<Record<string, boolean>>({});

  async function markNotificationRead(notificationId?: string) {
    if (!notificationId) return;

    try {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);
    } catch (error) {
      console.log("MARK PUSH READ ERROR:", error);
    }
  }

  async function handleNotificationResponse(
    response: Notifications.NotificationResponse
  ) {
    const key = getNotificationKey(response);

    if (handledNotificationKeys.current[key]) {
      return;
    }

    handledNotificationKeys.current[key] = true;

    const rawData = response.notification.request.content.data as any;
    const data = normalizePushData(rawData);

    await markNotificationRead(data.notificationId);

    const route = routeFromPushData(data);
    router.push(route as any);

    Notifications.clearLastNotificationResponseAsync?.().catch((error) => {
      console.log("CLEAR LAST NOTIFICATION ERROR:", error);
    });
  }

  useEffect(() => {
    initializeAds().catch((error: unknown) => {
      console.log("ADMOB INIT ERROR:", error);
    });

    const receivedSub = Notifications.addNotificationReceivedListener(() => {});

    const responseSub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationResponse(response);
      });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        handleNotificationResponse(response);
      })
      .catch((error) => {
        console.log("LAST NOTIFICATION RESPONSE ERROR:", error);
      });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="post/comments" />
      <Stack.Screen name="profile/[userId]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="follows" />
      <Stack.Screen name="live-room/[roomId]" />
      <Stack.Screen name="chat/[matchId]" />
      <Stack.Screen name="create-post" />
      <Stack.Screen name="edit-post/[id]" />
    </Stack>
  );
}

function AppShell() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <AppNavigator />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}