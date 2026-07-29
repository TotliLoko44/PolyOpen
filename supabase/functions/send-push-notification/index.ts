import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type NotificationPayload = {
  type: "INSERT";
  table: "notifications";
  record: {
    id: string;
    user_id: string;
    actor_id?: string | null;
    type: string;
    title: string;
    body?: string | null;
    data?: Record<string, unknown> | null;
    read_at?: string | null;
    created_at: string;
  };
  schema: "public";
  old_record: null;
};

type PushTokenRow = {
  expo_push_token: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// ✅ FIXED HERE
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";

async function getPushTokens(userId: string): Promise<string[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return [];

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/push_tokens?user_id=eq.${userId}&select=expo_push_token`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    console.log("PUSH TOKEN LOOKUP FAILED:", await response.text());
    return [];
  }

  const rows = (await response.json()) as PushTokenRow[];

  return rows
    .map((row) => row.expo_push_token)
    .filter(
      (token) =>
        typeof token === "string" && token.startsWith("ExponentPushToken")
    );
}

async function sendExpoPush(params: {
  tokens: string[];
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
}) {
  if (params.tokens.length === 0) return;

  const messages = params.tokens.map((token) => ({
    to: token,
    sound: "default",
    title: params.title,
    body: params.body ?? "",
    data: params.data ?? {},
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const result = await response.text();

  if (!response.ok) {
    console.log("EXPO PUSH FAILED:", result);
    return;
  }

  console.log("EXPO PUSH SENT:", result);
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const payload = (await req.json()) as NotificationPayload;
    const notification = payload.record;

    if (!notification?.user_id) {
      return Response.json(
        { ok: false, reason: "Missing user_id" },
        { status: 400 }
      );
    }

    const tokens = await getPushTokens(notification.user_id);

    await sendExpoPush({
      tokens,
      title: notification.title || "PolyOpen",
      body: notification.body ?? "",
      data: {
        notificationId: notification.id,
        type: notification.type,
        ...(notification.data ?? {}),
      },
    });

    return Response.json({
      ok: true,
      sentTo: tokens.length,
    });
  } catch (error) {
    console.log("SEND PUSH FUNCTION ERROR:", error);
    return Response.json(
      {
        ok: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
});