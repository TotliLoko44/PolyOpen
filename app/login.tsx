import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function Login() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    try {
      if (busy) return;
      setBusy(true);

      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) throw new Error("Enter an email.");
      if (!password || password.length < 6) throw new Error("Password must be at least 6 characters.");

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;

        // Gate handles /onboarding vs /dashboard
        router.replace("/dashboard");
        return;
      }

      // SIGN UP
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (error) throw error;

      // If email confirmations are ON, session can be null until they confirm email.
      if (!data.session) {
        Alert.alert(
          "Check your email",
          "Your account was created. Please confirm the email link, then come back and Sign in."
        );
        setMode("signin");
        return;
      }

      // If confirmations are OFF (common in dev), they’ll be logged in immediately:
      router.replace("/dashboard");
    } catch (e: any) {
      Alert.alert("Auth failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "900" }}>
        {mode === "signin" ? "Sign in" : "Create account"}
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 10 }}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password (6+ chars)"
        secureTextEntry
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 10 }}
      />

      <Pressable
        onPress={onSubmit}
        disabled={busy}
        style={{
          padding: 14,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#111",
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Text style={{ fontWeight: "900" }}>
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
        disabled={busy}
        style={{
          padding: 14,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#999",
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Text style={{ fontWeight: "900" }}>
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </Text>
      </Pressable>

      <Text style={{ opacity: 0.7, marginTop: 6 }}>
        If you don’t get logged in after Sign up, Supabase email confirmation is ON — confirm the email
        link then sign in.
      </Text>
    </View>
  );
}
