import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

import { supabase } from "./supabase";

export type RemoteQueueStatus =
  | "idle"
  | "waiting"
  | "matched"
  | "cancelled"
  | "expired";

export type RemoteSessionStatus =
  | "matched"
  | "connecting"
  | "active"
  | "decision"
  | "continued"
  | "passed"
  | "ended"
  | "cancelled";

export type SpeedDatingDecision = "continue" | "pass";

export type SpeedDatingMatchResult = {
  status: RemoteQueueStatus;
  scope?: string;
  userId?: string;
  sessionId?: string;
  partnerId?: string;
  sessionStatus?: RemoteSessionStatus;
  livekitRoomName?: string;
};

export type SpeedDatingStartResult = {
  status: RemoteSessionStatus;
  sessionId: string;
  startedAt: string;
  endsAt: string;
  livekitRoomName?: string;
};

export type SpeedDatingDecisionResult = {
  status:
    | "mutual-continue"
    | "waiting-for-partner"
    | "passed"
    | "decision-recorded";
  sessionId: string;
  yourDecision: SpeedDatingDecision;
  partnerDecision: SpeedDatingDecision | null;
  chatUnlocked: boolean;
};

export type QueueCancellationResult = {
  status: "cancelled";
  updated: boolean;
};

export type SpeedDatingHeartbeatResult = {
  status: RemoteSessionStatus;
  sessionId: string;
  endsAt: string | null;
  serverTime: string;
};

export type SpeedDatingRecoveryResult = {
  status: "idle" | "recovered";
  sessionId?: string;
  sessionStatus?: RemoteSessionStatus;
  partnerId?: string;
  scope?: string;
  startedAt?: string | null;
  endsAt?: string | null;
  livekitRoomName?: string | null;
};

export type SpeedDatingLeaveResult = {
  status: RemoteSessionStatus;
  sessionId: string;
  reason: string;
};

export type SpeedDatingCleanupResult = {
  status: "cleaned";
  expiredQueueCount: number;
  expiredActiveCount: number;
  cancelledOrphanCount: number;
};

export type SpeedDatingSessionRow = {
  id: string;
  participant_one_id: string;
  participant_two_id: string;
  scope: string;
  status: RemoteSessionStatus;
  livekit_room_name: string | null;
  started_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SpeedDatingDecisionRow = {
  id: string;
  session_id: string;
  user_id: string;
  decision: SpeedDatingDecision;
  created_at: string;
  updated_at: string;
};

export type SpeedDatingChatUnlockRow = {
  id: string;
  session_id: string;
  participant_one_id: string;
  participant_two_id: string;
  unlocked_at: string;
};

export type AuthenticatedSpeedDatingUser = {
  id: string;
};

type SessionChangeHandler = (
  session: SpeedDatingSessionRow,
) => void;

type DecisionChangeHandler = (
  decision: SpeedDatingDecisionRow,
) => void;

type ChatUnlockHandler = (
  unlock: SpeedDatingChatUnlockRow,
) => void;

function normalizeScope(scope: string): string {
  const normalized = scope.trim();

  if (!normalized) {
    throw new Error(
      "Choose a Speed Dating pool before joining.",
    );
  }

  if (normalized.length > 80) {
    throw new Error(
      "Speed Dating pool must be 80 characters or fewer.",
    );
  }

  return normalized;
}

function ensureSessionId(sessionId: string): string {
  const normalized = sessionId.trim();

  if (!normalized) {
    throw new Error(
      "A valid Speed Dating session is required.",
    );
  }

  return normalized;
}

export async function getAuthenticatedSpeedDatingUser(): Promise<AuthenticatedSpeedDatingUser> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to verify your PolyOpen account.",
    );
  }

  if (!user) {
    throw new Error(
      "You must be signed into PolyOpen to use Speed Dating.",
    );
  }

  return {
    id: user.id,
  };
}

