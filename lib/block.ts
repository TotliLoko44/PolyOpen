import { supabase } from "./supabase";

/**
 * Returns all user IDs that should be hidden:
 * - users YOU blocked
 * - users who blocked YOU
 * - users YOU muted
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  try {
    const [
      { data: blocked },
      { data: blockedBy },
      { data: muted },
    ] = await Promise.all([
      supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", userId),

      supabase
        .from("user_blocks")
        .select("blocker_id")
        .eq("blocked_id", userId),

      supabase
        .from("muted_users")
        .select("muted_user_id")
        .eq("user_id", userId),
    ]);

    const blockedIds = (blocked ?? []).map(
      (item: any) => item.blocked_id
    );

    const blockedByIds = (blockedBy ?? []).map(
      (item: any) => item.blocker_id
    );

    const mutedIds = (muted ?? []).map(
      (item: any) => item.muted_user_id
    );

    return [
      ...new Set([
        ...blockedIds,
        ...blockedByIds,
        ...mutedIds,
      ]),
    ];
  } catch (error) {
    console.log("GET BLOCKED IDS ERROR:", error);
    return [];
  }
}

export async function isUserBlocked(
  currentUserId: string,
  targetUserId: string
) {
  try {
    const { data, error } = await supabase
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", currentUserId)
      .eq("blocked_id", targetUserId)
      .maybeSingle();

    if (error) throw error;

    return !!data;
  } catch (error) {
    console.log("IS USER BLOCKED ERROR:", error);
    return false;
  }
}

export async function blockUser(
  blockerId: string,
  blockedId: string
) {
  try {
    const { error } = await supabase
      .from("user_blocks")
      .upsert(
        {
          blocker_id: blockerId,
          blocked_id: blockedId,
        },
        {
          onConflict: "blocker_id,blocked_id",
        }
      );

    if (error) throw error;

    return {
      success: true,
    };
  } catch (error: any) {
    console.log("BLOCK USER ERROR:", error);

    return {
      success: false,
      error: error?.message ?? "Could not block user.",
    };
  }
}

export async function unblockUser(
  blockerId: string,
  blockedId: string
) {
  try {
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", blockerId)
      .eq("blocked_id", blockedId);

    if (error) throw error;

    return {
      success: true,
    };
  } catch (error: any) {
    console.log("UNBLOCK USER ERROR:", error);

    return {
      success: false,
      error: error?.message ?? "Could not unblock user.",
    };
  }
}

export async function isUserMuted(
  currentUserId: string,
  targetUserId: string
) {
  try {
    const { data, error } = await supabase
      .from("muted_users")
      .select("id")
      .eq("user_id", currentUserId)
      .eq("muted_user_id", targetUserId)
      .maybeSingle();

    if (error) throw error;

    return !!data;
  } catch (error) {
    console.log("IS USER MUTED ERROR:", error);
    return false;
  }
}

export async function muteUser(
  userId: string,
  mutedUserId: string
) {
  try {
    const { error } = await supabase
      .from("muted_users")
      .upsert(
        {
          user_id: userId,
          muted_user_id: mutedUserId,
        },
        {
          onConflict: "user_id,muted_user_id",
        }
      );

    if (error) throw error;

    return {
      success: true,
    };
  } catch (error: any) {
    console.log("MUTE USER ERROR:", error);

    return {
      success: false,
      error: error?.message ?? "Could not mute user.",
    };
  }
}

export async function unmuteUser(
  userId: string,
  mutedUserId: string
) {
  try {
    const { error } = await supabase
      .from("muted_users")
      .delete()
      .eq("user_id", userId)
      .eq("muted_user_id", mutedUserId);

    if (error) throw error;

    return {
      success: true,
    };
  } catch (error: any) {
    console.log("UNMUTE USER ERROR:", error);

    return {
      success: false,
      error: error?.message ?? "Could not unmute user.",
    };
  }
}

export async function reportUser(params: {
  reporterId: string;
  targetUserId: string;
  reason: string;
  details?: string;
}) {
  try {
    const { reporterId, targetUserId, reason, details } = params;

    const { error } = await supabase
      .from("user_reports")
      .insert({
        reporter_id: reporterId,
        target_user_id: targetUserId,
        reason,
        details: details ?? null,
      });

    if (error) throw error;

    return {
      success: true,
    };
  } catch (error: any) {
    console.log("REPORT USER ERROR:", error);

    return {
      success: false,
      error: error?.message ?? "Could not submit report.",
    };
  }
}