import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import {
  MATCH_SCOPE_OPTIONS,
  MatchScope,
  scopeLabel,
} from "../../lib/speedDating";
import {
  cancelRemoteSpeedDatingQueue,
  cleanupRemoteSpeedDatingState,
  joinRemoteSpeedDatingQueue,
  recoverRemoteSpeedDatingSession,
} from "../../lib/speedDatingRemote";

export default function SpeedDatingLobbyScreen() {
  const router = useRouter();

  const [selectedScope, setSelectedScope] =
    useState<MatchScope>("worldwide");

  const [isStarting, setIsStarting] =
    useState(false);

  const [isRecovering, setIsRecovering] =
    useState(true);

  const [recoveryMessage, setRecoveryMessage] =
    useState(
      "Checking for an unfinished Speed Date…",
    );

  const [recoveredSessionId, setRecoveredSessionId] =
    useState<string | null>(null);

  const [recoveredScope, setRecoveredScope] =
    useState<MatchScope | null>(null);

  const selectedOption = useMemo(
    () =>
      MATCH_SCOPE_OPTIONS.find(
        (option) =>
          option.value === selectedScope,
      ) ?? MATCH_SCOPE_OPTIONS[2],
    [selectedScope],
  );

  const openSpeedDateRoom = (
    sessionId: string,
    scope: MatchScope,
  ) => {
    router.push(
      `/speed-date/${encodeURIComponent(
        sessionId,
      )}?scope=${encodeURIComponent(scope)}` as never,
    );
  };

  useEffect(() => {
    let active = true;

    const recoverLobbyState = async () => {
      setIsRecovering(true);
      setRecoveryMessage(
        "Checking for an unfinished Speed Date…",
      );

      try {
        await cleanupRemoteSpeedDatingState();

        const recovered =
          await recoverRemoteSpeedDatingSession();

        if (!active) {
          return;
        }

        if (
          recovered.status === "recovered" &&
          recovered.sessionId
        ) {
          const normalizedScope =
            MATCH_SCOPE_OPTIONS.some(
              (option) =>
                option.value ===
                recovered.scope,
            )
              ? (recovered.scope as MatchScope)
              : "worldwide";

          setRecoveredSessionId(
            recovered.sessionId,
          );

          setRecoveredScope(
            normalizedScope,
          );

          setSelectedScope(
            normalizedScope,
          );

          setRecoveryMessage(
            recovered.sessionStatus ===
              "continued"
              ? "Your previous mutual match is ready."
              : recovered.sessionStatus ===
                  "decision"
                ? "Your previous Speed Date is waiting for your private decision."
                : "You have an unfinished Speed Date ready to resume.",
          );

          return;
        }

        setRecoveredSessionId(null);
        setRecoveredScope(null);
        setRecoveryMessage(
          "No unfinished Speed Date was found.",
        );
      } catch (error) {
        console.warn(
          "Speed Dating recovery warning",
          error,
        );

        if (!active) {
          return;
        }

        setRecoveredSessionId(null);
        setRecoveredScope(null);
        setRecoveryMessage(
          "Recovery is temporarily unavailable. You can still join a new queue.",
        );
      } finally {
        if (active) {
          setIsRecovering(false);
        }
      }
    };

    void recoverLobbyState();

    return () => {
      active = false;
    };
  }, []);

  const resumeRecoveredSpeedDate = () => {
    if (
      !recoveredSessionId ||
      !recoveredScope
    ) {
      return;
    }

    openSpeedDateRoom(
      recoveredSessionId,
      recoveredScope,
    );
  };

  const discardRecoveredSpeedDate = async () => {
    if (isStarting) {
      return;
    }

    setIsStarting(true);

    try {
      await cancelRemoteSpeedDatingQueue();

      setRecoveredSessionId(null);
      setRecoveredScope(null);
      setRecoveryMessage(
        "Previous Speed Dating state cleared.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "PolyOpen could not clear the previous Speed Dating state.";

      Alert.alert(
        "Unable to clear previous session",
        message,
      );
    } finally {
      setIsStarting(false);
    }
  };

  const startSpeedDate = async () => {
    if (isStarting) {
      return;
    }

    setIsStarting(true);

    try {
      await cleanupRemoteSpeedDatingState();

      const recovered =
        await recoverRemoteSpeedDatingSession();

      if (
        recovered.status === "recovered" &&
        recovered.sessionId
      ) {
        const recoveredScopeValue =
          MATCH_SCOPE_OPTIONS.some(
            (option) =>
              option.value ===
              recovered.scope,
          )
            ? (recovered.scope as MatchScope)
            : selectedScope;

        setRecoveredSessionId(
          recovered.sessionId,
        );

        setRecoveredScope(
          recoveredScopeValue,
        );

        openSpeedDateRoom(
          recovered.sessionId,
          recoveredScopeValue,
        );

        return;
      }

      const result =
        await joinRemoteSpeedDatingQueue(
          selectedScope,
        );

      if (
        result.status === "matched" &&
        result.sessionId
      ) {
        openSpeedDateRoom(
          result.sessionId,
          selectedScope,
        );

        return;
      }

      if (result.status === "waiting") {
        openSpeedDateRoom(
          "queue",
          selectedScope,
        );

        return;
      }

      throw new Error(
        `Unexpected queue state: ${result.status}`,
      );
    } catch (error) {
      console.error(
        "Unable to join Speed Dating",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "PolyOpen could not join the Speed Dating queue.";

      Alert.alert(
        "Unable to start Speed Dating",
        message,
      );

      setIsStarting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />

            <Text style={styles.liveBadgeText}>
              LIVE SPEED DATING
            </Text>
          </View>

          <Text style={styles.heroTitle}>
            Meet someone real.
          </Text>

          <Text style={styles.heroSubtitle}>
            Join a live queue and have a private,
            respectful two-minute conversation with
            another PolyOpen member.
          </Text>
        </View>

        <View style={styles.recoveryCard}>
          <View style={styles.recoveryHeader}>
            <View
              style={[
                styles.recoveryStatusDot,
                recoveredSessionId &&
                  styles.recoveryStatusDotActive,
              ]}
            />

            <Text style={styles.recoveryEyebrow}>
              SESSION RECOVERY
            </Text>
          </View>

          <Text style={styles.recoveryText}>
            {recoveryMessage}
          </Text>

          {isRecovering ? (
            <Text style={styles.recoveryWorkingText}>
              Checking securely…
            </Text>
          ) : null}

          {recoveredSessionId &&
          recoveredScope ? (
            <View style={styles.recoveryActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isStarting}
                onPress={
                  resumeRecoveredSpeedDate
                }
                style={styles.resumeButton}
              >
                <Text
                  style={
                    styles.resumeButtonText
                  }
                >
                  Resume Speed Date
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={isStarting}
                onPress={() =>
                  void discardRecoveredSpeedDate()
                }
                style={styles.clearRecoveryButton}
              >
                <Text
                  style={
                    styles.clearRecoveryButtonText
                  }
                >
                  Clear
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.liveSystemCard}>
          <Text style={styles.liveSystemEyebrow}>
            LIVE MATCHMAKING IS ACTIVE
          </Text>

          <Text style={styles.liveSystemTitle}>
            Two people. Two minutes. One private choice.
          </Text>

          <Text style={styles.liveSystemText}>
            PolyOpen now uses authenticated Supabase
            matchmaking. Fake demo profiles are no longer
            used in the Speed Dating flow.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Who would you like to meet?
          </Text>

          <Text style={styles.sectionDescription}>
            Choose a pool before joining the live queue.
          </Text>
        </View>

        <View style={styles.scopeGrid}>
          {MATCH_SCOPE_OPTIONS.map((option) => {
            const isSelected =
              option.value === selectedScope;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{
                  selected: isSelected,
                }}
                disabled={isStarting}
                onPress={() =>
                  setSelectedScope(option.value)
                }
                style={({ pressed }) => [
                  styles.scopeCard,
                  isSelected &&
                    styles.scopeCardSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.scopeEmoji}>
                  {option.emoji}
                </Text>

                <Text
                  style={[
                    styles.scopeTitle,
                    isSelected &&
                      styles.scopeTitleSelected,
                  ]}
                >
                  {option.title}
                </Text>

                <Text style={styles.scopeDescription}>
                  {option.description}
                </Text>

                {isSelected ? (
                  <View style={styles.selectedPill}>
                    <Text
                      style={styles.selectedPillText}
                    >
                      Selected
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {selectedOption?.privacyNote ? (
          <View style={styles.privacyCard}>
            <Text style={styles.privacyIcon}>
              🔒
            </Text>

            <View style={styles.privacyContent}>
              <Text style={styles.privacyTitle}>
                Your privacy matters
              </Text>

              <Text style={styles.privacyText}>
                {selectedOption.privacyNote}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.explainerCard}>
          <Text style={styles.explainerEyebrow}>
            HOW LIVE SPEED DATING WORKS
          </Text>

          <Text style={styles.explainerItem}>
            1. PolyOpen places you in an authenticated
            matchmaking queue.
          </Text>

          <Text style={styles.explainerItem}>
            2. When another member joins the same pool,
            Supabase creates one private session for both
            people.
          </Text>

          <Text style={styles.explainerItem}>
            3. The shared server timer gives both people
            the same two-minute ending time.
          </Text>

          <Text style={styles.explainerItem}>
            4. Chat unlocks only when both people privately
            choose Continue.
          </Text>
        </View>

        <View style={styles.coachingCard}>
          <Text style={styles.coachingTitle}>
            Private conversation prompts
          </Text>

          <Text style={styles.coachingText}>
            Prompts are selected locally on your device.
            PolyOpen does not analyze either person’s face,
            movements, expressions, voice, or behavior.
          </Text>
        </View>

        <View style={styles.commitmentCard}>
          <Text style={styles.commitmentTitle}>
            The two-minute commitment
          </Text>

          <Text style={styles.commitmentText}>
            Stay present and respectful until the timer
            ends unless leaving is necessary for your
            comfort or safety.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={
            isStarting ||
            isRecovering
          }
          onPress={startSpeedDate}
          style={({ pressed }) => [
            styles.startButton,
            (isStarting ||
              isRecovering) &&
              styles.startButtonDisabled,
            pressed &&
              !isStarting &&
              !isRecovering &&
              styles.startButtonPressed,
          ]}
        >
          <Text style={styles.startButtonText}>
            {isRecovering
              ? "Checking previous session..."
              : isStarting
                ? "Joining the live queue..."
                : recoveredSessionId
                  ? "Resume your Speed Date above"
                  : `Find a ${scopeLabel(
                      selectedScope,
                    )} Date`}
          </Text>

          <Text style={styles.startButtonArrow}>
            →
          </Text>
        </Pressable>

        <Text style={styles.adDisclosure}>
          A production advertisement checkpoint will be
          connected after LiveKit video integration.
          Premium + No Ads members will skip it.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF8FC",
  },
  screen: {
    flex: 1,
    backgroundColor: "#FFF8FC",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 130,
  },
  hero: {
    paddingTop: 8,
    paddingBottom: 22,
  },
  liveBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#FFE0F1",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E00072",
  },
  liveBadgeText: {
    color: "#9C0051",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heroTitle: {
    marginTop: 18,
    color: "#1D1219",
    fontSize: 38,
    lineHeight: 43,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  heroSubtitle: {
    marginTop: 12,
    color: "#6C5B65",
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "500",
  },
  recoveryCard: {
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E7D4DF",
    borderRadius: 20,
    padding: 17,
    backgroundColor: "#FFFFFF",
  },
  recoveryHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  recoveryStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#AFA2A9",
  },
  recoveryStatusDotActive: {
    backgroundColor: "#2FBF71",
  },
  recoveryEyebrow: {
    marginLeft: 8,
    color: "#725E69",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  recoveryText: {
    marginTop: 9,
    color: "#382933",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  recoveryWorkingText: {
    marginTop: 7,
    color: "#887681",
    fontSize: 12,
  },
  recoveryActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  resumeButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#F72A94",
  },
  resumeButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  clearRecoveryButton: {
    minWidth: 82,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2CDD8",
    borderRadius: 15,
    backgroundColor: "#FFF8FC",
  },
  clearRecoveryButtonText: {
    color: "#715C67",
    fontSize: 13,
    fontWeight: "800",
  },
  liveSystemCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: "#1D1219",
  },
  liveSystemEyebrow: {
    color: "#FF86C2",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  liveSystemTitle: {
    marginTop: 9,
    color: "#FFFFFF",
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "900",
  },
  liveSystemText: {
    marginTop: 9,
    color: "#CDBBC4",
    fontSize: 14,
    lineHeight: 21,
  },
  sectionHeader: {
    marginTop: 29,
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#1D1219",
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "900",
  },
  sectionDescription: {
    marginTop: 5,
    color: "#74636D",
    fontSize: 14,
    lineHeight: 20,
  },
  scopeGrid: {
    gap: 12,
  },
  scopeCard: {
    minHeight: 132,
    borderWidth: 2,
    borderColor: "#F0DDE7",
    borderRadius: 22,
    padding: 18,
    backgroundColor: "#FFFFFF",
  },
  scopeCardSelected: {
    borderColor: "#F72A94",
    backgroundColor: "#FFF0F8",
  },
  scopeEmoji: {
    fontSize: 27,
  },
  scopeTitle: {
    marginTop: 10,
    color: "#2A1B23",
    fontSize: 18,
    fontWeight: "900",
  },
  scopeTitleSelected: {
    color: "#B3005A",
  },
  scopeDescription: {
    marginTop: 5,
    paddingRight: 72,
    color: "#75636D",
    fontSize: 14,
    lineHeight: 20,
  },
  selectedPill: {
    position: "absolute",
    top: 16,
    right: 16,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F72A94",
  },
  selectedPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  privacyCard: {
    marginTop: 14,
    flexDirection: "row",
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#F0F7FF",
  },
  privacyIcon: {
    fontSize: 22,
  },
  privacyContent: {
    flex: 1,
    marginLeft: 12,
  },
  privacyTitle: {
    color: "#193856",
    fontSize: 15,
    fontWeight: "900",
  },
  privacyText: {
    marginTop: 4,
    color: "#4C6580",
    fontSize: 13,
    lineHeight: 19,
  },
  explainerCard: {
    marginTop: 20,
    borderRadius: 22,
    padding: 19,
    backgroundColor: "#F4EBF0",
  },
  explainerEyebrow: {
    color: "#9E0050",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  explainerItem: {
    marginTop: 12,
    color: "#523D48",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  coachingCard: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#E7D5FF",
    borderRadius: 22,
    padding: 18,
    backgroundColor: "#F8F1FF",
  },
  coachingTitle: {
    color: "#38204A",
    fontSize: 17,
    fontWeight: "900",
  },
  coachingText: {
    marginTop: 9,
    color: "#624D70",
    fontSize: 14,
    lineHeight: 21,
  },
  commitmentCard: {
    marginTop: 18,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#FFF1D8",
  },
  commitmentTitle: {
    color: "#523A13",
    fontSize: 16,
    fontWeight: "900",
  },
  commitmentText: {
    marginTop: 7,
    color: "#735C35",
    fontSize: 14,
    lineHeight: 21,
  },
  startButton: {
    marginTop: 24,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingHorizontal: 22,
    backgroundColor: "#F72A94",
  },
  startButtonDisabled: {
    opacity: 0.62,
  },
  startButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  startButtonText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  startButtonArrow: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  adDisclosure: {
    marginTop: 14,
    paddingHorizontal: 10,
    color: "#8B7A84",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
