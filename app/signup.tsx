import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signup = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      Alert.alert("Missing info", "Enter your email and password.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Password too short", "Use at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (error) {
        Alert.alert("Sign up failed", error.message);
        return;
      }

      Alert.alert(
        "Account created",
        "Your account was created. If email confirmation is enabled, confirm your email and then sign in.",
        [{ text: "OK", onPress: () => router.replace("/login") }]
      );
    } catch (e: any) {
      Alert.alert("Sign up failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: "#FFF9FC" }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          justifyContent: "center",
        }}
      >
        <View style={{ marginBottom: 28, alignItems: "center" }}>
          <Image
            source={require("../assets/images/polyopen-logo.png")}
            style={{
              width: 110,
              height: 110,
              marginBottom: 14,
            }}
            resizeMode="contain"
          />

          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: "#111",
              marginBottom: 6,
            }}
          >
            PolyOpen
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: "#7A6E79",
              textAlign: "center",
            }}
          >
            Create your account
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#9A9098"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={{
              borderWidth: 1,
              borderColor: "#E6D8E2",
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
            placeholderTextColor="#9A9098"
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: "#E6D8E2",
              borderRadius: 18,
              paddingHorizontal: 16,
              paddingVertical: 16,
              backgroundColor: "#FFFFFF",
              fontSize: 16,
              color: "#111",
            }}
          />

          <Pressable
            onPress={signup}
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
              {busy ? "Creating account..." : "Create account"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace("/login")}
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
              Back to login
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}