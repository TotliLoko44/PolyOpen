import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useFocusEffect,
  useRouter,
} from "expo-router";

import {
  MATCH_SCOPE_OPTIONS,
  MatchScope,
  scopeLabel,
} from "../../lib/speedDating";

import {
  cancelRemoteSpeedDatingQueue,
  getAuthenticatedSpeedDatingUser,
  getRemoteSpeedDatingMatch,
  joinRemoteSpeedDatingQueue,
  recoverRemoteSpeedDatingSession,
} from "../../lib/speedDatingRemote";

type LobbyState =
  | "checking"
  | "idle"
  | "joining"
  | "waiting"
  | "matched"
  | "leaving"
  | "error";

const POLL_INTERVAL_MS = 3000;

export default function SpeedDatingLobbyScreen() {
  const router = useRouter();

  const mountedRef = useRef(true);

  const pollTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null,
    );

  const navigatingRef = useRef(false);

  const [lobbyState, setLobbyState] =
    useState<LobbyState>("checking");

  const [selectedScope, setSelectedScope] =
    useState<MatchScope>(
      MATCH_SCOPE_OPTIONS[0].value,
    );

  const [statusMessage, setStatusMessage] =
    useState(
      "Checking for an unfinished Speed Date…",
    );

  const [
    recoveredSessionId,
    setRecoveredSessionId,
  ] = useState<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const openSession = useCallback(
    (sessionId: string) => {
      if (
        !sessionId ||
        navigatingRef.current
      ) {
        return;
      }

      navigatingRef.current = true;

      stopPolling();

      setLobbyState("matched");

      setStatusMessage(
        "Date found! Opening your private Speed Date…",
      );

      router.push(
        `/speed-date/${encodeURIComponent(
          sessionId,
        )}`,
      );

      setTimeout(() => {
        navigatingRef.current = false;
      }, 1500);
    },
    [
      router,
      stopPolling,
    ],
  );

  const checkForMatch = useCallback(
    async () => {
      try {
        const result =
          await getRemoteSpeedDatingMatch();

        if (!mountedRef.current) {
          return;
        }

        if (
          result.status === "matched" &&
          result.sessionId
        ) {
          openSession(result.sessionId);
          return;
        }

        if (
          result.status === "waiting"
        ) {
          setLobbyState("waiting");

          setStatusMessage(
            "Finding someone who's ready to meet you…",
          );

          return;
        }

        if (
          result.status === "idle"
        ) {
          stopPolling();

          setLobbyState("idle");

          setStatusMessage(
            "Ready when you are.",
          );
        }
      } catch (error: any) {
        if (!mountedRef.current) {
          return;
        }

        stopPolling();

        setLobbyState("error");

        setStatusMessage(
          error?.message ??
            "PolyOpen could not check the matchmaking queue.",
        );
      }
    },
    [
      openSession,
      stopPolling,
    ],
  );

  const startPolling = useCallback(() => {
    stopPolling();

    void checkForMatch();

    pollTimerRef.current =
      setInterval(() => {
        void checkForMatch();
      }, POLL_INTERVAL_MS);
  }, [
    checkForMatch,
    stopPolling,
  ]);

  const recoverLobby = useCallback(
    async () => {
      navigatingRef.current = false;

      setLobbyState("checking");

      setStatusMessage(
        "Checking for an unfinished Speed Date…",
      );

      try {
        await getAuthenticatedSpeedDatingUser();

        const recovery =
          await recoverRemoteSpeedDatingSession();

        if (!mountedRef.current) {
          return;
        }

        if (
          recovery.status === "recovered" &&
          recovery.sessionId
        ) {
          setRecoveredSessionId(
            recovery.sessionId,
          );

          setLobbyState("idle");

          setStatusMessage(
            recovery.sessionStatus === "decision"
              ? "Your previous Speed Date is waiting for your private decision."
              : "You have an unfinished Speed Date ready to resume.",
          );

          return;
        }

        setRecoveredSessionId(null);

        const queue =
          await getRemoteSpeedDatingMatch();

        if (!mountedRef.current) {
          return;
        }

        if (
          queue.status === "matched" &&
          queue.sessionId
        ) {
          openSession(queue.sessionId);
          return;
        }

        if (
          queue.status === "waiting"
        ) {
          setLobbyState("waiting");

          setStatusMessage(
            "You're already in line. Finding someone who's ready to meet you…",
          );

          startPolling();
          return;
        }

        setLobbyState("idle");

        setStatusMessage(
          "No unfinished Speed Date was found.",
        );
      } catch (error: any) {
        if (!mountedRef.current) {
          return;
        }

        setLobbyState("error");

        setStatusMessage(
          error?.message ??
            "PolyOpen could not prepare Speed Dating.",
        );
      }
    },
    [
      openSession,
      startPolling,
    ],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;

      void recoverLobby();

      return () => {
        stopPolling();
      };
    }, [
      recoverLobby,
      stopPolling,
    ]),
  );

  const startDate = useCallback(
    async () => {
      if (
        lobbyState === "joining" ||
        lobbyState === "waiting" ||
        lobbyState === "matched"
      ) {
        return;
      }

      setRecoveredSessionId(null);

      setLobbyState("joining");

      setStatusMessage(
        "Joining the live Speed Dating queue…",
      );

      try {
        await getAuthenticatedSpeedDatingUser();

        const result =
          await joinRemoteSpeedDatingQueue(
            selectedScope,
          );

        if (!mountedRef.current) {
          return;
        }

        if (
          result.status === "matched" &&
          result.sessionId
        ) {
          openSession(result.sessionId);
          return;
        }

        setLobbyState("waiting");

        setStatusMessage(
          "Finding someone who's ready to meet you…",
        );

        startPolling();
      } catch (error: any) {
        if (!mountedRef.current) {
          return;
        }

        setLobbyState("error");

        setStatusMessage(
          error?.message ??
            "PolyOpen could not join the Speed Dating queue.",
        );

        Alert.alert(
          "Unable to start Speed Date",
          error?.message ??
            "Please try again.",
        );
      }
    },
    [
      lobbyState,
      openSession,
      selectedScope,
      startPolling,
    ],
  );

  const leaveQueue = useCallback(
    async () => {
      if (
        lobbyState !== "waiting"
      ) {
        return;
      }

      stopPolling();

      setLobbyState("leaving");

      setStatusMessage(
        "Leaving the matchmaking queue…",
      );

      try {
        await cancelRemoteSpeedDatingQueue();

        if (!mountedRef.current) {
          return;
        }

        setLobbyState("idle");

        setStatusMessage(
          "You left the queue. Start again whenever you're ready.",
        );
      } catch (error: any) {
        if (!mountedRef.current) {
          return;
        }

        setLobbyState("error");

        setStatusMessage(
          error?.message ??
            "PolyOpen could not leave the queue.",
        );

        Alert.alert(
          "Unable to leave queue",
          error?.message ??
            "Please try again.",
        );
      }
    },
    [
      lobbyState,
      stopPolling,
    ],
  );

  const resumeDate = useCallback(() => {
    if (!recoveredSessionId) {
      return;
    }

    openSession(recoveredSessionId);
  }, [
    openSession,
    recoveredSessionId,
  ]);

  const isBusy =
    lobbyState === "checking" ||
    lobbyState === "joining" ||
    lobbyState === "leaving";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />

          <Text style={styles.liveBadgeText}>
            LIVE SPEED DATING
          </Text>
        </View>

        <Text style={styles.heroTitle}>
          Meet someone{"\n"}real.
        </Text>

        <Text style={styles.heroDescription}>
          Join a live queue and have a
          private, respectful two-minute
          conversation with another
          PolyOpen member.
        </Text>

        <View style={styles.recoveryCard}>
          <View style={styles.cardLabelRow}>
            <View
              style={[
                styles.statusDot,
                lobbyState === "waiting" &&
                  styles.statusDotLive,
              ]}
            />

            <Text style={styles.cardLabel}>
              {lobbyState === "waiting"
                ? "LIVE QUEUE"
                : "SESSION RECOVERY"}
            </Text>
          </View>

          <Text style={styles.statusMessage}>
            {statusMessage}
          </Text>

          {isBusy ? (
            <ActivityIndicator
              size="small"
              style={styles.loader}
            />
          ) : null}

          {recoveredSessionId ? (
            <Pressable
              style={styles.resumeButton}
              onPress={resumeDate}
            >
              <Text
                style={
                  styles.resumeButtonText
                }
              >
                Resume Speed Date
              </Text>
            </Pressable>
          ) : null}
        </View>

        {lobbyState !== "waiting" &&
        !recoveredSessionId ? (
          <>
            <Text style={styles.sectionLabel}>
              WHO WOULD YOU LIKE TO MEET?
            </Text>

            <View style={styles.scopeList}>
              {MATCH_SCOPE_OPTIONS.map(
                (option) => {
                  const selected =
                    selectedScope ===
                    option.value;

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() =>
                        setSelectedScope(
                          option.value,
                        )
                      }
                      disabled={isBusy}
                      style={[
                        styles.scopeButton,
                        selected &&
                          styles.scopeButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.scopeEmoji,
                          selected &&
                            styles.scopeEmojiSelected,
                        ]}
                      >
                        {option.emoji}
                      </Text>

                      <Text
                        style={[
                          styles.scopeButtonText,
                          selected &&
                            styles.scopeButtonTextSelected,
                        ]}
                      >
                        {option.title}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>

            <Pressable
              onPress={() => {
                void startDate();
              }}
              disabled={isBusy}
              style={({ pressed }) => [
                styles.startButton,
                pressed &&
                  styles.buttonPressed,
                isBusy &&
                  styles.buttonDisabled,
              ]}
            >
              {lobbyState ===
              "joining" ? (
                <ActivityIndicator
                  size="small"
                />
              ) : (
                <>
                  <Text
                    style={
                      styles.startButtonTitle
                    }
                  >
                    START DATE
                  </Text>

                  <Text
                    style={
                      styles.startButtonSubtitle
                    }
                  >
                    Find someone now
                  </Text>
                </>
              )}
            </Pressable>

            <Text style={styles.scopeNote}>
              Current pool:{" "}
              {scopeLabel(selectedScope)}
            </Text>
          </>
        ) : null}

        {lobbyState === "waiting" ? (
          <View style={styles.waitingCard}>
            <ActivityIndicator
              size="large"
              style={styles.waitingLoader}
            />

            <Text style={styles.waitingTitle}>
              Finding your date…
            </Text>

            <Text
              style={
                styles.waitingDescription
              }
            >
              You&apos;re live in the queue.
              PolyOpen will automatically
              open the date when another
              available member joins.
            </Text>

            <View style={styles.waitingPulse}>
              <Text
                style={
                  styles.waitingPulseText
                }
              >
                SEARCHING LIVE
              </Text>
            </View>

            <Pressable
              style={styles.leaveButton}
              onPress={() => {
                void leaveQueue();
              }}
            >
              <Text
                style={
                  styles.leaveButtonText
                }
              >
                LEAVE QUEUE
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.matchmakingCard}>
          <Text
            style={
              styles.matchmakingEyebrow
            }
          >
            LIVE MATCHMAKING IS ACTIVE
          </Text>

          <Text
            style={
              styles.matchmakingTitle
            }
          >
            Two people. Two minutes.
            {"\n"}One private choice.
          </Text>

          <Text
            style={
              styles.matchmakingDescription
            }
          >
            PolyOpen uses authenticated
            Supabase matchmaking. When two
            compatible members are waiting
            in the same pool, PolyOpen
            creates a private Speed Date
            automatically.
          </Text>
        </View>

        <View style={styles.howCard}>
          <Text style={styles.howTitle}>
            HOW LIVE SPEED DATING WORKS
          </Text>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>
              1
            </Text>

            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>
                Start Date
              </Text>

              <Text style={styles.stepText}>
                Choose your pool and enter
                the live matchmaking queue.
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>
              2
            </Text>

            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>
                Meet live
              </Text>

              <Text style={styles.stepText}>
                When another member is
                available, both of you enter
                a private two-minute video
                date.
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>
              3
            </Text>

            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>
                Choose privately
              </Text>

              <Text style={styles.stepText}>
                After the date, choose
                Continue or Pass. A
                connection is created only
                when both people choose
                Continue.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF8FC",
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },

  liveBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCE1F0",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 22,
  },

  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#E60087",
    marginRight: 10,
  },

  liveBadgeText: {
    color: "#A30A5D",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },

  heroTitle: {
    color: "#171014",
    fontSize: 48,
    lineHeight: 53,
    fontWeight: "900",
    letterSpacing: -2,
  },

  heroDescription: {
    color: "#6D6469",
    fontSize: 19,
    lineHeight: 29,
    fontWeight: "600",
    marginTop: 18,
    marginBottom: 26,
  },

  recoveryCard: {
    borderWidth: 1,
    borderColor: "#E7D7DF",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    marginBottom: 26,
  },

  cardLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#B7AEB3",
    marginRight: 10,
  },

  statusDotLive: {
    backgroundColor: "#E60087",
  },

  cardLabel: {
    color: "#776D72",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  statusMessage: {
    color: "#30282C",
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "700",
    marginTop: 13,
  },

  loader: {
    marginTop: 15,
  },

  resumeButton: {
    backgroundColor: "#171014",
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 18,
  },

  resumeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  sectionLabel: {
    color: "#776D72",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 13,
  },

  scopeList: {
    gap: 9,
    marginBottom: 18,
  },

  scopeButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6D7DF",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  scopeButtonSelected: {
    borderColor: "#E63DA1",
    backgroundColor: "#FCE4F2",
  },

  scopeEmoji: {
    fontSize: 20,
    marginRight: 10,
  },

  scopeEmojiSelected: {
    opacity: 1,
  },

  scopeButtonText: {
    color: "#70666B",
    fontSize: 15,
    fontWeight: "800",
  },

  scopeButtonTextSelected: {
    color: "#B10C69",
  },

  startButton: {
    minHeight: 76,
    borderRadius: 22,
    backgroundColor: "#EA3EA6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },

  buttonPressed: {
    opacity: 0.85,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  startButtonTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  startButtonSubtitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    opacity: 0.88,
    marginTop: 3,
  },

  scopeNote: {
    textAlign: "center",
    color: "#887E83",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 28,
  },

  waitingCard: {
    backgroundColor: "#171014",
    borderRadius: 26,
    padding: 25,
    alignItems: "center",
    marginBottom: 28,
  },

  waitingLoader: {
    marginBottom: 18,
  },

  waitingTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },

  waitingDescription: {
    color: "#D4C9CF",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
  },

  waitingPulse: {
    borderRadius: 999,
    backgroundColor: "#34232D",
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 20,
  },

  waitingPulseText: {
    color: "#FF76C8",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  leaveButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#65525C",
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 15,
    marginTop: 20,
  },

  leaveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  matchmakingCard: {
    backgroundColor: "#1B1016",
    borderRadius: 26,
    padding: 24,
    marginBottom: 28,
  },

  matchmakingEyebrow: {
    color: "#FF75C6",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  matchmakingTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    lineHeight: 35,
    fontWeight: "900",
    marginTop: 14,
  },

  matchmakingDescription: {
    color: "#D0C4CA",
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "600",
    marginTop: 15,
  },

  howCard: {
    borderWidth: 1,
    borderColor: "#E8D9E1",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 22,
  },

  howTitle: {
    color: "#6F646A",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginBottom: 22,
  },

  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 22,
  },

  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FCE3F2",
    color: "#C9187D",
    fontSize: 17,
    lineHeight: 36,
    fontWeight: "900",
    textAlign: "center",
    marginRight: 14,
  },

  stepCopy: {
    flex: 1,
  },

  stepTitle: {
    color: "#21181D",
    fontSize: 17,
    fontWeight: "900",
  },

  stepText: {
    color: "#746A6F",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    marginTop: 4,
  },

  bottomSpacer: {
    height: 150,
  },
});
