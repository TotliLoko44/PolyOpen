import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Buffer } from "buffer";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";

(globalThis as any).Buffer = (globalThis as any).Buffer ?? Buffer;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase env variables. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

const isStaticWebRender =
  Platform.OS === "web" && typeof window === "undefined";

const staticWebStorage = {
  async getItem(_key: string) {
    return null;
  },
  async setItem(_key: string, _value: string) {
    return;
  },
  async removeItem(_key: string) {
    return;
  },
};

const authStorage = isStaticWebRender ? staticWebStorage : AsyncStorage;

export const supabase = createClient(
  supabaseUrl ?? "https://missing-project.supabase.co",
  supabaseAnonKey ?? "missing-anon-key",
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: !isStaticWebRender,
      persistSession: !isStaticWebRender,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  },
);