export async function joinRemoteSpeedDatingQueue(
  scope: string,
): Promise<SpeedDatingMatchResult> {
  await getAuthenticatedSpeedDatingUser();

  const normalizedScope = normalizeScope(scope);

  const { data, error } = await supabase.rpc(
    "join_speed_dating_queue",
    {
      requested_scope: normalizedScope,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to join the Speed Dating queue.",
    );
  }

  return data as SpeedDatingMatchResult;
}

export async function getRemoteSpeedDatingMatch(): Promise<SpeedDatingMatchResult> {
  await getAuthenticatedSpeedDatingUser();

  const { data, error } = await supabase.rpc(
    "get_speed_dating_match",
  );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to check your Speed Dating match.",
    );
  }

  return data as SpeedDatingMatchResult;
}

export async function cancelRemoteSpeedDatingQueue(): Promise<QueueCancellationResult> {
  await getAuthenticatedSpeedDatingUser();

  const { data, error } = await supabase.rpc(
    "cancel_speed_dating_queue",
  );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to leave the Speed Dating queue.",
    );
  }

  return data as QueueCancellationResult;
}

export async function startRemoteSpeedDatingSession(
  sessionId: string,
): Promise<SpeedDatingStartResult> {
  await getAuthenticatedSpeedDatingUser();

  const normalizedSessionId = ensureSessionId(sessionId);

  const { data, error } = await supabase.rpc(
    "start_speed_dating_session",
    {
      requested_session_id: normalizedSessionId,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to start the Speed Date.",
    );
  }

  return data as SpeedDatingStartResult;
}

export async function submitRemoteSpeedDatingDecision(
  sessionId: string,
  decision: SpeedDatingDecision,
): Promise<SpeedDatingDecisionResult> {
  await getAuthenticatedSpeedDatingUser();

  const normalizedSessionId = ensureSessionId(sessionId);

  if (
    decision !== "continue" &&
    decision !== "pass"
  ) {
    throw new Error(
      "Decision must be Continue or Pass.",
    );
  }

  const { data, error } = await supabase.rpc(
    "submit_speed_dating_decision",
    {
      requested_session_id: normalizedSessionId,
      requested_decision: decision,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to save your private decision.",
    );
  }

  return data as SpeedDatingDecisionResult;
}

export async function cleanupRemoteSpeedDatingState(): Promise<SpeedDatingCleanupResult> {
  await getAuthenticatedSpeedDatingUser();

  const { data, error } = await supabase.rpc(
    "cleanup_speed_dating_state",
  );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to clean up Speed Dating state.",
    );
  }

  return data as SpeedDatingCleanupResult;
}

export async function heartbeatRemoteSpeedDatingSession(
  sessionId: string,
): Promise<SpeedDatingHeartbeatResult> {
  await getAuthenticatedSpeedDatingUser();

  const normalizedSessionId =
    ensureSessionId(sessionId);

  const { data, error } = await supabase.rpc(
    "heartbeat_speed_dating_session",
    {
      requested_session_id:
        normalizedSessionId,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to keep the Speed Date connected.",
    );
  }

  return data as SpeedDatingHeartbeatResult;
}

export async function recoverRemoteSpeedDatingSession(): Promise<SpeedDatingRecoveryResult> {
  await getAuthenticatedSpeedDatingUser();

  const { data, error } = await supabase.rpc(
    "recover_speed_dating_session",
  );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to recover the previous Speed Date.",
    );
  }

  return data as SpeedDatingRecoveryResult;
}

export async function leaveRemoteSpeedDatingSession(
  sessionId: string,
  reason = "user-left",
): Promise<SpeedDatingLeaveResult> {
  await getAuthenticatedSpeedDatingUser();

  const normalizedSessionId =
    ensureSessionId(sessionId);

  const normalizedReason =
    reason.trim().slice(0, 80) ||
    "user-left";

  const { data, error } = await supabase.rpc(
    "leave_speed_dating_session",
    {
      requested_session_id:
        normalizedSessionId,
      requested_reason:
        normalizedReason,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to close the Speed Date safely.",
    );
  }

  return data as SpeedDatingLeaveResult;
}

