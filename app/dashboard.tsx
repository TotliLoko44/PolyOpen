import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { supabase } from "./lib/supabase";

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        console.log("getUser error:", error.message);
        return;
      }
      setEmail(data.user?.email ?? "");
    });
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert("Logout failed", error.message);
      return;
    }

    router.replace("/");
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 10 }}>
        Welcome to your Dashboard
      </Text>

      <Text style={{ fontSize: 16, marginBottom: 24 }}>
        Logged in as: <Text style={{ fontWeight: "700" }}>{email || "..."}</Text>
      </Text>

      <Pressable
        onPress={handleLogout}
        style={{
          backgroundColor: "black",
          paddingVertical: 14,
          paddingHorizontal: 22,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>Log out</Text>
      </Pressable>
    </View>
  );
}
