import { Redirect, Stack, usePathname } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AuthProvider, useAuth } from "../lib/auth";

function Gate() {
  const { session, profile, loading, error, step, refreshProfile, signOut, forceReboot } = useAuth();
  const pathname = usePathname();

  const isLogin = pathname === "/login";
  const isOnboarding = pathname === "/onboarding";

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 16, gap: 12 }}>
        <ActivityIndicator />
        <Text style={{ fontSize: 16, fontWeight: "900" }}>Loading…</Text>
        <Text style={{ opacity: 0.85 }}>Step: {step}</Text>
        <Text style={{ opacity: 0.85 }}>Session: {session ? "yes" : "no"}</Text>
        <Text style={{ opacity: 0.85 }}>Profile: {profile ? "yes" : "no"}</Text>
        <Text style={{ opacity: 0.6 }}>
          If this stays longer than ~12 seconds, it should switch to an error screen automatically.
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>Startup blocked</Text>
        <Text style={{ opacity: 0.9 }}>{error}</Text>
        <Text style={{ opacity: 0.7 }}>Step: {step}</Text>

        <Pressable
          onPress={refreshProfile}
          style={{ padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#111", alignItems: "center" }}
        >
          <Text style={{ fontWeight: "900" }}>Retry profile</Text>
        </Pressable>

        <Pressable
          onPress={forceReboot}
          style={{ padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#111", alignItems: "center" }}
        >
          <Text style={{ fontWeight: "900" }}>Reboot auth</Text>
        </Pressable>

        <Pressable
          onPress={signOut}
          style={{ padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#999", alignItems: "center" }}
        >
          <Text style={{ fontWeight: "900" }}>Log out</Text>
        </Pressable>
      </View>
    );
  }

  if (!session && !isLogin) return <Redirect href="/login" />;

  if (session && profile && !profile.has_onboarded && !isOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  if (session && profile?.has_onboarded && (isLogin || isOnboarding)) {
    return <Redirect href="/dashboard" />;
  }

  return <Stack screenOptions={{ headerShown: true }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
