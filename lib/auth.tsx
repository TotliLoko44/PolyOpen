import type { Session } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LogBox } from "react-native";
import {
  clearPushTokenForUser,
  registerForPushNotificationsAsync,
  syncPushTokenForUser,
} from "./push";
import { supabase } from "./supabase";

type AuthCtx = {
  session: Session | null;
  userId: string | null;
  isLoading: boolean;
  expoPushToken: string | null;
  refreshPushToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

function isRefreshTokenError(message?: string | null) {
  const msg = (message || "").toLowerCase();
  return (
    msg.includes("refresh token") ||
    msg.includes("invalid refresh token") ||
    msg.includes("already used")
  );
}

const MIN_BOOT_SPLASH_MS = 650;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useEffect(() => {
    LogBox.ignoreLogs([
      "AuthApiError: Invalid Refresh Token",
      "Invalid Refresh Token: Already Used",
    ]);
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootStartedAt = Date.now();

    async function finishBoot() {
      const elapsed = Date.now() - bootStartedAt;
      const remaining = Math.max(0, MIN_BOOT_SPLASH_MS - elapsed);

      await new Promise((resolve) => setTimeout(resolve, remaining));

      if (mounted) {
        setIsLoading(false);
      }
    }

    async function clearBrokenSession() {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore on purpose
      }
      if (mounted) {
        setSession(null);
        setExpoPushToken(null);
      }
    }

    async function boot() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          if (isRefreshTokenError(error.message)) {
            await clearBrokenSession();
          } else if (mounted) {
            setSession(null);
          }
        } else if (mounted) {
          setSession(data.session ?? null);
        }
      } catch (error: any) {
        if (isRefreshTokenError(error?.message)) {
          await clearBrokenSession();
        } else if (mounted) {
          setSession(null);
        }
      } finally {
        await finishBoot();
      }
    }

    boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession ?? null);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setupPush() {
      const currentUserId = session?.user?.id;
      if (!currentUserId) {
        setExpoPushToken(null);
        return;
      }

      const token = await registerForPushNotificationsAsync();
      if (cancelled) return;

      setExpoPushToken(token);

      if (token) {
        await syncPushTokenForUser(currentUserId, token);
      }
    }

    setupPush();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      userId: session?.user?.id ?? null,
      isLoading,
      expoPushToken,
      refreshPushToken: async () => {
        const currentUserId = session?.user?.id ?? null;
        if (!currentUserId) return null;

        const token = await registerForPushNotificationsAsync();
        setExpoPushToken(token);

        if (token) {
          await syncPushTokenForUser(currentUserId, token);
        }

        return token;
      },
      signOut: async () => {
        const currentUserId = session?.user?.id ?? null;

        try {
          if (currentUserId) {
            await clearPushTokenForUser(currentUserId);
          }

          await supabase.auth.signOut();
        } catch (error: any) {
          if (isRefreshTokenError(error?.message)) {
            try {
              await supabase.auth.signOut({ scope: "local" });
            } catch {
              // ignore
            }
          }
        } finally {
          setSession(null);
          setExpoPushToken(null);
        }
      },
    }),
    [session, isLoading, expoPushToken]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}