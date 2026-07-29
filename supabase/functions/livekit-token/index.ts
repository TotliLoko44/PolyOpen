import { AccessToken } from "npm:livekit-server-sdk@2.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SpeedDatingSession = {
  id: string;
  participant_one_id: string;
  participant_two_id: string;
  status: string;
  livekit_room_name: string | null;
  ends_at: string | null;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

function readBearerToken(
  request: Request,
): string {
  const authorization =
    request.headers.get("Authorization") ?? "";

  return authorization
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function loadAuthenticatedUser(
  supabaseUrl: string,
  supabaseAnonKey: string,
  jwt: string,
): Promise<{ id: string }> {
  const response = await fetch(
    `${supabaseUrl}/auth/v1/user`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: supabaseAnonKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      "AUTHENTICATION_FAILED",
    );
  }

  const user = await response.json();
  const userId = String(user?.id ?? "").trim();

  if (!userId) {
    throw new Error(
      "AUTHENTICATED_USER_ID_MISSING",
    );
  }

  return {
    id: userId,
  };
}

async function loadSpeedDatingSession(
  supabaseUrl: string,
  serviceRoleKey: string,
  sessionId: string,
): Promise<SpeedDatingSession | null> {
  const encodedSessionId =
    encodeURIComponent(sessionId);

  const response = await fetch(
    `${supabaseUrl}/rest/v1/speed_dating_sessions` +
      `?id=eq.${encodedSessionId}` +
      "&select=id,participant_one_id,participant_two_id,status,livekit_room_name,ends_at" +
      "&limit=1",
    {
      headers: {
        Authorization:
          `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      "SESSION_LOOKUP_FAILED",
    );
  }

  const rows =
    await response.json() as SpeedDatingSession[];

  return rows[0] ?? null;
}

function sessionAllowsVideo(
  status: string,
): boolean {
  return [
    "matched",
    "connecting",
    "active",
    "decision",
    "continued",
  ].includes(status);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      },
    );
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    const livekitApiKey =
      Deno.env.get("LIVEKIT_API_KEY");

    const livekitApiSecret =
      Deno.env.get("LIVEKIT_API_SECRET");

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (
      !livekitApiKey ||
      !livekitApiSecret
    ) {
      return jsonResponse(
        {
          error:
            "LiveKit server credentials are not configured.",
        },
        500,
      );
    }

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      return jsonResponse(
        {
          error:
            "Supabase Edge Function credentials are not configured.",
        },
        500,
      );
    }

    const jwt =
      readBearerToken(request);

    if (!jwt) {
      return jsonResponse(
        {
          error:
            "Authentication is required.",
        },
        401,
      );
    }

    const body =
      await request.json();

    const sessionId =
      String(
        body?.sessionId ?? "",
      ).trim();

    if (!sessionId) {
      return jsonResponse(
        {
          error:
            "A Speed Dating session ID is required.",
        },
        400,
      );
    }

    const user =
      await loadAuthenticatedUser(
        supabaseUrl,
        supabaseAnonKey,
        jwt,
      );

    const session =
      await loadSpeedDatingSession(
        supabaseUrl,
        serviceRoleKey,
        sessionId,
      );

    if (!session) {
      return jsonResponse(
        {
          error:
            "Speed Dating session not found.",
        },
        404,
      );
    }

    const isParticipant =
      session.participant_one_id ===
        user.id ||
      session.participant_two_id ===
        user.id;

    if (!isParticipant) {
      return jsonResponse(
        {
          error:
            "You are not authorized to join this Speed Dating room.",
        },
        403,
      );
    }

    if (
      !sessionAllowsVideo(
        session.status,
      )
    ) {
      return jsonResponse(
        {
          error:
            "This Speed Dating session is no longer available for video.",
        },
        409,
      );
    }

    const roomName =
      String(
        session.livekit_room_name ?? "",
      ).trim();

    if (!roomName) {
      return jsonResponse(
        {
          error:
            "The Speed Dating video room has not been prepared.",
        },
        409,
      );
    }

    const token = new AccessToken(
      livekitApiKey,
      livekitApiSecret,
      {
        identity: user.id,
        ttl: "15m",
        metadata: JSON.stringify({
          feature: "speed-dating",
          sessionId: session.id,
        }),
      },
    );

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      roomAdmin: false,
      roomCreate: false,
      roomList: false,
      roomRecord: false,
    });

    const livekitToken =
      await token.toJwt();

    return jsonResponse({
      token: livekitToken,
      identity: user.id,
      sessionId: session.id,
      roomName,
      expiresInSeconds: 900,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";

    if (
      message ===
        "AUTHENTICATION_FAILED" ||
      message ===
        "AUTHENTICATED_USER_ID_MISSING"
    ) {
      return jsonResponse(
        {
          error:
            "PolyOpen authentication could not be verified.",
        },
        401,
      );
    }

    if (
      message ===
      "SESSION_LOOKUP_FAILED"
    ) {
      return jsonResponse(
        {
          error:
            "PolyOpen could not verify the Speed Dating session.",
        },
        502,
      );
    }

    console.error(
      "livekit-token error",
      message,
    );

    return jsonResponse(
      {
        error:
          "PolyOpen could not prepare the video room.",
      },
      500,
    );
  }
});
