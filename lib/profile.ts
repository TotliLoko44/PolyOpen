import { supabase } from "./supabase";

export type Profile = {
  id: string;
  has_onboarded: boolean | null;
  display_name: string | null;
  relationship_style: string | null;
  bio: string | null;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  western_zodiac?: string | null;
  aztec_zodiac?: string | null;
  chinese_zodiac?: string | null;
  numerology_life_path?: number | null;
  spiritual_path?: string | null;
  likes_text?: string | null;
  hobbies?: string[] | null;
  orientation?: string | null;
  city?: string | null;
  state?: string | null;
  avatar_url?: string | null;
  profile_photo_url?: string | null;
  username?: string | null;
  relationship_styles?: string[] | null;
  spiritual_paths?: string[] | null;
  cover_photo_url?: string | null;
};

export type ProfileMediaItem = {
  id: string;
  user_id: string;
  media_url: string;
  sort_order: number;
  created_at?: string;
};

export const AZTEC_DAY_SIGNS = [
  "Crocodile",
  "Wind",
  "House",
  "Lizard",
  "Serpent",
  "Death",
  "Deer",
  "Rabbit",
  "Water",
  "Dog",
  "Monkey",
  "Grass",
  "Reed",
  "Jaguar",
  "Eagle",
  "Vulture",
  "Movement",
  "Flint",
  "Rain",
  "Flower",
];

const AZTEC_APP_CORRELATION_OFFSET = 10;

export function getWesternZodiac(month?: number | null, day?: number | null) {
  if (!month || !day) return "";

  const m = Number(month);
  const d = Number(day);

  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return "Aries";
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return "Taurus";
  if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return "Gemini";
  if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return "Cancer";
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return "Leo";
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return "Virgo";
  if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return "Libra";
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return "Scorpio";
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return "Sagittarius";
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return "Capricorn";
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return "Aquarius";
  if ((m === 2 && d >= 19) || (m === 3 && d <= 20)) return "Pisces";

  return "";
}

export function getAztecZodiac(
  year?: number | null,
  month?: number | null,
  day?: number | null
) {
  if (!year || !month || !day) return "";

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  const daysSinceUnixEpoch = Math.floor(date.getTime() / 86400000);

  const index =
    ((daysSinceUnixEpoch + AZTEC_APP_CORRELATION_OFFSET) %
      AZTEC_DAY_SIGNS.length +
      AZTEC_DAY_SIGNS.length) %
    AZTEC_DAY_SIGNS.length;

  return AZTEC_DAY_SIGNS[index] || "";
}

export function getChineseZodiac(year?: number | null) {
  if (!year) return "";

  const animals = [
    "Monkey",
    "Rooster",
    "Dog",
    "Pig",
    "Rat",
    "Ox",
    "Tiger",
    "Rabbit",
    "Dragon",
    "Snake",
    "Horse",
    "Goat",
  ];

  return animals[year % 12] || "";
}

export function getNumerologyLifePath(
  year?: number | null,
  month?: number | null,
  day?: number | null
) {
  if (!year || !month || !day) return null;

  const digits = `${month}${day}${year}`
    .split("")
    .map((n) => Number(n))
    .filter((n) => !Number.isNaN(n));

  let total = digits.reduce((sum, n) => sum + n, 0);

  while (![11, 22, 33].includes(total) && total > 9) {
    total = String(total)
      .split("")
      .map((n) => Number(n))
      .reduce((sum, n) => sum + n, 0);
  }

  return total;
}

function withTimeout<T>(
  promiseLike: PromiseLike<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    Promise.resolve(promiseLike)
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

function extFromUri(uri: string) {
  const clean = uri.split("?")[0] ?? uri;
  const parts = clean.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "jpg";
}

function mimeFromExt(ext: string) {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "jpeg":
    case "jpg":
      return "image/jpeg";
    default:
      return "image/jpeg";
  }
}

function getStoragePathFromPublicUrl(bucket: string, publicUrl: string) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  if (!publicUrl.includes(marker)) return null;

  const path = publicUrl.split(marker)[1];
  return path || null;
}

