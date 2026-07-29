import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { ensureProfileRow, getHasOnboarded } from "../lib/profile";

type NextHref = "/login" | "/onboarding" | "/(tabs)/browse";

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function BootScreen({ bootError }: { bootError: string | null }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 24,
      }}
    >
      <Image
        source={require("../assets/images/polyopen-logo.png")}
        style={{
          width: 140,
          height: 140,
          marginBottom: 22,
        }}
        resizeMode="contain"
      />

      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: "#111111",
          textAlign: "center",
          marginBottom: 18,
        }}
      >
        Ethical love~Open spirituality
      </Text>

      <ActivityIndicator size="small" color="#111111" />

      <Text
        style={{
          marginTop: 14,
          color: "#666666",
          textAlign: "center",
          fontSize: 14,
          lineHeight: 20,
        }}
      >
        {bootError || "Opening your space..."}
      </Text>
    </View>
  );
}

export default function Index() {
  const { userId, isLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [nextHref, setNextHref] = useState<NextHref>("/login");
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function decide() {
      if (isLoading) return;

      setReady(false);
      setBootError(null);

      if (!userId) {
        if (!alive) return;
        setNextHref("/login");
        setReady(true);
        return;
      }

      try {
        try {
          await withTimeout(ensureProfileRow(userId), 20000, "Profile setup");
        } catch {
          if (!alive) return;
          setBootError("Profile setup is taking longer than expected...");
        }

        const hasOnboarded = await withTimeout(
          getHasOnboarded(userId),
          20000,
          "Onboarding check"
        );

        if (!alive) return;

        setBootError(null);
        setNextHref(hasOnboarded ? "/(tabs)/browse" : "/onboarding");
      } catch {
        if (!alive) return;

        setBootError("Could not load your account. Sending you to login.");
        setNextHref("/login");
      } finally {
        if (alive) {
          setReady(true);
        }
      }
    }

    decide();

    return () => {
      alive = false;
    };
  }, [userId, isLoading]);

  if (isLoading || !ready) {
    return <BootScreen bootError={bootError} />;
  }

  return <Redirect href={nextHref} />;
}