import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

export async function registerForPushNotifications(userId?: string | null) {
  try {
    if (!Device.isDevice) {
      console.log("Push notifications require a real device.");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF4FA3",
      });
    }

    const existingPermission = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermission.status;

    if (finalStatus !== "granted") {
      const requestedPermission = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermission.status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted.");
      return null;
    }

    const projectId = getProjectId();

    if (!projectId) {
      console.log("Missing EAS projectId. Skipping push token registration.");
      return null;
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const expoPushToken = tokenResult.data;

    if (userId) {
      await savePushTokenForUser(userId, expoPushToken);
    }

    return expoPushToken;
  } catch (error: any) {
    console.log("PUSH REGISTRATION SKIPPED:", error?.message ?? error);
    return null;
  }
}

export async function registerForPushNotificationsAsync(userId?: string | null) {
  return registerForPushNotifications(userId);
}

async function savePushTokenForUser(userId: string, expoPushToken: string) {
  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,expo_push_token" }
  );

  if (error) {
    console.log("SAVE PUSH TOKEN ERROR:", error.message);
  }
}

export async function syncPushTokenForUser(
  userId?: string | null,
  expoPushToken?: string | null
) {
  try {
    if (!userId) return null;

    if (expoPushToken) {
      await savePushTokenForUser(userId, expoPushToken);
      return expoPushToken;
    }

    return registerForPushNotifications(userId);
  } catch (error: any) {
    console.log("SYNC PUSH TOKEN ERROR:", error?.message ?? error);
    return null;
  }
}

export async function unregisterPushToken(userId: string, expoPushToken: string) {
  try {
    if (!userId || !expoPushToken) return;

    const { error } = await supabase
      .from("push_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("expo_push_token", expoPushToken);

    if (error) {
      console.log("DELETE PUSH TOKEN ERROR:", error.message);
    }
  } catch (error: any) {
    console.log("UNREGISTER PUSH TOKEN ERROR:", error?.message ?? error);
  }
}

export async function clearPushTokenForUser(userId?: string | null) {
  try {
    if (!userId) return;

    const { error } = await supabase
      .from("push_tokens")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.log("CLEAR PUSH TOKEN ERROR:", error.message);
    }
  } catch (error: any) {
    console.log("CLEAR PUSH TOKEN ERROR:", error?.message ?? error);
  }
}

export async function sendLocalTestNotification() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "PolyOpen test notification",
        body: "Push notifications are connected.",
        sound: true,
      },
      trigger: null,
    });
  } catch (error: any) {
    console.log("LOCAL TEST NOTIFICATION ERROR:", error?.message ?? error);
  }
}