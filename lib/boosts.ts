import { supabase } from "./supabase";

export type BoostWallet = {
  boost_credits: number;
  boost_active: boolean;
  boost_started_at: string | null;
  boost_expires_at: string | null;
};

export type VerificationStatus =
  | "not_verified"
  | "pending"
  | "approved"
  | "rejected";

export function getBoostCreditsForProduct(productId: string) {
  const cleanProductId = productId.trim().toLowerCase();

  if (
    cleanProductId === "boost1" ||
    cleanProductId === "boost_1" ||
    cleanProductId.includes("boost1") ||
    cleanProductId.includes("boost_1")
  ) {
    return 1;
  }

  if (
    cleanProductId === "boost3" ||
    cleanProductId === "boost_3" ||
    cleanProductId.includes("boost3") ||
    cleanProductId.includes("boost_3")
  ) {
    return 3;
  }

  if (
    cleanProductId === "boost10" ||
    cleanProductId === "boost_10" ||
    cleanProductId.includes("boost10") ||
    cleanProductId.includes("boost_10")
  ) {
    return 10;
  }

  return 0;
}

export function getBoostHoursForProduct(productId: string) {
  const cleanProductId = productId.trim().toLowerCase();

  if (
    cleanProductId === "boost1" ||
    cleanProductId === "boost_1" ||
    cleanProductId.includes("boost1") ||
    cleanProductId.includes("boost_1") ||
    cleanProductId.includes("1hour") ||
    cleanProductId.includes("1_hour") ||
    cleanProductId.includes("hour1")
  ) {
    return 1;
  }

  if (
    cleanProductId === "boost3" ||
    cleanProductId === "boost_3" ||
    cleanProductId.includes("boost3") ||
    cleanProductId.includes("boost_3") ||
    cleanProductId.includes("3hour") ||
    cleanProductId.includes("3_hour") ||
    cleanProductId.includes("hour3")
  ) {
    return 3;
  }

  if (
    cleanProductId === "boost10" ||
    cleanProductId === "boost_10" ||
    cleanProductId.includes("boost10") ||
    cleanProductId.includes("boost_10") ||
    cleanProductId.includes("10hour") ||
    cleanProductId.includes("10_hour") ||
    cleanProductId.includes("hour10")
  ) {
    return 10;
  }

  return 0;
}

export function isVerificationProduct(productId: string) {
  const cleanProductId = productId.trim().toLowerCase();

  return (
    cleanProductId === "verification" ||
    cleanProductId === "gold_verification" ||
    cleanProductId === "verified" ||
    cleanProductId.includes("verification") ||
    cleanProductId.includes("goldverify") ||
    cleanProductId.includes("gold_verify") ||
    cleanProductId.includes("verified")
  );
}

export function isBoostStillActive(expiresAt?: string | null) {
  if (!expiresAt) return false;

  const expires = new Date(expiresAt).getTime();
  return !Number.isNaN(expires) && expires > Date.now();
}

function normalizeBoostWallet(
  row: Partial<BoostWallet> | null | undefined
): BoostWallet {
  return {
    boost_credits: Number(row?.boost_credits ?? 0),
    boost_active: Boolean(row?.boost_active),
    boost_started_at: row?.boost_started_at ?? null,
    boost_expires_at: row?.boost_expires_at ?? null,
  };
}

async function syncProfileBoostState(
  userId: string,
  boostActive: boolean,
  startedAt: string | null,
  expiresAt: string | null
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      boost_active: boostActive,
      boost_started_at: startedAt,
      boost_expires_at: expiresAt,
    })
    .eq("id", userId);

  if (error) {
    console.log("PROFILE BOOST SYNC WARNING:", error.message);
  }
}

export async function activateGoldVerification(userId: string) {
  if (!userId) {
    throw new Error("You must be signed in to activate verification.");
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      is_verified: true,
      verification_tier: "gold",
      verification_status: "approved",
      verification_submitted_at: now,
      verification_approved_at: now,
    })
    .eq("id", userId);

  if (error) throw error;

  return {
    is_verified: true,
    verification_tier: "gold",
    verification_status: "approved" as VerificationStatus,
    verification_submitted_at: now,
    verification_approved_at: now,
  };
}

export async function markGoldVerificationPending(userId: string) {
  if (!userId) {
    throw new Error("You must be signed in to start verification.");
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      is_verified: false,
      verification_tier: "gold",
      verification_status: "pending",
      verification_submitted_at: now,
      verification_approved_at: null,
    })
    .eq("id", userId);

  if (error) throw error;

  return {
    is_verified: false,
    verification_tier: "gold",
    verification_status: "pending" as VerificationStatus,
    verification_submitted_at: now,
    verification_approved_at: null,
  };
}

