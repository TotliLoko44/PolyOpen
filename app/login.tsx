import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ensureProfileRow, getHasOnboarded } from "../lib/profile";
import { supabase } from "../lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      Alert.alert("Missing info", "Enter your email and password.");
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        Alert.alert("Login failed", error.message);
        return;
      }

      const userId = data.user?.id;

      if (!userId) {
        Alert.alert("Login failed", "No user session was returned.");
        return;
      }

      try {
        await ensureProfileRow(userId);
      } catch (profileError: any) {
        console.log(
          "Login profile row warning:",
          profileError?.message ?? profileError
        );
      }

      let hasOnboarded = false;

      try {
        hasOnboarded = await getHasOnboarded(userId);
      } catch (onboardingError: any) {
        console.log(
          "Login onboarding warning:",
          onboardingError?.message ?? onboardingError
        );
      }

      router.replace(hasOnboarded ? "/(tabs)/browse" : "/onboarding");
    } catch (e: any) {
      Alert.alert("Login failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      style={{ flex: 1, backgroundColor: Platform.OS === "web" ? "#F5F5F7" : "#FFFFFF" }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 42,
          paddingBottom: 40,
            alignItems: "center",
          justifyContent: "center",
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: "100%", maxWidth: 460, marginBottom: 24, alignItems: "center" }}>
          <Image
            source={require("../assets/images/polyopen-logo.png")}
            style={{
              width: 140,
              height: 140,
              marginBottom: 18,
            }}
            resizeMode="contain"
          />

          <Text
            style={{
              fontSize: Platform.OS === "web" ? 24 : 30,
              fontWeight: "900",
              color: "#111",
              marginBottom: 6,
              textAlign: "center",
            }}
          >
            Ethical Love~Open Spirituality
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: "#666",
              textAlign: "center",
            }}
          >
            Sign in to your account
          </Text>
        </View>

        <View style={{ width: "100%", maxWidth: 460, gap: 12, backgroundColor: "#FFFFFF", borderWidth: Platform.OS === "web" ? 1 : 0, borderColor: "#E5E7EB", borderRadius: Platform.OS === "web" ? 24 : 0, padding: Platform.OS === "web" ? 24 : 0 }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            style={{
              borderWidth: 1,
              borderColor: "#E5E7EB",
              borderRadius: 18,
              paddingHorizontal: 16,
              paddingVertical: 16,
              backgroundColor: "#FFFFFF",
              fontSize: 16,
              color: "#111",
            }}
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#999"
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={login}
            style={{
              borderWidth: 1,
              borderColor: "#E5E7EB",
              borderRadius: 18,
              paddingHorizontal: 16,
              paddingVertical: 16,
              backgroundColor: "#FFFFFF",
              fontSize: 16,
              color: "#111",
            }}
          />

          <Pressable
            onPress={login}
            disabled={busy}
            style={{
              marginTop: 6,
              backgroundColor: "#111",
              paddingVertical: 17,
              borderRadius: 18,
              alignItems: "center",
              opacity: busy ? 0.65 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>
              {busy ? "Signing in..." : "Sign in"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/signup")}
            style={{
              alignItems: "center",
              paddingVertical: 12,
            }}
          >
            <Text
              style={{
                color: "#111",
                fontSize: 16,
                fontWeight: "500",
              }}
            >
              Create account
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}