import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../lib/auth";
import { sendLocalTestNotification } from "../../lib/push";

export default function Dashboard() {
  const router = useRouter();
  const { signOut, expoPushToken, refreshPushToken } = useAuth();

  const logout = async () => {
    await signOut();
    router.replace("/login");
  };

  const handleRefreshPush = async () => {
    const token = await refreshPushToken();

    if (!token) {
      Alert.alert(
        "Push not ready",
        "Permission may be denied, or you may not be on a physical device."
      );
      return;
    }

    Alert.alert("Push token saved", token);
  };

  const handleLocalTest = async () => {
    await sendLocalTestNotification();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12, backgroundColor: "white", flexGrow: 1 }}>
      <Text style={{ fontSize: 28, fontWeight: "700" }}>PolyOpen</Text>
      <Text style={{ color: "#666" }}>Ethical love • Open connection • Spirituality</Text>

      <View
        style={{
          padding: 12,
          borderWidth: 1,
          borderColor: "#e5e7eb",
          borderRadius: 12,
          backgroundColor: "#fafafa",
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Push Notifications</Text>
        <Text selectable style={{ color: "#444" }}>
          {expoPushToken ? expoPushToken : "No push token yet"}
        </Text>

        <Pressable
          onPress={handleRefreshPush}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: "#111827",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Register / Refresh Push Token</Text>
        </Pressable>

        <Pressable
          onPress={handleLocalTest}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: "#ec4899",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Send Local Test Notification</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.push("/(tabs)/browse")}>
        <Text>Browse</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/(tabs)/swipe")}>
        <Text>Swipe</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/(tabs)/matches")}>
        <Text>Connections</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/(tabs)/messages")}>
        <Text>Messages</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/(tabs)/profile")}>
        <Text>Profile</Text>
      </Pressable>

      <Pressable onPress={logout}>
        <Text>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}