export async function ensureBoostWallet(userId: string): Promise<BoostWallet> {
  if (!userId) {
    return {
      boost_credits: 0,
      boost_active: false,
      boost_started_at: null,
      boost_expires_at: null,
    };
  }

  const { data, error } = await supabase
    .from("user_boosts")
    .select("boost_credits, boost_active, boost_started_at, boost_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    const wallet = normalizeBoostWallet(data);
    const active = isBoostStillActive(wallet.boost_expires_at);

    if (wallet.boost_active && !active) {
      await supabase
        .from("user_boosts")
        .update({
          boost_active: false,
          boost_started_at: wallet.boost_started_at,
          boost_expires_at: wallet.boost_expires_at,
        })
        .eq("user_id", userId);

      await syncProfileBoostState(
        userId,
        false,
        wallet.boost_started_at,
        wallet.boost_expires_at
      );

      return {
        ...wallet,
        boost_active: false,
      };
    }

    await syncProfileBoostState(
      userId,
      active,
      wallet.boost_started_at,
      wallet.boost_expires_at
    );

    return {
      ...wallet,
      boost_active: active,
    };
  }

  const { data: created, error: createError } = await supabase
    .from("user_boosts")
    .upsert(
      {
        user_id: userId,
        boost_credits: 0,
        boost_active: false,
        boost_started_at: null,
        boost_expires_at: null,
      },
      { onConflict: "user_id" }
    )
    .select("boost_credits, boost_active, boost_started_at, boost_expires_at")
    .maybeSingle();

  if (createError) throw createError;

  return normalizeBoostWallet(created);
}

export async function grantBoostCredits(userId: string, creditsToAdd: number) {
  if (!userId) {
    throw new Error("You must be signed in to receive boost credits.");
  }

  if (creditsToAdd <= 0) {
    return ensureBoostWallet(userId);
  }

  const wallet = await ensureBoostWallet(userId);
  const nextCredits = Number(wallet.boost_credits ?? 0) + creditsToAdd;

  const { data, error } = await supabase
    .from("user_boosts")
    .upsert(
      {
        user_id: userId,
        boost_credits: nextCredits,
        boost_active: wallet.boost_active,
        boost_started_at: wallet.boost_started_at,
        boost_expires_at: wallet.boost_expires_at,
      },
      { onConflict: "user_id" }
    )
    .select("boost_credits, boost_active, boost_started_at, boost_expires_at")
    .maybeSingle();

  if (error) throw error;

  return normalizeBoostWallet(data);
}

export async function activateBoostForHours(userId: string, hours: number) {
  if (!userId) {
    throw new Error("You must be signed in to activate a boost.");
  }

  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("Invalid boost duration.");
  }

  const wallet = await ensureBoostWallet(userId);

  const now = new Date();
  const existingExpires = wallet.boost_expires_at
    ? new Date(wallet.boost_expires_at)
    : null;

  const baseTime =
    existingExpires &&
    !Number.isNaN(existingExpires.getTime()) &&
    existingExpires.getTime() > now.getTime()
      ? existingExpires
      : now;

  const startedAt =
    wallet.boost_active && wallet.boost_started_at
      ? wallet.boost_started_at
      : now.toISOString();

  const expiresAt = new Date(baseTime.getTime() + hours * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("user_boosts")
    .upsert(
      {
        user_id: userId,
        boost_credits: wallet.boost_credits ?? 0,
        boost_active: true,
        boost_started_at: startedAt,
        boost_expires_at: expiresAt.toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("boost_credits, boost_active, boost_started_at, boost_expires_at")
    .maybeSingle();

  if (error) throw error;

  await syncProfileBoostState(
    userId,
    true,
    data?.boost_started_at ?? startedAt,
    data?.boost_expires_at ?? expiresAt.toISOString()
  );

  return {
    boost_credits: Number(data?.boost_credits ?? wallet.boost_credits ?? 0),
    boost_active: true,
    boost_started_at: data?.boost_started_at ?? startedAt,
    boost_expires_at: data?.boost_expires_at ?? expiresAt.toISOString(),
  };
}

export async function activateOneHourBoost(userId: string) {
  if (!userId) {
    throw new Error("You must be signed in to activate a boost.");
  }

  const wallet = await ensureBoostWallet(userId);

  if (wallet.boost_active && isBoostStillActive(wallet.boost_expires_at)) {
    return wallet;
  }

  if (wallet.boost_credits <= 0) {
    throw new Error("You need at least 1 boost credit to activate a boost.");
  }

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + 60 * 60 * 1000);
  const nextCredits = Math.max(0, wallet.boost_credits - 1);

  const { data, error } = await supabase
    .from("user_boosts")
    .upsert(
      {
        user_id: userId,
        boost_credits: nextCredits,
        boost_active: true,
        boost_started_at: startedAt.toISOString(),
        boost_expires_at: expiresAt.toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("boost_credits, boost_active, boost_started_at, boost_expires_at")
    .maybeSingle();

  if (error) throw error;

  await syncProfileBoostState(
    userId,
    true,
    data?.boost_started_at ?? startedAt.toISOString(),
    data?.boost_expires_at ?? expiresAt.toISOString()
  );

  return {
    boost_credits: Number(data?.boost_credits ?? nextCredits),
    boost_active: true,
    boost_started_at: data?.boost_started_at ?? startedAt.toISOString(),
    boost_expires_at: data?.boost_expires_at ?? expiresAt.toISOString(),
  };
}