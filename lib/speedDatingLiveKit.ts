import { supabase } from "./supabase";

export type SpeedDatingLiveKitCredentials = {
  token: string;
  identity: string;
  sessionId: string;
  roomName: string;
  serverUrl: string;
  expiresInSeconds: number;
};

type LiveKitTokenResponse = {
  token?: unknown;
  identity?: unknown;
  sessionId?: unknown;
  roomName?: unknown;
  expiresInSeconds?: unknown;
  error?: unknown;
};

function requireLiveKitServerUrl(): string {
  const value =
    process.env
      .EXPO_PUBLIC_LIVEKIT_URL
      ?.trim();

  if (!value) {
    throw new Error(
      "PolyOpen LiveKit server URL is not configured.",
    );
  }

  if (
    !value.startsWith("wss://") &&
    !value.startsWith("ws://")
  ) {
    throw new Error(
      "PolyOpen LiveKit server URL must begin with wss:// or ws://.",
    );
  }

  return value;
}

function ensureSessionId(
  sessionId: string,
): string {
  const normalized =
    sessionId.trim();

  if (!normalized) {
    throw new Error(
      "A Speed Dating session is required for video.",
    );
  }

  return normalized;
}

export async function requestSpeedDatingLiveKitCredentials(
  sessionId: string,
): Promise<SpeedDatingLiveKitCredentials> {
  const normalizedSessionId =
    ensureSessionId(sessionId);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(
      sessionError.message ||
        "PolyOpen could not verify your sign-in session.",
    );
  }

  if (!session?.access_token) {
    throw new Error(
      "You must be signed into PolyOpen to join Speed Dating video.",
    );
  }

  const {
    data,
    error,
  } = await supabase.functions.invoke<
    LiveKitTokenResponse
  >(
    "livekit-token",
    {
      body: {
        sessionId:
          normalizedSessionId,
      },
      headers: {
        Authorization:
          `Bearer ${session.access_token}`,
      },
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        "PolyOpen could not request the video-room token.",
    );
  }

  if (
    data?.error &&
    typeof data.error === "string"
  ) {
    throw new Error(data.error);
  }

  const token =
    typeof data?.token === "string"
      ? data.token
      : "";

  const identity =
    typeof data?.identity === "string"
      ? data.identity
      : "";

  const responseSessionId =
    typeof data?.sessionId === "string"
      ? data.sessionId
      : "";

  const roomName =
    typeof data?.roomName === "string"
      ? data.roomName
      : "";

  const expiresInSeconds =
    typeof data?.expiresInSeconds ===
    "number"
      ? data.expiresInSeconds
      : 900;

  if (
    !token ||
    !identity ||
    !responseSessionId ||
    !roomName
  ) {
    throw new Error(
      "PolyOpen received an incomplete LiveKit token response.",
    );
  }

  if (
    responseSessionId !==
    normalizedSessionId
  ) {
    throw new Error(
      "The LiveKit token response did not match the requested Speed Dating session.",
    );
  }

  return {
    token,
    identity,
    sessionId:
      responseSessionId,
    roomName,
    serverUrl:
      requireLiveKitServerUrl(),
    expiresInSeconds,
  };
}
