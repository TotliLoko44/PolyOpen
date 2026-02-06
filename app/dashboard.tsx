import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "../lib/auth";

export default function Dashboard() {
  const router = useRouter();
  const { user, profile, updateProfile, signOut } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setBio(profile?.bio ?? "");
  }, [profile?.display_name, profile?.bio]);

  const onSave = async () => {
    try {
      setSaving(true);
      await updateProfile({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      } as any);
      Alert.alert("Saved", "Profile updated.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    try {
      await signOut();
      router.replace("/login");
    } catch (e: any) {
      Alert.alert("Logout failed", e?.message ?? "Unknown error");
    }
  };

  const name = profile?.display_name?.trim() || "Anonymous";

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "900" }}>Dashboard</Text>
      <Text style={{ opacity: 0.8 }}>Logged in as: {user?.email ?? "unknown"}</Text>

      <View style={{ borderWidth: 1, borderColor: "#e6e6e6", borderRadius: 14, padding: 14, gap: 6 }}>
        <Text style={{ fontSize: 16, fontWeight: "900" }}>{name}</Text>
        {!!profile?.bio && (
          <Text numberOfLines={3} style={{ opacity: 0.9 }}>
            {profile.bio}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={() => router.push("/browse")}
          style={{
            flex: 1,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#111",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "900" }}>Swipe</Text>
        </Pressable>

        <Pressable
          onPress={() => profile?.id && router.push(`/profile/${profile.id}`)}
          style={{
            flex: 1,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#999",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "900" }}>My Profile</Text>
        </Pressable>
      </View>

      <View style={{ gap: 8, marginTop: 6 }}>
        <Text style={{ fontWeight: "900" }}>Quick edit</Text>

        <Text style={{ fontWeight: "700" }}>Display name</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          autoCapitalize="words"
          style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 10 }}
        />

        <Text style={{ fontWeight: "700" }}>Bio</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Short bio"
          multiline
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            padding: 12,
            borderRadius: 10,
            minHeight: 90,
            textAlignVertical: "top",
          }}
        />

        <Pressable
          onPress={onSave}
          disabled={saving}
          style={{
            padding: 14,
            borderRadius: 10,
            alignItems: "center",
            opacity: saving ? 0.5 : 1,
            borderWidth: 1,
            borderColor: "#111",
            marginTop: 6,
          }}
        >
          <Text style={{ fontWeight: "900" }}>{saving ? "Saving..." : "Save"}</Text>
        </Pressable>

        <Pressable
          onPress={onLogout}
          style={{
            padding: 14,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#999",
            marginTop: 6,
          }}
        >
          <Text style={{ fontWeight: "900" }}>Log out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
