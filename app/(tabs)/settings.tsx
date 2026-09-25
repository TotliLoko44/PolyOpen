import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BRAND } from "../../lib/brand";
import { supabase } from "../../lib/supabase";

type SettingsPanel =
  | "home"
  | "distance"
  | "age"
  | "sex"
  | "dating"
  | "email"
  | "subscription"
  | "verification"
  | "privacy"
  | "blocked"
  | "safety"
  | "terms"
  | "policy";

function SettingsRow({
  title,
  subtitle,
  onPress,
  danger = false,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.rowTitle, danger ? styles.rowTitleDanger : null]}>
          {title}
        </Text>
        {!!subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function OptionPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.optionPill, selected ? styles.optionPillSelected : null]}
    >
      <Text
        style={[
          styles.optionPillText,
          selected ? styles.optionPillTextSelected : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PanelHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.panelHeader}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>‹ Back</Text>
      </Pressable>

      <Text style={styles.header}>{title}</Text>
      {!!subtitle ? <Text style={styles.subheader}>{subtitle}</Text> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();

  const [panel, setPanel] = useState<SettingsPanel>("home");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSwipeSetting, setSavingSwipeSetting] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [distanceMiles, setDistanceMiles] = useState("50");
  const [minAge, setMinAge] = useState("21");
  const [maxAge, setMaxAge] = useState("55");
  const [sexPreference, setSexPreference] = useState("Everyone");
  const [newEmail, setNewEmail] = useState("");

  const [showInSwipe, setShowInSwipe] = useState(true);
  const [profilePublic, setProfilePublic] = useState(true);
  const [showDistance, setShowDistance] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [allowMessages, setAllowMessages] = useState(true);

  const pageTitle = useMemo(() => {
    const titles: Record<SettingsPanel, string> = {
      home: "Settings",
      distance: "Distance Preference",
      age: "Age Preference",
      sex: "Sex Preference",
      dating: "Dating and Swipe",
      email: "Change Email",
      subscription: "Manage Subscription",
      verification: "Verification",
      privacy: "Privacy",
      blocked: "Blocked Users",
      safety: "Safety Tips",
      terms: "Terms of Use",
      policy: "Privacy Policy",
    };

    return titles[panel];
  }, [panel]);

  const loadSettings = useCallback(async () => {
    try {
      setLoadingSettings(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const uid = user?.id ?? null;
      setUserId(uid);

      if (!uid) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("show_in_swipe")
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        console.log("SETTINGS LOAD WARNING:", error.message);
        return;
      }

      if (typeof data?.show_in_swipe === "boolean") {
        setShowInSwipe(data.show_in_swipe);
      }
    } catch (error) {
      console.log("SETTINGS LOAD ERROR:", error);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login" as any);
    } catch (error: any) {
      Alert.alert("Could not log out", error?.message ?? "Please try again.");
    }
  }

  async function handleChangeEmail() {
    const cleanEmail = newEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("Email needed", "Enter a valid email address first.");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ email: cleanEmail });
      if (error) throw error;

      Alert.alert(
        "Check your email",
        "Supabase will send confirmation steps to your new email address.",
      );
      setNewEmail("");
    } catch (error: any) {
      Alert.alert(
        "Could not update email",
        error?.message ?? "Please try again.",
      );
    }
  }

  async function saveSwipeVisibility(nextValue?: boolean) {
    const valueToSave =
      typeof nextValue === "boolean" ? nextValue : showInSwipe;

    if (!userId || savingSwipeSetting) {
      Alert.alert(
        "Sign in needed",
        "You must be signed in to update this setting.",
      );
      return;
    }

    try {
      setSavingSwipeSetting(true);

      const { error } = await supabase
        .from("profiles")
        .update({ show_in_swipe: valueToSave })
        .eq("id", userId);

      if (error) throw error;

      Alert.alert(
        "Saved",
        valueToSave
          ? "Your profile can appear in Swipe."
          : "Your profile will be hidden from Swipe.",
      );
    } catch (error: any) {
      Alert.alert(
        "Could not save",
        error?.message ??
          "Make sure the profiles table has a show_in_swipe column.",
      );
    } finally {
      setSavingSwipeSetting(false);
    }
  }

  function saveLocalPreference(message: string) {
    Alert.alert("Saved", message);
  }

  function openPremium() {
    router.push("/premium" as any);
  }

  function openVerificationReview() {
    Alert.alert(
      "Verification Review",
      "The paid Gold Verification page is ready. Next we will connect the actual ID/photo review flow after the verification product is added in RevenueCat or Google Play.",
    );
  }

  function openUrl(url: string) {
    Linking.openURL(url).catch(() => {
      Alert.alert("Could not open link", "Please try again later.");
    });
  }

  function renderHome() {
    return (
      <>
        <Text style={styles.header}>{pageTitle}</Text>
        <Text style={styles.subheader}>
          Preferences, privacy, account controls, and safety tools
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Discovery</Text>

          <SettingsRow
            title="Dating and Swipe"
            subtitle={
              showInSwipe
                ? "Your profile can appear in Swipe"
                : "Your profile is hidden from Swipe"
            }
            onPress={() => setPanel("dating")}
          />

          <SettingsRow
            title="Distance Preference"
            subtitle={`Currently showing people within ${distanceMiles} miles`}
            onPress={() => setPanel("distance")}
          />

          <SettingsRow
            title="Age Preference"
            subtitle={`Currently ${minAge} to ${maxAge}`}
            onPress={() => setPanel("age")}
          />

          <SettingsRow
            title="Sex Preference"
            subtitle={sexPreference}
            onPress={() => setPanel("sex")}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>

          <SettingsRow
            title="Change Email"
            subtitle="Update the email on your account"
            onPress={() => setPanel("email")}
          />

          <SettingsRow
            title="Manage Subscription"
            subtitle="Billing, membership, premium access, and boosts"
            onPress={() => setPanel("subscription")}
          />

          <SettingsRow
            title="Verification"
            subtitle="Gold verified badge and real-account verification"
            onPress={() => setPanel("verification")}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy and Safety</Text>

          <SettingsRow
            title="Privacy"
            subtitle="Control who can see your profile and content"
            onPress={() => setPanel("privacy")}
          />

          <SettingsRow
            title="Blocked Users"
            subtitle="See and manage your block list"
            onPress={() => setPanel("blocked")}
          />

          <SettingsRow
            title="Safety Tips"
            subtitle="Best practices for safer connections"
            onPress={() => setPanel("safety")}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Legal</Text>

          <SettingsRow
            title="Terms of Use"
            subtitle="Read the current terms"
            onPress={() => setPanel("terms")}
          />

          <SettingsRow
            title="Privacy Policy"
            subtitle="Read the privacy policy"
            onPress={() => setPanel("policy")}
          />
        </View>

        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </Pressable>
      </>
    );
  }

  function renderDating() {
    return (
      <>
        <PanelHeader
          title="Dating and Swipe"
          subtitle="Choose whether your profile appears in the dating/swiping side of PolyOpen."
          onBack={() => setPanel("home")}
        />

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Show me in Swipe</Text>
              <Text style={styles.switchSubtitle}>
                Turn this off if you want to use PolyOpen for social, community,
                spirituality, content, and live features without appearing in
                the Swipe cycle.
              </Text>
            </View>
            <Switch
              value={showInSwipe}
              onValueChange={(nextValue) => {
                setShowInSwipe(nextValue);
                saveSwipeVisibility(nextValue);
              }}
            />
          </View>

          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>
              {showInSwipe
                ? "Swipe visibility is on"
                : "Swipe visibility is off"}
            </Text>
            <Text style={styles.noticeText}>
              {showInSwipe
                ? "Your profile is allowed to appear in Swipe discovery."
                : "Your profile should stay out of the Swipe cycle while you still use the rest of PolyOpen."}
            </Text>
          </View>

          <Pressable
            onPress={() => saveSwipeVisibility()}
            disabled={savingSwipeSetting}
            style={[
              styles.primaryButton,
              savingSwipeSetting ? styles.buttonDisabled : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {savingSwipeSetting ? "Saving..." : "Save Swipe Setting"}
            </Text>
          </Pressable>
        </View>
      </>
    );
  }

  function renderDistance() {
    return (
      <>
        <PanelHeader
          title="Distance Preference"
          subtitle="Choose how far PolyOpen should look for discovery profiles."
          onBack={() => setPanel("home")}
        />

        <View style={styles.card}>
          <Text style={styles.inputLabel}>Maximum distance in miles</Text>
          <TextInput
            value={distanceMiles}
            onChangeText={setDistanceMiles}
            keyboardType="number-pad"
            placeholder="50"
            style={styles.input}
          />

          <View style={styles.quickOptions}>
            {["10", "25", "50", "100", "250"].map((value) => (
              <OptionPill
                key={value}
                label={`${value} mi`}
                selected={distanceMiles === value}
                onPress={() => setDistanceMiles(value)}
              />
            ))}
          </View>

          <Pressable
            onPress={() =>
              saveLocalPreference(
                `Distance preference set to ${distanceMiles || "50"} miles.`,
              )
            }
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Save Distance</Text>
          </Pressable>
        </View>
      </>
    );
  }

  function renderAge() {
    return (
      <>
        <PanelHeader
          title="Age Preference"
          subtitle="Set the preferred age range for discovery."
          onBack={() => setPanel("home")}
        />

        <View style={styles.card}>
          <Text style={styles.inputLabel}>Minimum age</Text>
          <TextInput
            value={minAge}
            onChangeText={setMinAge}
            keyboardType="number-pad"
            placeholder="21"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>Maximum age</Text>
          <TextInput
            value={maxAge}
            onChangeText={setMaxAge}
            keyboardType="number-pad"
            placeholder="55"
            style={styles.input}
          />

          <Pressable
            onPress={() =>
              saveLocalPreference(
                `Age preference saved from ${minAge} to ${maxAge}.`,
              )
            }
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Save Age Range</Text>
          </Pressable>
        </View>
      </>
    );
  }

  function renderSex() {
    const options = ["Everyone", "Women", "Men", "Nonbinary", "Open to all"];

    return (
      <>
        <PanelHeader
          title="Sex Preference"
          subtitle="Choose who should appear in your discovery stack."
          onBack={() => setPanel("home")}
        />

        <View style={styles.card}>
          <View style={styles.optionWrap}>
            {options.map((option) => (
              <OptionPill
                key={option}
                label={option}
                selected={sexPreference === option}
                onPress={() => setSexPreference(option)}
              />
            ))}
          </View>

          <Pressable
            onPress={() =>
              saveLocalPreference(`Sex preference saved as ${sexPreference}.`)
            }
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Save Preference</Text>
          </Pressable>
        </View>
      </>
    );
  }

  function renderEmail() {
    return (
      <>
        <PanelHeader
          title="Change Email"
          subtitle="Update your login email. You may need to confirm the change."
          onBack={() => setPanel("home")}
        />

        <View style={styles.card}>
          <Text style={styles.inputLabel}>New email address</Text>
          <TextInput
            value={newEmail}
            onChangeText={setNewEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            style={styles.input}
          />

          <Pressable onPress={handleChangeEmail} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Update Email</Text>
          </Pressable>
        </View>
      </>
    );
  }

  function renderSubscription() {
    return (
      <>
        <PanelHeader
          title="Manage Subscription"
          subtitle="Premium, billing, boosts, and membership controls."
          onBack={() => setPanel("home")}
        />

        <View style={styles.card}>
          <Text style={styles.largeText}>PolyOpen Premium</Text>
          <Text style={styles.bodyText}>
            Manage Premium, No Ads, profile boosts, visibility features, and
            future creator tools.
          </Text>

          <Pressable onPress={openPremium} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Open Premium</Text>
          </Pressable>
        </View>
      </>
    );
  }

  function renderVerification() {
    return (
      <>
        <PanelHeader
          title="Verification"
          subtitle="Gold badge verification for real-account trust."
          onBack={() => setPanel("home")}
        />

        <View style={styles.goldCard}>
          <Text style={styles.goldBadge}>★ Gold Verification</Text>
          <Text style={styles.goldTitle}>Verify Your Real Account</Text>
          <Text style={styles.goldPrice}>$9.99</Text>
          <Text style={styles.goldSub}>/ month</Text>

          <Text style={styles.goldText}>
            Verification gives members a stronger trust signal. The goal is
            simple: show people your account is connected to a real person and
            give your profile a gold verified badge.
          </Text>

          <View style={styles.goldFeature}>
            <Text style={styles.goldFeatureText}>
              ★ Gold verified badge on profile
            </Text>
          </View>

          <View style={styles.goldFeature}>
            <Text style={styles.goldFeatureText}>
              ★ Real-account trust signal
            </Text>
          </View>

          <View style={styles.goldFeature}>
            <Text style={styles.goldFeatureText}>
              ★ Better credibility in community
            </Text>
          </View>

          <View style={styles.goldFeature}>
            <Text style={styles.goldFeatureText}>
              ★ Future ID or selfie review flow
            </Text>
          </View>

          <View style={styles.statusBox}>
            <Text style={styles.statusText}>Current status: Not verified</Text>
          </View>

          <Pressable onPress={openPremium} style={styles.goldButton}>
            <Text style={styles.goldButtonText}>Pay for Gold Verification</Text>
          </Pressable>

          <Pressable
            onPress={openVerificationReview}
            style={styles.goldSecondaryButton}
          >
            <Text style={styles.goldSecondaryButtonText}>
              Start Review Setup
            </Text>
          </Pressable>

          <Text style={styles.goldFinePrint}>
            Payment opens the Premium store for now. The final ID or selfie
            review flow still needs the verification product and review backend
            connected.
          </Text>
        </View>
      </>
    );
  }

  function renderPrivacy() {
    return (
      <>
        <PanelHeader
          title="Privacy"
          subtitle="Control profile visibility and interaction settings."
          onBack={() => setPanel("home")}
        />

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Public profile</Text>
              <Text style={styles.switchSubtitle}>
                Let people see your profile in discovery and public areas.
              </Text>
            </View>
            <Switch value={profilePublic} onValueChange={setProfilePublic} />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Show distance</Text>
              <Text style={styles.switchSubtitle}>
                Let nearby users see approximate distance.
              </Text>
            </View>
            <Switch value={showDistance} onValueChange={setShowDistance} />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Show online status</Text>
              <Text style={styles.switchSubtitle}>
                Let others know when you are recently active.
              </Text>
            </View>
            <Switch value={showOnline} onValueChange={setShowOnline} />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Allow messages</Text>
              <Text style={styles.switchSubtitle}>
                Let matches and approved connections message you.
              </Text>
            </View>
            <Switch value={allowMessages} onValueChange={setAllowMessages} />
          </View>

          <Pressable
            onPress={() => saveLocalPreference("Privacy settings saved.")}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Save Privacy</Text>
          </Pressable>
        </View>
      </>
    );
  }

  function renderBlocked() {
    return (
      <>
        <PanelHeader
          title="Blocked Users"
          subtitle="People you block will not be able to interact with your profile."
          onBack={() => setPanel("home")}
        />

        <View style={styles.card}>
          <Text style={styles.largeText}>No blocked users shown</Text>
          <Text style={styles.bodyText}>
            When you block someone from their profile, they will appear here for
            review and unblock controls.
          </Text>
        </View>
      </>
    );
  }

  function renderSafety() {
    return (
      <>
        <PanelHeader
          title="Safety Tips"
          subtitle="Healthy connection habits for PolyOpen."
          onBack={() => setPanel("home")}
        />

        <View style={styles.card}>
          <Text style={styles.tipTitle}>Meet safely</Text>
          <Text style={styles.bodyText}>
            Meet in public first, tell someone where you are going, and trust
            your instincts.
          </Text>

          <Text style={styles.tipTitle}>Protect your privacy</Text>
          <Text style={styles.bodyText}>
            Do not share your address, financial information, passwords, or
            private documents.
          </Text>

          <Text style={styles.tipTitle}>Use boundaries</Text>
          <Text style={styles.bodyText}>
            PolyOpen is built around ethical love, open spirituality, consent,
            honesty, and respect.
          </Text>
        </View>
      </>
    );
  }

  function renderTerms() {
    return (
      <>
        <PanelHeader
          title="Terms of Use"
          subtitle="Terms governing your use of PolyOpen."
          onBack={() => setPanel("home")}
        />

        <View style={styles.card}>
          <Text style={styles.largeText}>PolyOpen Terms</Text>
          <Text style={styles.bodyText}>
            By using PolyOpen, users agree to behave respectfully, avoid
            harassment, follow consent-based community rules, and use the app
            legally.
          </Text>
          <Text style={styles.bodyText}>
            Review the complete Terms of Use, including account, safety,
            community, subscription, VIP, and billing rules.
          </Text>

          <Pressable
            onPress={() => openUrl("https://polyopen.app/terms")}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Open Terms Link</Text>
          </Pressable>
        </View>
      </>
    );
  }

  function renderPolicy() {
    return (
      <>
        <PanelHeader
          title="Privacy Policy"
          subtitle="How PolyOpen collects, uses, and protects information."
          onBack={() => setPanel("home")}
        />

        <View style={styles.card}>
          <Text style={styles.largeText}>PolyOpen Privacy</Text>
          <Text style={styles.bodyText}>
            PolyOpen should only collect information needed for accounts,
            profiles, discovery, safety, messaging, and app features.
          </Text>
          <Text style={styles.bodyText}>
            Review the complete Privacy Policy, including data, permissions,
            live communication, advertising, billing, and privacy rights.
          </Text>

          <Pressable
            onPress={() => openUrl("https://polyopen.app/privacy")}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Open Privacy Link</Text>
          </Pressable>
        </View>
      </>
    );
  }

  function renderPanel() {
    if (panel === "home") return renderHome();
    if (panel === "dating") return renderDating();
    if (panel === "distance") return renderDistance();
    if (panel === "age") return renderAge();
    if (panel === "sex") return renderSex();
    if (panel === "email") return renderEmail();
    if (panel === "subscription") return renderSubscription();
    if (panel === "verification") return renderVerification();
    if (panel === "privacy") return renderPrivacy();
    if (panel === "blocked") return renderBlocked();
    if (panel === "safety") return renderSafety();
    if (panel === "terms") return renderTerms();
    if (panel === "policy") return renderPolicy();

    return renderHome();
  }

  if (loadingSettings) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={BRAND.pink} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Image
        source={require("../../assets/images/polyopen-logo.png")}
        style={styles.backgroundLogo}
        resizeMode="contain"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            Platform.OS === "web" ? styles.contentWeb : null,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {panel === "home" ? (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ) : null}

          {renderPanel()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  loadingText: {
    marginTop: 12,
    color: BRAND.muted,
    fontWeight: "800",
  },

  backgroundLogo: {
    position: "absolute",
    width: "120%",
    height: "100%",
    alignSelf: "center",
    opacity: 0.045,
  },

  content: {
    padding: 18,
    paddingBottom: 140,
  },

  contentWeb: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 80,
  },

  panelHeader: {
    marginBottom: 16,
  },

  backButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  backButtonText: {
    color: BRAND.blue,
    fontWeight: "900",
    fontSize: 15,
  },

  header: {
    fontSize: 34,
    fontWeight: "900",
    color: BRAND.text,
  },

  subheader: {
    color: BRAND.muted,
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
    marginBottom: 16,
  },

  card: {
    backgroundColor: "#FFFFFFEE",
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
  },

  sectionTitle: {
    fontWeight: "900",
    fontSize: 20,
    color: BRAND.text,
    marginBottom: 10,
  },

  row: {
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  rowTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: BRAND.text,
  },

  rowTitleDanger: {
    color: "#B42318",
  },

  rowSubtitle: {
    marginTop: 4,
    color: BRAND.muted,
    fontSize: 13,
    lineHeight: 18,
  },

  chevron: {
    fontSize: 26,
    color: BRAND.blue,
    fontWeight: "700",
  },

  inputLabel: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 8,
    marginTop: 10,
  },

  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 14,
    color: BRAND.text,
    fontWeight: "800",
    fontSize: 16,
  },

  quickOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },

  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  optionPill: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    backgroundColor: "#F8FBFF",
    alignItems: "center",
    justifyContent: "center",
  },

  optionPillSelected: {
    backgroundColor: BRAND.pink,
    borderColor: BRAND.pink,
  },

  optionPillText: {
    color: BRAND.text,
    fontWeight: "900",
  },

  optionPillTextSelected: {
    color: "#fff",
  },

  switchRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },

  switchTitle: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 15,
  },

  switchSubtitle: {
    marginTop: 4,
    color: BRAND.muted,
    fontSize: 13,
    lineHeight: 18,
    paddingRight: 10,
  },

  noticeBox: {
    borderRadius: 18,
    backgroundColor: "#FFF7FB",
    borderWidth: 1.5,
    borderColor: "#F4CFE4",
    padding: 14,
    marginTop: 4,
  },

  noticeTitle: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 15,
  },

  noticeText: {
    marginTop: 5,
    color: BRAND.muted,
    fontWeight: "700",
    lineHeight: 20,
    fontSize: 13,
  },

  primaryButton: {
    marginTop: 16,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },

  buttonDisabled: {
    opacity: 0.55,
  },

  secondaryButton: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  secondaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },

  largeText: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 20,
    marginBottom: 8,
  },

  bodyText: {
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 10,
  },

  tipTitle: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 8,
    marginBottom: 4,
  },

  statusBox: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: "#F8FBFF",
    borderWidth: 1.5,
    borderColor: "#DCE5FF",
    padding: 14,
  },

  statusText: {
    color: BRAND.blue,
    fontWeight: "900",
  },

  goldCard: {
    backgroundColor: "#111111",
    borderRadius: 28,
    padding: 20,
    marginBottom: 14,
  },

  goldBadge: {
    color: "#F6C343",
    fontWeight: "900",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  goldTitle: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
  },

  goldPrice: {
    marginTop: 14,
    color: "#FFFFFF",
    fontSize: 46,
    fontWeight: "900",
  },

  goldSub: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: "800",
    fontSize: 15,
  },

  goldText: {
    marginTop: 14,
    color: "rgba(255,255,255,0.82)",
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 23,
  },

  goldFeature: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: "rgba(246,195,67,0.12)",
    borderWidth: 1,
    borderColor: "rgba(246,195,67,0.28)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  goldFeatureText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },

  goldButton: {
    marginTop: 18,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#F6C343",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  goldButtonText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 16,
  },

  goldSecondaryButton: {
    marginTop: 10,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  goldSecondaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },

  goldFinePrint: {
    marginTop: 12,
    color: "rgba(255,255,255,0.58)",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
  },

  logoutButton: {
    marginTop: 10,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  logoutButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
});
