export type CompatProfile = {
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  western_zodiac?: string | null;
  vedic_zodiac?: string | null;
  chinese_zodiac?: string | null;
  numerology_life_path?: number | null;
};

const WESTERN_SIGNS = [
  { name: "Capricorn", start: [12, 22], end: [1, 19], element: "earth" },
  { name: "Aquarius", start: [1, 20], end: [2, 18], element: "air" },
  { name: "Pisces", start: [2, 19], end: [3, 20], element: "water" },
  { name: "Aries", start: [3, 21], end: [4, 19], element: "fire" },
  { name: "Taurus", start: [4, 20], end: [5, 20], element: "earth" },
  { name: "Gemini", start: [5, 21], end: [6, 20], element: "air" },
  { name: "Cancer", start: [6, 21], end: [7, 22], element: "water" },
  { name: "Leo", start: [7, 23], end: [8, 22], element: "fire" },
  { name: "Virgo", start: [8, 23], end: [9, 22], element: "earth" },
  { name: "Libra", start: [9, 23], end: [10, 22], element: "air" },
  { name: "Scorpio", start: [10, 23], end: [11, 21], element: "water" },
  { name: "Sagittarius", start: [11, 22], end: [12, 21], element: "fire" },
] as const;

const VEDIC_SIGNS = [
  { name: "Capricorn", start: [1, 14], end: [2, 12], element: "earth" },
  { name: "Aquarius", start: [2, 13], end: [3, 14], element: "air" },
  { name: "Pisces", start: [3, 15], end: [4, 13], element: "water" },
  { name: "Aries", start: [4, 14], end: [5, 14], element: "fire" },
  { name: "Taurus", start: [5, 15], end: [6, 14], element: "earth" },
  { name: "Gemini", start: [6, 15], end: [7, 16], element: "air" },
  { name: "Cancer", start: [7, 17], end: [8, 16], element: "water" },
  { name: "Leo", start: [8, 17], end: [9, 16], element: "fire" },
  { name: "Virgo", start: [9, 17], end: [10, 17], element: "earth" },
  { name: "Libra", start: [10, 18], end: [11, 16], element: "air" },
  { name: "Scorpio", start: [11, 17], end: [12, 15], element: "water" },
  { name: "Sagittarius", start: [12, 16], end: [1, 13], element: "fire" },
] as const;

const CHINESE = [
  "Rat",
  "Ox",
  "Tiger",
  "Rabbit",
  "Dragon",
  "Snake",
  "Horse",
  "Goat",
  "Monkey",
  "Rooster",
  "Dog",
  "Pig",
];

function sameElementCompatible(a: string, b: string) {
  return (
    (a === "fire" && b === "air") ||
    (a === "air" && b === "fire") ||
    (a === "earth" && b === "water") ||
    (a === "water" && b === "earth") ||
    a === b
  );
}

function digitReduce(n: number): number {
  let value = n;
  while (value > 9 && value !== 11 && value !== 22 && value !== 33) {
    value = String(value)
      .split("")
      .reduce((sum, x) => sum + Number(x), 0);
  }
  return value;
}

function getSignFromRange(
  month?: number | null,
  day?: number | null,
  signs?: readonly {
    name: string;
    start: readonly [number, number];
    end: readonly [number, number];
    element: string;
  }[]
): string | null {
  if (!month || !day || !signs) return null;

  for (const sign of signs) {
    const [sm, sd] = sign.start;
    const [em, ed] = sign.end;

    if (sm > em) {
      if (
        (month === sm && day >= sd) ||
        month > sm ||
        month < em ||
        (month === em && day <= ed)
      ) {
        return sign.name;
      }
    } else {
      if (
        (month === sm && day >= sd) ||
        (month === em && day <= ed) ||
        (month > sm && month < em)
      ) {
        return sign.name;
      }
    }
  }

  return null;
}

export function getWesternZodiac(month?: number | null, day?: number | null): string | null {
  return getSignFromRange(month, day, WESTERN_SIGNS);
}

