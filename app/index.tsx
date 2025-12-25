import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { supabase } from "./lib/supabase";

export default function Home() {
  console.log("Supabase client:", supabase);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "700" }}>
        PolyOpen
      </Text>

      <Link href="/login" asChild>
        <Pressable
          style={{
            backgroundColor: "black",
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "white", fontSize: 16 }}>
            Log in
          </Text>
        </Pressable>
      </Link>

      <Link href="/signup" asChild>
        <Pressable
          style={{
            backgroundColor: "black",
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "white", fontSize: 16 }}>
            Create account
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