export async function ensureProfileRow(userId: string) {
  if (!userId) return;

  try {
    const { data: existing, error: selectError } = await withTimeout(
      supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle(),
      4500,
      "ensureProfileRow check"
    );

    if (selectError) {
      console.log("ensureProfileRow check warning:", selectError.message);
    }

    if (existing?.id) return;

    const { error: insertError } = await withTimeout(
      supabase
        .from("profiles")
        .insert({
          id: userId,
          has_onboarded: false,
        }),
      4500,
      "ensureProfileRow insert"
    );

    if (insertError) {
      const message = insertError.message.toLowerCase();

      if (
        message.includes("duplicate") ||
        message.includes("already exists") ||
        message.includes("violates unique")
      ) {
        return;
      }

      console.log("ensureProfileRow insert warning:", insertError.message);
      throw new Error(insertError.message);
    }
  } catch (err: any) {
    console.log("ensureProfileRow warning:", err?.message ?? err);
  }
}

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await withTimeout(
    supabase
      .from("profiles")
      .select(
        "id, has_onboarded, display_name, relationship_style, bio, birth_year, birth_month, birth_day, western_zodiac, aztec_zodiac, chinese_zodiac, numerology_life_path, spiritual_path, likes_text, hobbies, orientation, city, state, avatar_url, profile_photo_url, username, relationship_styles, spiritual_paths, cover_photo_url"
      )
      .eq("id", userId)
      .single(),
    7000,
    "getProfile"
  );

  if (error) throw new Error(error.message);

  return data as Profile;
}

export async function getHasOnboarded(userId: string): Promise<boolean> {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("profiles")
        .select("has_onboarded")
        .eq("id", userId)
        .maybeSingle(),
      4500,
      "getHasOnboarded"
    );

    if (error) {
      console.log("getHasOnboarded warning:", error.message);
      return false;
    }

    return Boolean(data?.has_onboarded);
  } catch (err: any) {
    console.log("getHasOnboarded warning:", err?.message ?? err);
    return false;
  }
}

export async function completeOnboarding(params: {
  userId: string;
  displayName: string;
  relationshipStyle: string;
  bio?: string;
}) {
  const { userId, displayName, relationshipStyle, bio } = params;

  await ensureProfileRow(userId);

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      relationship_style: relationshipStyle,
      bio: bio ?? null,
      has_onboarded: true,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function setHasOnboarded(userId: string, value: boolean) {
  await ensureProfileRow(userId);

  const { error } = await supabase
    .from("profiles")
    .update({ has_onboarded: value })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function listProfileMedia(
  userId: string
): Promise<ProfileMediaItem[]> {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("profile_media")
        .select("id, user_id, media_url, sort_order, created_at")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      7000,
      "listProfileMedia"
    );

    if (error) throw new Error(error.message);

    return (data ?? []) as ProfileMediaItem[];
  } catch (err: any) {
    console.log("listProfileMedia warning:", err?.message ?? err);
    return [];
  }
}

export async function uploadProfileMedia(
  userId: string,
  uris: string[],
  startingSortOrder = 0
): Promise<ProfileMediaItem[]> {
  const insertedRows: ProfileMediaItem[] = [];

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    const ext = extFromUri(uri);
    const contentType = mimeFromExt(ext);
    const filePath = `${userId}/${Date.now()}-${i}.${ext}`;

    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrlData } = supabase.storage
      .from("profile-media")
      .getPublicUrl(filePath);

    const { data: inserted, error: insertError } = await supabase
      .from("profile_media")
      .insert({
        user_id: userId,
        media_url: publicUrlData.publicUrl,
        sort_order: startingSortOrder + i,
      })
      .select("id, user_id, media_url, sort_order, created_at")
      .single();

    if (insertError) throw new Error(insertError.message);

    insertedRows.push(inserted as ProfileMediaItem);
  }

  return insertedRows;
}

export async function deleteProfileMediaItems(items: ProfileMediaItem[]) {
  if (items.length === 0) return;

  const ids = items.map((item) => item.id);
  const storagePaths = items
    .map((item) => getStoragePathFromPublicUrl("profile-media", item.media_url))
    .filter(Boolean) as string[];

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("profile-media")
      .remove(storagePaths);

    if (storageError) {
      console.log("profile media storage delete warning:", storageError.message);
    }
  }

  const { error } = await supabase
    .from("profile_media")
    .delete()
    .in("id", ids);

  if (error) throw new Error(error.message);
}