export function getVedicZodiac(month?: number | null, day?: number | null): string | null {
  return getSignFromRange(month, day, VEDIC_SIGNS);
}

export function getChineseZodiac(year?: number | null): string | null {
  if (!year) return null;
  return CHINESE[(year - 1900) % 12];
}

export function getLifePath(
  year?: number | null,
  month?: number | null,
  day?: number | null
): number | null {
  if (!year || !month || !day) return null;
  const total = [...`${month}${day}${year}`].reduce((sum, x) => sum + Number(x), 0);
  return digitReduce(total);
}

function westernElement(sign?: string | null): string | null {
  const found = WESTERN_SIGNS.find((x) => x.name === sign);
  return found?.element ?? null;
}

function vedicElement(sign?: string | null): string | null {
  const found = VEDIC_SIGNS.find((x) => x.name === sign);
  return found?.element ?? null;
}

function chineseIndex(sign?: string | null): number | null {
  if (!sign) return null;
  const idx = CHINESE.indexOf(sign);
  return idx >= 0 ? idx : null;
}

export function hydrateProfileCompatibility<T extends CompatProfile>(
  p: T
): T & {
  western_zodiac: string | null;
  vedic_zodiac: string | null;
  chinese_zodiac: string | null;
  numerology_life_path: number | null;
} {
  const western = p.western_zodiac ?? getWesternZodiac(p.birth_month, p.birth_day);
  const vedic = p.vedic_zodiac ?? getVedicZodiac(p.birth_month, p.birth_day);
  const chinese = p.chinese_zodiac ?? getChineseZodiac(p.birth_year);
  const life = p.numerology_life_path ?? getLifePath(p.birth_year, p.birth_month, p.birth_day);

  return {
    ...p,
    western_zodiac: western,
    vedic_zodiac: vedic,
    chinese_zodiac: chinese,
    numerology_life_path: life,
  };
}

export function getCompatibilityScore(me: CompatProfile, other: CompatProfile) {
  const a = hydrateProfileCompatibility(me);
  const b = hydrateProfileCompatibility(other);

  let score = 50;

  const aWesternElement = westernElement(a.western_zodiac);
  const bWesternElement = westernElement(b.western_zodiac);
  if (aWesternElement && bWesternElement) {
    if (sameElementCompatible(aWesternElement, bWesternElement)) score += 14;
    else score -= 6;
  }

  const aVedicElement = vedicElement(a.vedic_zodiac);
  const bVedicElement = vedicElement(b.vedic_zodiac);
  if (aVedicElement && bVedicElement) {
    if (sameElementCompatible(aVedicElement, bVedicElement)) score += 14;
    else score -= 6;
  }

  const aChinese = chineseIndex(a.chinese_zodiac);
  const bChinese = chineseIndex(b.chinese_zodiac);
  if (aChinese !== null && bChinese !== null) {
    const diff = Math.abs(aChinese - bChinese) % 12;
    if (diff === 0 || diff === 4 || diff === 8) score += 12;
    else if (diff === 6) score -= 8;
    else score += 4;
  }

  if (a.numerology_life_path && b.numerology_life_path) {
    const diff = Math.abs(a.numerology_life_path - b.numerology_life_path);
    if (diff === 0) score += 14;
    else if (diff <= 2) score += 8;
    else if (diff >= 6) score -= 6;
  }

  score = Math.max(1, Math.min(100, score));

  let label = "Mixed";
  if (score >= 88) label = "Power Match";
  else if (score >= 74) label = "Strong Match";
  else if (score >= 60) label = "Good Match";
  else if (score < 45) label = "Low Sync";

  return {
    score,
    label,
    western: `${a.western_zodiac ?? "—"} ↔ ${b.western_zodiac ?? "—"}`,
    vedic: `${a.vedic_zodiac ?? "—"} ↔ ${b.vedic_zodiac ?? "—"}`,
    chinese: `${a.chinese_zodiac ?? "—"} ↔ ${b.chinese_zodiac ?? "—"}`,
    numerology: `${a.numerology_life_path ?? "—"} ↔ ${b.numerology_life_path ?? "—"}`,
  };
}