export async function getRemoteSpeedDatingSession(
  sessionId: string,
): Promise<SpeedDatingSessionRow | null> {
  await getAuthenticatedSpeedDatingUser();

  const normalizedSessionId = ensureSessionId(sessionId);

  const { data, error } = await supabase
    .from("speed_dating_sessions")
    .select(
      [
        "id",
        "participant_one_id",
        "participant_two_id",
        "scope",
        "status",
        "livekit_room_name",
        "started_at",
        "ends_at",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("id", normalizedSessionId)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to load the Speed Date.",
    );
  }

  return data as SpeedDatingSessionRow | null;
}

export async function getSpeedDatingDecisions(
  sessionId: string,
): Promise<SpeedDatingDecisionRow[]> {
  await getAuthenticatedSpeedDatingUser();

  const normalizedSessionId = ensureSessionId(sessionId);

  const { data, error } = await supabase
    .from("speed_dating_decisions")
    .select(
      [
        "id",
        "session_id",
        "user_id",
        "decision",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("session_id", normalizedSessionId);

  if (error) {
    throw new Error(
      error.message ||
        "Unable to load Speed Dating decisions.",
    );
  }

  return (data ?? []) as unknown as SpeedDatingDecisionRow[];
}

export async function isSpeedDatingChatUnlocked(
  sessionId: string,
): Promise<boolean> {
  await getAuthenticatedSpeedDatingUser();

  const normalizedSessionId = ensureSessionId(sessionId);

  const { data, error } = await supabase
    .from("speed_dating_chat_unlocks")
    .select("id")
    .eq("session_id", normalizedSessionId)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to check the chat unlock.",
    );
  }

  return Boolean(data);
}

export function subscribeToSpeedDatingSession(
  sessionId: string,
  handlers: {
    onSessionChange?: SessionChangeHandler;
    onDecisionChange?: DecisionChangeHandler;
    onChatUnlock?: ChatUnlockHandler;
    onStatusChange?: (
      status:
        | "SUBSCRIBED"
        | "TIMED_OUT"
        | "CLOSED"
        | "CHANNEL_ERROR",
    ) => void;
    onError?: (message: string) => void;
  },
): RealtimeChannel {
  const normalizedSessionId = ensureSessionId(sessionId);

  const channel = supabase.channel(
    `polyopen-speed-date:${normalizedSessionId}`,
  );

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "speed_dating_sessions",
      filter: `id=eq.${normalizedSessionId}`,
    },
    (
      payload: RealtimePostgresChangesPayload<SpeedDatingSessionRow>,
    ) => {
      if (
        payload.new &&
        handlers.onSessionChange
      ) {
        handlers.onSessionChange(
          payload.new as SpeedDatingSessionRow,
        );
      }
    },
  );

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "speed_dating_decisions",
      filter: `session_id=eq.${normalizedSessionId}`,
    },
    (
      payload: RealtimePostgresChangesPayload<SpeedDatingDecisionRow>,
    ) => {
      if (
        payload.new &&
        handlers.onDecisionChange
      ) {
        handlers.onDecisionChange(
          payload.new as SpeedDatingDecisionRow,
        );
      }
    },
  );

  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "speed_dating_chat_unlocks",
      filter: `session_id=eq.${normalizedSessionId}`,
    },
    (
      payload: RealtimePostgresChangesPayload<SpeedDatingChatUnlockRow>,
    ) => {
      if (
        payload.new &&
        handlers.onChatUnlock
      ) {
        handlers.onChatUnlock(
          payload.new as SpeedDatingChatUnlockRow,
        );
      }
    },
  );

  channel.subscribe((status, error) => {
    handlers.onStatusChange?.(
      status,
    );

    if (
      status === "CHANNEL_ERROR" ||
      status === "TIMED_OUT"
    ) {
      handlers.onError?.(
        error?.message ||
          "The real-time Speed Date connection was interrupted.",
      );
    }
  });

  return channel;
}

export async function unsubscribeFromSpeedDatingSession(
  channel: RealtimeChannel | null | undefined,
): Promise<void> {
  if (!channel) {
    return;
  }

  await supabase.removeChannel(channel);
}
