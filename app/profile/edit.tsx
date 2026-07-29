import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
} from "../../lib/brand";
import {
  deleteProfileMediaItems,
  getAztecZodiac,
  getChineseZodiac,
  getNumerologyLifePath,
  getWesternZodiac,
  listProfileMedia,
  type ProfileMediaItem,
  uploadProfileMedia,
} from "../../lib/profile";
import { supabase } from "../../lib/supabase";

const LIKE_OPTIONS = [
  "Tarot",
  "Astrology",
  "Numerology",
  "Moon rituals",
  "Crystals",
  "Manifestation",
  "Deep talks",
  "Coffee",
  "Music",
  "Travel",
  "Nature",
  "Memes",
  "Dancing",
  "Art",
  "Books",
  "Shadow work",
];

function toggleValue(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function sanitizeNumber(input: string, maxLen: number) {
  return input.replace(/\D/g, "").slice(0, maxLen);
}

function formatPremiumTier(value?: string | null) {
  if (!value) return "Premium";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPremiumExpiry(value?: string | null) {
  if (!value) return "";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleDateString();
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
  return selected ? (
    <Pressable onPress={onPress} style={styles.chipWrap}>
      <LinearGradient
        colors={[BRAND.pink, BRAND.magenta, BRAND.purple]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.chipSelected}
      >
        <Text style={styles.chipSelectedText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  ) : (
    <Pressable onPress={onPress} style={[styles.chipWrap, styles.chip]}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [orientation, setOrientation] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [isPremium, setIsPremium] = useState(false);
  const [premiumTier, setPremiumTier] = useState<string | null>(null);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(null);

  const [relationshipStyles, setRelationshipStyles] = useState<string[]>([]);
  const [spiritualPaths, setSpiritualPaths] = useState<string[]>([]);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [likesSelected, setLikesSelected] = useState<string[]>([]);

  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthYear, setBirthYear] = useState("");

  const [publicPhotos, setPublicPhotos] = useState<ProfileMediaItem[]>([]);
  const [removedPublicPhotos, setRemovedPublicPhotos] = useState<ProfileMediaItem[]>([]);
  const [newPublicPhotoUris, setNewPublicPhotoUris] = useState<string[]>([]);

  const westernZodiac = useMemo(
    () => getWesternZodiac(Number(birthMonth) || null, Number(birthDay) || null),
    [birthMonth, birthDay]
  );

  const aztecZodiac = useMemo(
    () =>
      getAztecZodiac(
        Number(birthYear) || null,
        Number(birthMonth) || null,
        Number(birthDay) || null
      ),
    [birthYear, birthMonth, birthDay]
  );

  const chineseZodiac = useMemo(
    () => getChineseZodiac(Number(birthYear) || null),
    [birthYear]
  );

  const numerologyLifePath = useMemo(
    () =>
      getNumerologyLifePath(
        Number(birthYear) || null,
        Number(birthMonth) || null,
        Number(birthDay) || null
      ),
    [birthYear, birthMonth, birthDay]
  );

  const premiumTierLabel = useMemo(() => formatPremiumTier(premiumTier), [premiumTier]);

  const premiumExpiryLabel = useMemo(
    () => formatPremiumExpiry(premiumExpiresAt),
    [premiumExpiresAt]
  );

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const [{ data, error }, profileMedia] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),
        listProfileMedia(user.id),
      ]);

      if (error) throw error;

      if (data) {
        setDisplayName(data.display_name ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setCity(data.city ?? "");
        setStateValue(data.state ?? "");
        setOrientation(data.orientation ?? "");
        setAvatarUrl(data.profile_photo_url ?? data.avatar_url ?? null);

        const premiumActive =
          !!data.is_premium &&
          (!data.premium_expires_at ||
            new Date(data.premium_expires_at).getTime() > Date.now());

        setIsPremium(premiumActive);
        setPremiumTier(data.premium_tier ?? null);
        setPremiumExpiresAt(data.premium_expires_at ?? null);

        const loadedRelationshipStyles =
          data.relationship_styles ??
          (data.relationship_style ? [data.relationship_style] : []);
        setRelationshipStyles(loadedRelationshipStyles);

        const loadedSpiritualPaths =
          data.spiritual_paths ??
          (data.spiritual_path ? [data.spiritual_path] : []);
        setSpiritualPaths(loadedSpiritualPaths);

        setHobbies(data.hobbies ?? []);

        const likesArray =
          data.likes_text
            ?.split(",")
            .map((s: string) => s.trim())
            .filter(Boolean) ?? [];
        setLikesSelected(likesArray);

        setBirthMonth(data.birth_month ? String(data.birth_month) : "");
        setBirthDay(data.birth_day ? String(data.birth_day) : "");
        setBirthYear(data.birth_year ? String(data.birth_year) : "");
      }

      setPublicPhotos(profileMedia);
    } catch (err) {
      console.log(err);
      Alert.alert("Could not load profile");
    } finally {
      setLoading(false);
    }
  }

  async function requestCameraOrLibraryPermissions(mode: "camera" | "library") {
    if (mode === "camera") {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();

      if (!cameraPermission.granted) {
        Alert.alert("Permission required", "Please allow camera access.");
        return false;
      }

      return true;
    }

    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!libraryPermission.granted) {
      Alert.alert("Permission required", "Please allow photo access.");
      return false;
    }

    return true;
  }

  function openAvatarPicker() {
    Alert.alert("Profile Photo", "Choose how you want to add your profile photo.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Camera",
        onPress: async () => {
          const allowed = await requestCameraOrLibraryPermissions("camera");
          if (!allowed) return;

          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.9,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });

          if (!result.canceled && result.assets.length > 0) {
            setAvatarUrl(result.assets[0].uri);
          }
        },
      },
      {
        text: "Photo Library",
        onPress: async () => {
          const allowed = await requestCameraOrLibraryPermissions("library");
          if (!allowed) return;

          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.9,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });

          if (!result.canceled && result.assets.length > 0) {
            setAvatarUrl(result.assets[0].uri);
          }
        },
      },
    ]);
  }

  function openPublicPhotoPicker() {
    Alert.alert("Public Photos", "Choose how you want to add public photos.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Camera",
        onPress: async () => {
          const allowed = await requestCameraOrLibraryPermissions("camera");
          if (!allowed) return;

          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.9,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });

          if (!result.canceled && result.assets.length > 0) {
            setNewPublicPhotoUris((prev) => {
              const merged = [...prev];
              const uri = result.assets[0].uri;

              if (!merged.includes(uri)) merged.push(uri);

              return merged.slice(0, 12);
            });
          }
        },
      },
      {
        text: "Photo Library",
        onPress: async () => {
          const allowed = await requestCameraOrLibraryPermissions("library");
          if (!allowed) return;

          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: false,
            allowsMultipleSelection: true,
            selectionLimit: 6,
            quality: 0.9,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });

          if (result.canceled || !result.assets?.length) return;

          setNewPublicPhotoUris((prev) => {
            const merged = [...prev];

            for (const asset of result.assets) {
              if (!merged.includes(asset.uri)) {
                merged.push(asset.uri);
              }
            }

            return merged.slice(0, 12);
          });
        },
      },
    ]);
  }

  function removeExistingPublicPhoto(item: ProfileMediaItem) {
    setPublicPhotos((prev) => prev.filter((photo) => photo.id !== item.id));

    setRemovedPublicPhotos((prev) => {
      if (prev.some((photo) => photo.id === item.id)) return prev;
      return [...prev, item];
    });
  }

  function removeNewPublicPhoto(uri: string) {
    setNewPublicPhotoUris((prev) => prev.filter((item) => item !== uri));
  }

  async function uploadAvatarIfNeeded() {
    if (!userId || !avatarUrl) return avatarUrl;

    const isRemote =
      avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://");

    if (isRemote) return avatarUrl;

    const response = await fetch(avatarUrl);
    const arrayBuffer = await response.arrayBuffer();
    const filePath = `${userId}/avatar-${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(filePath, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) throw error;

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleSave() {
    if (saving || !userId) return;

    const monthNum = Number(birthMonth) || null;
    const dayNum = Number(birthDay) || null;
    const yearNum = Number(birthYear) || null;

    if (birthMonth && (monthNum === null || monthNum < 1 || monthNum > 12)) {
      Alert.alert("Invalid month", "Birth month must be between 1 and 12.");
      return;
    }

    if (birthDay && (dayNum === null || dayNum < 1 || dayNum > 31)) {
      Alert.alert("Invalid day", "Birth day must be between 1 and 31.");
      return;
    }

    if (
      birthYear &&
      (yearNum === null ||
        yearNum < 1900 ||
        yearNum > new Date().getFullYear())
    ) {
      Alert.alert("Invalid year", "Enter a valid birth year.");
      return;
    }

    setSaving(true);

    try {
      const remoteAvatarUrl = await uploadAvatarIfNeeded();

      const payload = {
        id: userId,
        display_name: displayName.trim() || null,
        username: username.trim() || null,
        bio: bio.trim() || null,
        city: city.trim() || null,
        state: stateValue.trim() || null,
        orientation: orientation.trim() || null,
        avatar_url: remoteAvatarUrl ?? null,
        profile_photo_url: remoteAvatarUrl ?? null,
        relationship_style: relationshipStyles[0] ?? null,
        relationship_styles: relationshipStyles,
        spiritual_path: spiritualPaths[0] ?? null,
        spiritual_paths: spiritualPaths,
        hobbies,
        likes_text: likesSelected.join(", ") || null,
        birth_month: monthNum,
        birth_day: dayNum,
        birth_year: yearNum,
        western_zodiac: westernZodiac || null,
        aztec_zodiac: aztecZodiac || null,
        chinese_zodiac: chineseZodiac || null,
        numerology_life_path: numerologyLifePath,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(payload);

      if (error) throw error;

      if (removedPublicPhotos.length > 0) {
        await deleteProfileMediaItems(removedPublicPhotos);
      }

      if (newPublicPhotoUris.length > 0) {
        await uploadProfileMedia(userId, newPublicPhotoUris, publicPhotos.length);
      }

      Alert.alert("Saved", "Your profile has been updated.");
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Edit Profile</Text>

      <View style={styles.premiumCard}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.premiumTitle}>
            {isPremium ? premiumTierLabel : "Premium"}
          </Text>

          <Text style={styles.premiumSubtitle}>
            {isPremium
              ? premiumExpiryLabel
                ? `Active until ${premiumExpiryLabel}`
                : "Your premium access is active."
              : "Unlock Likes You and premium matching perks."}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/premium" as any)}
          style={[
            styles.premiumButton,
            isPremium ? styles.premiumButtonActive : null,
          ]}
        >
          <Text
            style={[
              styles.premiumButtonText,
              isPremium ? styles.premiumButtonTextActive : null,
            ]}
          >
            {isPremium ? "Active" : "Upgrade"}
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={openAvatarPicker} style={styles.avatarWrap}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <Image
            source={require("../../assets/images/polyopen-logo.png")}
            style={styles.avatar}
            resizeMode="contain"
          />
        )}
      </Pressable>

      <Text style={styles.avatarHint}>Tap to use camera or photo library</Text>

      <Text style={styles.section}>Public Photos</Text>
      <Text style={styles.helperText}>
        These are the public photos strangers can see on your profile.
      </Text>

      <Pressable onPress={openPublicPhotoPicker} style={styles.addPublicPhotosButton}>
        <Text style={styles.addPublicPhotosText}>Add Public Photos</Text>
      </Pressable>

      {publicPhotos.length > 0 ? (
        <>
          <Text style={styles.smallSectionLabel}>Current Public Photos</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.publicPhotoRow}
          >
            {publicPhotos.map((item) => (
              <View key={item.id} style={styles.publicPhotoCard}>
                <Image
                  source={{ uri: item.media_url }}
                  style={styles.publicPhotoImage}
                  resizeMode="cover"
                />

                <Pressable
                  onPress={() => removeExistingPublicPhoto(item)}
                  style={styles.publicPhotoRemove}
                >
                  <Text style={styles.publicPhotoRemoveText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      {newPublicPhotoUris.length > 0 ? (
        <>
          <Text style={styles.smallSectionLabel}>New Public Photos</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.publicPhotoRow}
          >
            {newPublicPhotoUris.map((uri) => (
              <View key={uri} style={styles.publicPhotoCard}>
                <Image
                  source={{ uri }}
                  style={styles.publicPhotoImage}
                  resizeMode="cover"
                />

                <Pressable
                  onPress={() => removeNewPublicPhoto(uri)}
                  style={styles.publicPhotoRemove}
                >
                  <Text style={styles.publicPhotoRemoveText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Text style={styles.label}>Display Name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your name"
        placeholderTextColor="#A79AA2"
      />

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        placeholder="@username"
        placeholderTextColor="#A79AA2"
      />

      <Text style={styles.label}>City</Text>
      <TextInput
        style={styles.input}
        value={city}
        onChangeText={setCity}
        placeholder="City"
        placeholderTextColor="#A79AA2"
      />

      <Text style={styles.label}>State</Text>
      <TextInput
        style={styles.input}
        value={stateValue}
        onChangeText={setStateValue}
        placeholder="State"
        placeholderTextColor="#A79AA2"
      />

      <Text style={styles.label}>Orientation</Text>
      <TextInput
        style={styles.input}
        value={orientation}
        onChangeText={setOrientation}
        placeholder="Straight, bi, queer..."
        placeholderTextColor="#A79AA2"
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        multiline
        style={styles.bio}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell people who you are..."
        placeholderTextColor="#A79AA2"
      />

      <Text style={styles.section}>Birth Info</Text>

      <View style={styles.birthRow}>
        <View style={styles.birthCol}>
          <Text style={styles.smallLabel}>Month</Text>
          <TextInput
            style={styles.input}
            value={birthMonth}
            onChangeText={(v) => setBirthMonth(sanitizeNumber(v, 2))}
            keyboardType="number-pad"
            placeholder="11"
            placeholderTextColor="#A79AA2"
          />
        </View>

        <View style={styles.birthCol}>
          <Text style={styles.smallLabel}>Day</Text>
          <TextInput
            style={styles.input}
            value={birthDay}
            onChangeText={(v) => setBirthDay(sanitizeNumber(v, 2))}
            keyboardType="number-pad"
            placeholder="15"
            placeholderTextColor="#A79AA2"
          />
        </View>

        <View style={styles.birthCol}>
          <Text style={styles.smallLabel}>Year</Text>
          <TextInput
            style={styles.input}
            value={birthYear}
            onChangeText={(v) => setBirthYear(sanitizeNumber(v, 4))}
            keyboardType="number-pad"
            placeholder="1990"
            placeholderTextColor="#A79AA2"
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

      <Text style={styles.section}>Relationship Styles</Text>
      <Text style={styles.helperText}>Choose all that apply.</Text>

      <View style={styles.rowWrap}>
        {RELATIONSHIP_STYLE_OPTIONS.map((item) => (
          <Chip
            key={item}
            label={item}
            selected={relationshipStyles.includes(item)}
            onPress={() => setRelationshipStyles((prev) => toggleValue(prev, item))}
          />
        ))}
      </View>

      <Text style={styles.section}>Spiritual Path</Text>
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

      <Text style={styles.section}>Likes</Text>

      <View style={styles.rowWrap}>
        {LIKE_OPTIONS.map((item) => (
          <Chip
            key={item}
            label={item}
            selected={likesSelected.includes(item)}
            onPress={() => setLikesSelected((prev) => toggleValue(prev, item))}
          />
        ))}
      </View>

      <Text style={styles.section}>Hobbies</Text>

      <View style={styles.rowWrap}>
        {HOBBY_OPTIONS.map((item) => (
          <Chip
            key={item}
            label={item}
            selected={hobbies.includes(item)}
            onPress={() => setHobbies((prev) => toggleValue(prev, item))}
          />
        ))}
      </View>

      <Pressable onPress={handleSave} style={styles.save} disabled={saving}>
        <LinearGradient
          colors={[BRAND.pink, BRAND.magenta, BRAND.purple]}
          style={styles.saveButton}
        >
          <Text style={styles.saveText}>
            {saving ? "Saving..." : "Save Profile"}
          </Text>
        </LinearGradient>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  content: {
    padding: 20,
    paddingBottom: 120,
  },

  header: {
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 20,
    color: BRAND.text,
  },

  premiumCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFFEE",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
  },

  premiumTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: BRAND.text,
  },

  premiumSubtitle: {
    marginTop: 6,
    color: BRAND.muted,
    lineHeight: 21,
    fontWeight: "600",
  },

  premiumButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
  },

  premiumButtonActive: {
    backgroundColor: "#EEF9F1",
    borderWidth: 1.5,
    borderColor: "#B7E4C7",
  },

  premiumButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },

  premiumButtonTextActive: {
    color: "#1B7F46",
  },

  avatarWrap: {
    alignSelf: "center",
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 999,
    padding: 4,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 999,
  },

  avatarHint: {
    textAlign: "center",
    color: BRAND.muted,
    fontWeight: "600",
    marginBottom: 8,
  },

  section: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 20,
    marginBottom: 10,
    color: BRAND.text,
  },

  helperText: {
    color: BRAND.muted,
    lineHeight: 21,
    marginBottom: 10,
    fontWeight: "700",
  },

  addPublicPhotosButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F7FF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
  },

  addPublicPhotosText: {
    color: "#2045A6",
    fontWeight: "900",
    fontSize: 15,
  },

  smallSectionLabel: {
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 8,
    color: BRAND.text,
  },

  publicPhotoRow: {
    paddingRight: 8,
  },

  publicPhotoCard: {
    width: 150,
    marginRight: 12,
  },

  publicPhotoImage: {
    width: 150,
    height: 190,
    borderRadius: 18,
    backgroundColor: "#000",
  },

  publicPhotoRemove: {
    marginTop: 8,
    minHeight: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
  },

  publicPhotoRemoveText: {
    color: "#BE123C",
    fontWeight: "900",
    fontSize: 13,
  },

  label: {
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 6,
    color: BRAND.text,
  },

  smallLabel: {
    fontWeight: "800",
    marginBottom: 6,
    color: BRAND.text,
    fontSize: 13,
  },

  input: {
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff",
    color: BRAND.text,
  },

  bio: {
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 16,
    padding: 12,
    height: 120,
    backgroundColor: "#fff",
    color: BRAND.text,
    textAlignVertical: "top",
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

  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  chipWrap: {
    marginRight: 10,
    marginBottom: 10,
  },

  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: "#fff",
  },

  chipSelected: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },

  chipText: {
    fontWeight: "700",
    color: BRAND.text,
  },

  chipSelectedText: {
    color: "#fff",
    fontWeight: "900",
  },

  save: {
    marginTop: 28,
  },

  saveButton: {
    paddingVertical: 16,
    borderRadius: 22,
    alignItems: "center",
  },

  saveText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});