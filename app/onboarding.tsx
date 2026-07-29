import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  BRAND,
  HOBBY_OPTIONS,
  RELATIONSHIP_STYLE_OPTIONS,
  SPIRITUAL_PATH_OPTIONS,
} from "../lib/brand";
import {
  getAztecZodiac,
  getChineseZodiac,
  getNumerologyLifePath,
  getWesternZodiac,
} from "../lib/profile";
import { supabase } from "../lib/supabase";

const RELATIONSHIP_STYLE_OPTIONS_CLEAN = RELATIONSHIP_STYLE_OPTIONS.filter(
  (item) => item !== "Open relationship"
);

const HOBBY_OPTIONS_WITH_BDSM = HOBBY_OPTIONS.includes("B.D.S.M")
  ? HOBBY_OPTIONS
  : [...HOBBY_OPTIONS, "B.D.S.M"];

function toggleValue(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
      {selected ? (
        <LinearGradient
          colors={[BRAND.pink, BRAND.magenta, BRAND.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chipSelected}
        >
          <Text style={styles.chipSelectedText}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.chip}>
          <Text style={styles.chipText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function sanitizeNumber(input: string, maxLen: number) {
  return input.replace(/\D/g, "").slice(0, maxLen);
}

const COMMUNITY_RULES = [
  "Treat everyone with respect, even when their relationship style or preferences are different from yours.",
  "No harassment, bullying, threats, hate, or humiliation.",
  "Consent matters in conversations, flirting, photos, and meetups.",
  "Do not shame people for being monogamous, polyamorous, curious, single, married, spiritual, or non-spiritual.",
  "Keep disagreements mature. Debate ideas without attacking people.",
  "No abusive language, stalking, repeated unwanted messaging, or pressure after someone says no.",
  "Be honest about your intentions and relationship status.",
  "Protect privacy. Do not share private messages, photos, or personal info without permission.",
];

export default function OnboardingScreen() {
  const router = useRouter();

  const [relationshipStyles, setRelationshipStyles] = useState<string[]>([]);
  const [likesText, setLikesText] = useState("");
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [spiritualPaths, setSpiritualPaths] = useState<string[]>([]);
  const [orientation, setOrientation] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [bio, setBio] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [saving, setSaving] = useState(false);

  const monthNum = Number(birthMonth) || null;
  const dayNum = Number(birthDay) || null;
  const yearNum = Number(birthYear) || null;

  const westernZodiac = useMemo(
    () => getWesternZodiac(monthNum, dayNum),
    [monthNum, dayNum]
  );

  const aztecZodiac = useMemo(
    () => getAztecZodiac(yearNum, monthNum, dayNum),
    [yearNum, monthNum, dayNum]
  );

  const chineseZodiac = useMemo(() => getChineseZodiac(yearNum), [yearNum]);

  const numerologyLifePath = useMemo(
    () => getNumerologyLifePath(yearNum, monthNum, dayNum),
    [yearNum, monthNum, dayNum]
  );

  const canSave = useMemo(() => {
    return (
      agreedToRules &&
      (relationshipStyles.length > 0 ||
        likesText.trim().length > 0 ||
        hobbies.length > 0 ||
        spiritualPaths.length > 0 ||
        orientation.trim().length > 0 ||
        city.trim().length > 0 ||
        stateValue.trim().length > 0 ||
        bio.trim().length > 0 ||
        birthMonth.length > 0 ||
        birthDay.length > 0 ||
        birthYear.length > 0)
    );
  }, [
    agreedToRules,
    relationshipStyles,
    likesText,
    hobbies,
    spiritualPaths,
    orientation,
    city,
    stateValue,
    bio,
    birthMonth,
    birthDay,
    birthYear,
  ]);

  async function handleSave() {
    if (!agreedToRules) {
      Alert.alert(
        "Agree to the rules",
        "You must agree to the community rules before continuing."
      );
      return;
    }

    if (!canSave || saving) return;

    const saveMonthNum = Number(birthMonth) || null;
    const saveDayNum = Number(birthDay) || null;
    const saveYearNum = Number(birthYear) || null;

    if (birthMonth && (saveMonthNum === null || saveMonthNum < 1 || saveMonthNum > 12)) {
      Alert.alert("Invalid month", "Birth month must be between 1 and 12.");
      return;
    }

    if (birthDay && (saveDayNum === null || saveDayNum < 1 || saveDayNum > 31)) {
      Alert.alert("Invalid day", "Birth day must be between 1 and 31.");
      return;
    }

    if (
      birthYear &&
      (saveYearNum === null ||
        saveYearNum < 1900 ||
        saveYearNum > new Date().getFullYear())
    ) {
      Alert.alert("Invalid year", "Enter a valid birth year.");
      return;
    }

    const nextWesternZodiac = getWesternZodiac(saveMonthNum, saveDayNum);
    const nextAztecZodiac = getAztecZodiac(saveYearNum, saveMonthNum, saveDayNum);
    const nextChineseZodiac = getChineseZodiac(saveYearNum);
    const nextNumerologyLifePath = getNumerologyLifePath(
      saveYearNum,
      saveMonthNum,
      saveDayNum
    );

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Not signed in", "Please log in again.");
        return;
      }

      const payload = {
        id: user.id,
        relationship_style: relationshipStyles[0] || null,
        relationship_styles: relationshipStyles,
        likes_text: likesText.trim() || null,
        hobbies,
        spiritual_path: spiritualPaths[0] || null,
        spiritual_paths: spiritualPaths,
        orientation: orientation.trim() || null,
        city: city.trim() || null,
        state: stateValue.trim() || null,
        bio: bio.trim() || null,
        birth_month: saveMonthNum,
        birth_day: saveDayNum,
        birth_year: saveYearNum,
        western_zodiac: nextWesternZodiac || null,
        aztec_zodiac: nextAztecZodiac || null,
        chinese_zodiac: nextChineseZodiac || null,
        numerology_life_path: nextNumerologyLifePath,
        has_onboarded: true,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(payload);

      if (error) throw error;

      router.replace("/(tabs)/browse");
    } catch (error: any) {
      Alert.alert("Could not save profile", error?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/images/polyopen-logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>PolyOpen</Text>
          <Text style={styles.logoSubtitle}>
            Set up your vibe, spiritual path, and compatibility.
          </Text>
        </View>

        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>Community Rules</Text>
          <Text style={styles.rulesSubtitle}>
            Please agree before entering the app.
          </Text>

          <View style={styles.rulesList}>
            {COMMUNITY_RULES.map((rule, index) => (
              <View key={rule} style={styles.ruleRow}>
                <Text style={styles.ruleNumber}>{index + 1}.</Text>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Abuse, harassment, disrespectful behavior, or targeting other users can lead to a permanent ban.
            </Text>
          </View>

          <Pressable
            onPress={() => setAgreedToRules((prev) => !prev)}
            style={[
              styles.agreeRow,
              agreedToRules ? styles.agreeRowSelected : null,
            ]}
          >
            <View style={[styles.checkbox, agreedToRules ? styles.checkboxSelected : null]}>
              {agreedToRules ? <Text style={styles.checkboxCheck}>✓</Text> : null}
            </View>

            <Text style={styles.agreeText}>
              I agree to follow these rules and treat people respectfully.
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Relationship styles</Text>
        <Text style={styles.helperText}>Choose all that apply.</Text>
        <View style={styles.rowWrap}>
          {RELATIONSHIP_STYLE_OPTIONS_CLEAN.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={relationshipStyles.includes(item)}
              onPress={() => setRelationshipStyles((prev) => toggleValue(prev, item))}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Spiritual path</Text>
        <Text style={styles.helperText}>Choose all that apply.</Text>
        <View style={styles.rowWrap}>
          {SPIRITUAL_PATH_OPTIONS.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={spiritualPaths.includes(item)}
              onPress={() => setSpiritualPaths((prev) => toggleValue(prev, item))}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Birth info</Text>
        <View style={styles.birthRow}>
          <View style={styles.birthCol}>
            <Text style={styles.smallLabel}>Month</Text>
            <TextInput
              value={birthMonth}
              onChangeText={(v) => setBirthMonth(sanitizeNumber(v, 2))}
              placeholder="11"
              placeholderTextColor="#A79AA2"
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>

          <View style={styles.birthCol}>
            <Text style={styles.smallLabel}>Day</Text>
            <TextInput
              value={birthDay}
              onChangeText={(v) => setBirthDay(sanitizeNumber(v, 2))}
              placeholder="15"
              placeholderTextColor="#A79AA2"
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>

          <View style={styles.birthCol}>
            <Text style={styles.smallLabel}>Year</Text>
            <TextInput
              value={birthYear}
              onChangeText={(v) => setBirthYear(sanitizeNumber(v, 4))}
              placeholder="1990"
              placeholderTextColor="#A79AA2"
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.readoutWrap}>
          <View style={styles.readoutCard}>
            <Text style={styles.readoutLabel}>Western zodiac</Text>
            <Text style={styles.readoutValue}>{westernZodiac || "—"}</Text>
          </View>

          <View style={styles.readoutCard}>
            <Text style={styles.readoutLabel}>Aztec day sign</Text>
            <Text style={styles.readoutValue}>{aztecZodiac || "—"}</Text>
          </View>

          <View style={styles.readoutCard}>
            <Text style={styles.readoutLabel}>Chinese zodiac</Text>
            <Text style={styles.readoutValue}>{chineseZodiac || "—"}</Text>
          </View>

          <View style={styles.readoutCard}>
            <Text style={styles.readoutLabel}>Life path</Text>
            <Text style={styles.readoutValue}>
              {numerologyLifePath ? String(numerologyLifePath) : "—"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Orientation</Text>
        <TextInput
          value={orientation}
          onChangeText={setOrientation}
          placeholder="Straight, bi, queer..."
          placeholderTextColor="#A79AA2"
          style={styles.input}
        />

        <Text style={styles.sectionTitle}>City</Text>
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="City"
          placeholderTextColor="#A79AA2"
          style={styles.input}
        />

        <Text style={styles.sectionTitle}>State</Text>
        <TextInput
          value={stateValue}
          onChangeText={setStateValue}
          placeholder="State"
          placeholderTextColor="#A79AA2"
          style={styles.input}
        />

        <Text style={styles.sectionTitle}>Likes</Text>
        <TextInput
          value={likesText}
          onChangeText={setLikesText}
          placeholder="Tarot, moon rituals, coffee, deep talks..."
          placeholderTextColor="#A79AA2"
          style={styles.input}
        />

        <Text style={styles.sectionTitle}>Hobbies</Text>
        <View style={styles.rowWrap}>
          {HOBBY_OPTIONS_WITH_BDSM.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={hobbies.includes(item)}
              onPress={() => setHobbies((prev) => toggleValue(prev, item))}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Bio</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people who you are..."
          placeholderTextColor="#A79AA2"
          multiline
          textAlignVertical="top"
          style={styles.bioInput}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={handleSave} disabled={!canSave || saving}>
          <LinearGradient
            colors={
              canSave
                ? [BRAND.pink, BRAND.magenta, BRAND.purple]
                : ["#EDC7DB", "#EDC7DB"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              {saving ? "Saving..." : "Save & Continue"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 140,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 18,
  },
  logoImage: {
    width: 110,
    height: 110,
    marginBottom: 12,
  },
  logoText: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "900",
    color: BRAND.text,
  },
  logoSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: BRAND.muted,
    textAlign: "center",
    fontWeight: "600",
  },
  rulesCard: {
    backgroundColor: "#FFFFFFEE",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 24,
    padding: 16,
    marginBottom: 10,
  },
  rulesTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: BRAND.text,
  },
  rulesSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: BRAND.muted,
    fontWeight: "600",
  },
  rulesList: {
    marginTop: 14,
    gap: 12,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  ruleNumber: {
    width: 22,
    fontSize: 15,
    fontWeight: "900",
    color: BRAND.magenta,
  },
  ruleText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: BRAND.text,
    fontWeight: "600",
  },
  warningBox: {
    marginTop: 16,
    backgroundColor: "#FFF5F5",
    borderWidth: 1.5,
    borderColor: "#F5C2C7",
    borderRadius: 18,
    padding: 14,
  },
  warningText: {
    color: "#9F1239",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
  },
  agreeRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: BRAND.surface,
  },
  agreeRowSelected: {
    backgroundColor: "#FCE7F3",
    borderColor: "#F9A8D4",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#D8B4C8",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 1,
  },
  checkboxSelected: {
    backgroundColor: BRAND.magenta,
    borderColor: BRAND.magenta,
  },
  checkboxCheck: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  agreeText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: BRAND.text,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: BRAND.text,
    marginTop: 18,
    marginBottom: 12,
  },
  helperText: {
    color: BRAND.muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: -6,
    marginBottom: 12,
  },
  smallLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: BRAND.text,
    marginBottom: 8,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  chip: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: BRAND.surface,
    justifyContent: "center",
  },
  chipSelected: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 999,
    justifyContent: "center",
  },
  chipText: {
    fontSize: 16,
    fontWeight: "800",
    color: BRAND.text,
  },
  chipSelectedText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#fff",
  },
  input: {
    minHeight: 58,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 20,
    backgroundColor: BRAND.surface,
    paddingHorizontal: 18,
    fontSize: 16,
    color: BRAND.text,
  },
  birthRow: {
    flexDirection: "row",
    gap: 10,
  },
  birthCol: {
    flex: 1,
  },
  readoutWrap: {
    marginTop: 14,
    gap: 10,
  },
  readoutCard: {
    backgroundColor: "#FFF6FB",
    borderWidth: 1.5,
    borderColor: "#F2D7E5",
    borderRadius: 18,
    padding: 14,
  },
  readoutLabel: {
    fontSize: 12,
    color: BRAND.muted,
    fontWeight: "700",
    marginBottom: 4,
  },
  readoutValue: {
    fontSize: 18,
    color: BRAND.text,
    fontWeight: "900",
  },
  bioInput: {
    minHeight: 160,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 24,
    backgroundColor: BRAND.surface,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    fontSize: 18,
    color: BRAND.text,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: "rgba(255,248,252,0.97)",
    borderTopWidth: 1,
    borderTopColor: "#F3DDE8",
  },
  button: {
    minHeight: 64,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
});