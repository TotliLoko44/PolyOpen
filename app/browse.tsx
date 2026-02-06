import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

type PublicProfile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  relationship_style: string | null;
  seeking: string[] | null;
  pronouns: string | null;
  gender: string | null;
  orientation: string | null;
  visibility: string | null;
  updated_at: string | null;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Browse() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<PublicProfile[]>([]);
  const [index, setIndex] = useState(0);

  const current = useMemo(() => candidates[index] ?? null, [candidates, index]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.id) {
        setCandidates([]);
        setIndex(0);
        setError("Not logged in.");
        return;
      }

      // 1) Get who you blocked
      const { data: blocks, error: bErr } = await supabase
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);

      if (bErr) throw bErr;

      const blockedIds = new Set<string>((blocks ?? []).map((r: any) => r.blocked_id));

      // 2) Get who you already LIKED (we exclude likes so they don’t show again)
      const { data: likes, error: sErr } = await supabase
        .from("swipes")
        .select("swiped_id,direction")
        .eq("swiper_id", user.id)
        .eq("direction", "like");

      if (sErr) throw sErr;

      const likedIds = new Set<string>((likes ?? []).map((r: any) => r.swiped_id));

      // 3) Load public candidates
      const { data: rows, error: pErr } = await supabase
        .from("public_profiles")
        .select(
          "id,display_name,bio,avatar_url,city,state,relationship_style,seeking,pronouns,gender,orientation,visibility,updated_at"
        )
        .order("updated_at", { ascending: false })
        .limit(80);

      if (pErr) throw pErr;

      const filtered = (rows ?? []).filter((p: any) => {
        if (!p?.id) return false;
        if (p.id === user.id) return false;
        if (blockedIds.has(p.id)) return false;
        if (likedIds.has(p.id)) return false;
        return true;
      }) as PublicProfile[];

      // Shuffle to keep it feeling “swipey”
      const shuffled = shuffle(filtered);

      setCandidates(shuffled);
      setIndex(0);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load swipe feed.");
      setCandidates([]);
      setIndex(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const nextCard = () => {
    setIndex((i) => {
      const next = i + 1;
      if (next >= candidates.length) return i; // stay, user can refresh
      return next;
    });
  };

  const onPass = async () => {
    // IMPORTANT: We do NOT write "pass" to DB so the person can show again later.
    if (busy) return;
    setBusy(true);
    try {
      nextCard();
    } finally {
      setBusy(false);
    }
  };

  const onLike = async () => {
    if (busy) return;
    if (!user?.id || !current?.id) return;

    setBusy(true);
    try {
      const { error: insErr } = await supabase.from("swipes").insert({
        swiper_id: user.id,
        swiped_id: current.id,
        direction: "like",
      });

      if (insErr) throw insErr;

      // Remove from local list too
      setCandidates((prev) => prev.filter((p) => p.id !== current.id));
      setIndex((i) => Math.max(0, Math.min(i, candidates.length - 2)));
    } catch (e: any) {
      Alert.alert("Like failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const onBlock = async () => {
    if (busy) return;
    if (!user?.id || !current?.id) return;

    setBusy(true);
    try {
      const { error: insErr } = await supabase.from("blocks").insert({
        blocker_id: user.id,
        blocked_id: current.id,
      });

      if (insErr) throw insErr;

      setCandidates((prev) => prev.filter((p) => p.id !== current.id));
      setIndex((i) => Math.max(0, Math.min(i, candidates.length - 2)));
    } catch (e: any) {
      Alert.alert("Block failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const name = current?.display_name?.trim() || "Anonymous";
  const location =
    current?.city && current?.state
      ? `${current.city}, ${current.state}`
      : current?.city
      ? current.city
      : current?.state
      ? current.state
      : "";

  const seeking = (current?.seeking ?? []).filter(Boolean).slice(0, 4).join(" • ");

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 8, paddingHorizontal: 6 }}>
          <Text style={{ fontWeight: "900" }}>← Back</Text>
        </Pressable>

        <Pressable
          onPress={load}
          style={{ paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10 }}
          disabled={loading || busy}
        >
          <Text style={{ fontWeight: "900" }}>{loading ? "…" : "Refresh"}</Text>
        </Pressable>
      </View>

      <Text style={{ fontSize: 20, fontWeight: "900" }}>Swipe</Text>
      <Text style={{ opacity: 0.75 }}>
        Like saves. Pass does not save — so profiles can show again.
      </Text>

      {loading && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
          <ActivityIndicator />
          <Text style={{ opacity: 0.8 }}>Loading candidates…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={{ borderWidth: 1, borderColor: "#f2caca", padding: 12, borderRadius: 12, gap: 8 }}>
          <Text style={{ fontWeight: "900" }}>Couldn’t load</Text>
          <Text style={{ opacity: 0.85 }}>{error}</Text>
          <Pressable
            onPress={load}
            style={{ paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ fontWeight: "900" }}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && !current && (
        <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
          <Text style={{ fontWeight: "900", fontSize: 16 }}>No more profiles right now.</Text>
          <Text style={{ opacity: 0.8 }}>
            Make another test user, complete onboarding, then hit Refresh.
          </Text>
          <Pressable
            onPress={load}
            style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#111", alignItems: "center" }}
          >
            <Text style={{ fontWeight: "900" }}>Refresh</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && current && (
        <>
          <View
            style={{
              borderWidth: 1,
              borderColor: "#e6e6e6",
              borderRadius: 18,
              padding: 16,
              gap: 8,
              flex: 1,
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "900" }}>{name}</Text>
            {!!location && <Text style={{ opacity: 0.8 }}>{location}</Text>}
            {!!current.relationship_style && (
              <Text style={{ opacity: 0.85 }}>Style: {current.relationship_style}</Text>
            )}
            {!!seeking && <Text style={{ opacity: 0.85 }}>Seeking: {seeking}</Text>}
            {!!current.bio && (
              <Text style={{ opacity: 0.9 }} numberOfLines={5}>
                {current.bio}
              </Text>
            )}

            <Pressable
              onPress={() => router.push(`/profile/${current.id}`)}
              style={{
                marginTop: 10,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#999",
                alignItems: "center",
              }}
              disabled={busy}
            >
              <Text style={{ fontWeight: "900" }}>View Profile</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={onPass}
              disabled={busy}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#999",
                alignItems: "center",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text style={{ fontWeight: "900" }}>Pass</Text>
            </Pressable>

            <Pressable
              onPress={onLike}
              disabled={busy}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#111",
                alignItems: "center",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text style={{ fontWeight: "900" }}>Like</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onBlock}
            disabled={busy}
            style={{
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#f0b3b3",
              alignItems: "center",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ fontWeight: "900" }}>Block</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
