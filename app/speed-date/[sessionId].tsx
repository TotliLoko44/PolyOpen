import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  AppState,
  BackHandler,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import LiveSpeedDatingVideo from "../../components/speedDating/LiveSpeedDatingVideo";
import {
  MATCH_SCOPE_OPTIONS,
  MatchScope,
  SPEED_DATE_DURATION_SECONDS,
  chooseConversationPrompt,
  scopeLabel,
} from "../../lib/speedDating";
import {
  SpeedDatingDecision,
  SpeedDatingDecisionRow,
  SpeedDatingSessionRow,
  cancelRemoteSpeedDatingQueue,
  getAuthenticatedSpeedDatingUser,
  getRemoteSpeedDatingMatch,
  getRemoteSpeedDatingSession,
  getSpeedDatingDecisions,
  heartbeatRemoteSpeedDatingSession,
  isSpeedDatingChatUnlocked,
  leaveRemoteSpeedDatingSession,
  startRemoteSpeedDatingSession,
  submitRemoteSpeedDatingDecision,
  subscribeToSpeedDatingSession,
  unsubscribeFromSpeedDatingSession,
} from "../../lib/speedDatingRemote";

type RoomPhase =
  | "searching"
  | "connecting"
  | "connected"
  | "decision"
  | "waiting-decision"
  | "mutual"
  | "passed"
  | "error";

function isMatchScope(
  value: string | undefined,
): value is MatchScope {
  return MATCH_SCOPE_OPTIONS.some(
    (option) => option.value === value,
  );
}

function secondsUntil(
  isoDate: string | null,
): number {
  if (!isoDate) {
    return SPEED_DATE_DURATION_SECONDS;
  }

  const milliseconds =
    new Date(isoDate).getTime() - Date.now();

  return Math.max(
    0,
    Math.ceil(milliseconds / 1000),
  );
}

export default function SpeedDateRoomScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    sessionId?: string | string[];
    scope?: string | string[];
  }>();

  const routeSessionId = Array.isArray(
    params.sessionId,
  )
    ? params.sessionId[0]
    : params.sessionId ?? "";

  const requestedScopeValue = Array.isArray(
    params.scope,
  )
    ? params.scope[0]
    : params.scope;

  const requestedScope: MatchScope =
    isMatchScope(requestedScopeValue)
      ? requestedScopeValue
      : "worldwide";

  const [sessionId, setSessionId] =
    useState(
      routeSessionId === "queue"
        ? ""
        : routeSessionId,
    );

  const [phase, setPhase] =
    useState<RoomPhase>(
      routeSessionId === "queue"
        ? "searching"
        : "connecting",
    );

  const [session, setSession] =
    useState<SpeedDatingSessionRow | null>(
      null,
    );

  const [userId, setUserId] =
    useState("");

  const [partnerId, setPartnerId] =
    useState("");

  const [remainingSeconds, setRemainingSeconds] =
    useState(SPEED_DATE_DURATION_SECONDS);

  const [prompt, setPrompt] = useState(
    chooseConversationPrompt(),
  );

  const [promptVisible, setPromptVisible] =
    useState(true);

  const [decision, setDecision] =
    useState<SpeedDatingDecision | null>(
      null,
    );

  const [partnerDecision, setPartnerDecision] =
    useState<SpeedDatingDecision | null>(
      null,
    );

  const [chatUnlocked, setChatUnlocked] =
    useState(false);

  const [isSubmittingDecision, setIsSubmittingDecision] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [realtimeStatus, setRealtimeStatus] =
    useState<
      | "connecting"
      | "subscribed"
      | "recovering"
      | "degraded"
    >("connecting");

  const reconciliationRunningRef =
    useRef(false);

  const channelRef = useRef<
    ReturnType<
      typeof subscribeToSpeedDatingSession
    > | null
  >(null);

  const matchPollBusyRef =
    useRef(false);

  const scope =
    isMatchScope(session?.scope)
      ? session.scope
      : requestedScope;

  const scopeEmoji =
    MATCH_SCOPE_OPTIONS.find(
      (option) => option.value === scope,
    )?.emoji ?? "🌎";

  const progress =
    remainingSeconds /
    SPEED_DATE_DURATION_SECONDS;

  const partnerLabel = partnerId
    ? `Member ${partnerId
        .replace(/-/g, "")
        .slice(0, 6)
        .toUpperCase()}`
    : "Your date";

  const phaseTitle = useMemo(() => {
    switch (phase) {
      case "searching":
        return `Finding a ${scopeLabel(
          scope,
        )} match`;
      case "connecting":
        return "Preparing your private room";
      case "connected":
        return "Speed date in progress";
      case "decision":
        return "Make your private choice";
      case "waiting-decision":
        return "Waiting for their private choice";
      case "mutual":
        return "You both chose Continue";
      case "passed":
        return "The date is complete";
      case "error":
        return "Speed Date unavailable";
      default:
        return "PolyOpen Speed Dating";
    }
  }, [phase, scope]);

  const applyDecisionRows = useCallback(
    (
      rows: SpeedDatingDecisionRow[],
      currentUserId: string,
    ) => {
      const yourRow = rows.find(
        (row) =>
          row.user_id === currentUserId,
      );

      const theirRow = rows.find(
        (row) =>
          row.user_id !== currentUserId,
      );

      setDecision(
        yourRow?.decision ?? null,
      );

      setPartnerDecision(
        theirRow?.decision ?? null,
      );

      if (
        yourRow?.decision === "pass" ||
        theirRow?.decision === "pass"
      ) {
        setPhase("passed");
      }
    },
    [],
  );

  const configureSession = useCallback(
    async (
      nextSessionId: string,
      knownPartnerId?: string,
    ) => {
      try {
        setPhase("connecting");

        const authenticatedUser =
          await getAuthenticatedSpeedDatingUser();

        setUserId(authenticatedUser.id);

        const loadedSession =
          await getRemoteSpeedDatingSession(
            nextSessionId,
          );

        if (!loadedSession) {
          throw new Error(
            "The matched Speed Date could not be loaded.",
          );
        }

        setSession(loadedSession);

        const resolvedPartnerId =
          knownPartnerId ||
          (loadedSession.participant_one_id ===
          authenticatedUser.id
            ? loadedSession.participant_two_id
            : loadedSession.participant_one_id);

        setPartnerId(resolvedPartnerId);

        const startedSession =
          await startRemoteSpeedDatingSession(
            nextSessionId,
          );

        const refreshedSession: SpeedDatingSessionRow = {
          ...loadedSession,
          status: startedSession.status,
          started_at:
            startedSession.startedAt,
          ends_at:
            startedSession.endsAt,
          livekit_room_name:
            startedSession.livekitRoomName ??
            loadedSession.livekit_room_name,
        };

        setSession(refreshedSession);
        setRemainingSeconds(
          secondsUntil(
            refreshedSession.ends_at,
          ),
        );

        const existingDecisions =
          await getSpeedDatingDecisions(
            nextSessionId,
          );

        applyDecisionRows(
          existingDecisions,
          authenticatedUser.id,
        );

        const alreadyUnlocked =
          await isSpeedDatingChatUnlocked(
            nextSessionId,
          );

        setChatUnlocked(alreadyUnlocked);

        if (alreadyUnlocked) {
          setPhase("mutual");
        } else if (
          existingDecisions.some(
            (row) =>
              row.user_id ===
              authenticatedUser.id,
          )
        ) {
          setPhase("waiting-decision");
        } else if (
          secondsUntil(
            refreshedSession.ends_at,
          ) <= 0
        ) {
          setPhase("decision");
        } else {
          setPhase("connected");
        }

        if (channelRef.current) {
          await unsubscribeFromSpeedDatingSession(
            channelRef.current,
          );
        }

        channelRef.current =
          subscribeToSpeedDatingSession(
            nextSessionId,
            {
              onSessionChange: (
                changedSession,
              ) => {
                setSession(changedSession);
                setRemainingSeconds(
                  secondsUntil(
                    changedSession.ends_at,
                  ),
                );

                if (
                  changedSession.status ===
                  "continued"
                ) {
                  setChatUnlocked(true);
                  setPhase("mutual");
                }

                if (
                  changedSession.status ===
                  "passed"
                ) {
                  setPhase("passed");
                }
              },

              onDecisionChange: (
                changedDecision,
              ) => {
                if (
                  changedDecision.user_id ===
                  authenticatedUser.id
                ) {
                  setDecision(
                    changedDecision.decision,
                  );
                } else {
                  setPartnerDecision(
                    changedDecision.decision,
                  );
                }

                if (
                  changedDecision.decision ===
                  "pass"
                ) {
                  setPhase("passed");
                }
              },

              onChatUnlock: () => {
                setChatUnlocked(true);
                setPhase("mutual");
              },

              onStatusChange: (
                status,
              ) => {
                if (
                  status ===
                  "SUBSCRIBED"
                ) {
                  setRealtimeStatus(
                    "subscribed",
                  );
                  return;
                }

                if (
                  status ===
                    "TIMED_OUT" ||
                  status ===
                    "CHANNEL_ERROR" ||
                  status ===
                    "CLOSED"
                ) {
                  setRealtimeStatus(
                    "recovering",
                  );
                }
              },

              onError: (message) => {
                setRealtimeStatus(
                  "recovering",
                );

                console.warn(
                  "Speed Dating realtime warning",
                  message,
                );
              },
            },
          );
      } catch (error) {
        console.error(
          "Unable to configure Speed Date",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "PolyOpen could not prepare this Speed Date.",
        );

        setPhase("error");
      }
    },
    [applyDecisionRows],
  );

  useEffect(() => {
    let isMounted = true;

    getAuthenticatedSpeedDatingUser()
      .then((authenticatedUser) => {
        if (isMounted) {
          setUserId(authenticatedUser.id);
        }
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "You must sign into PolyOpen.",
        );

        setPhase("error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      routeSessionId !== "queue" &&
      routeSessionId
    ) {
      setSessionId(routeSessionId);

      void configureSession(
        routeSessionId,
      );
    }
  }, [
    configureSession,
    routeSessionId,
  ]);

  useEffect(() => {
    if (
      routeSessionId !== "queue" ||
      phase !== "searching"
    ) {
      return;
    }

    let cancelled = false;

    const checkForMatch = async () => {
      if (
        matchPollBusyRef.current ||
        cancelled
      ) {
        return;
      }

      matchPollBusyRef.current = true;

      try {
        const result =
          await getRemoteSpeedDatingMatch();

        if (
          result.status === "matched" &&
          result.sessionId
        ) {
          cancelled = true;

          setSessionId(
            result.sessionId,
          );

          router.replace(
            `/speed-date/${encodeURIComponent(
              result.sessionId,
            )}?scope=${encodeURIComponent(
              requestedScope,
            )}` as never,
          );

          await configureSession(
            result.sessionId,
            result.partnerId,
          );

          return;
        }

        if (
          result.status === "expired" ||
          result.status === "cancelled" ||
          result.status === "idle"
        ) {
          cancelled = true;

          setErrorMessage(
            "The Speed Dating queue ended before a match was found.",
          );

          setPhase("error");
        }
      } catch (error) {
        console.error(
          "Unable to poll Speed Dating queue",
          error,
        );

        cancelled = true;

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "PolyOpen could not check the matchmaking queue.",
        );

        setPhase("error");
      } finally {
        matchPollBusyRef.current = false;
      }
    };

    void checkForMatch();

    const interval = setInterval(
      () => {
        void checkForMatch();
      },
      2000,
    );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    configureSession,
    phase,
    requestedScope,
    routeSessionId,
    router,
  ]);

  useEffect(() => {
    if (
      phase !== "connected" ||
      !session?.ends_at
    ) {
      return;
    }

    const updateCountdown = () => {
      const nextSeconds =
        secondsUntil(
          session.ends_at,
        );

      setRemainingSeconds(
        nextSeconds,
      );

      if (nextSeconds <= 0) {
        setPhase("decision");
      }
    };

    updateCountdown();

    const interval = setInterval(
      updateCountdown,
      500,
    );

    return () =>
      clearInterval(interval);
  }, [
    phase,
    session?.ends_at,
  ]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    const reconcileSessionState = async () => {
      if (
        reconciliationRunningRef.current
      ) {
        return;
      }

      reconciliationRunningRef.current =
        true;

      try {
        const [
          latestSession,
          latestDecisions,
          latestChatUnlocked,
        ] = await Promise.all([
          getRemoteSpeedDatingSession(
            sessionId,
          ),
          getSpeedDatingDecisions(
            sessionId,
          ),
          isSpeedDatingChatUnlocked(
            sessionId,
          ),
        ]);

        if (cancelled) {
          return;
        }

        if (latestSession) {
          setSession(latestSession);

          setRemainingSeconds(
            secondsUntil(
              latestSession.ends_at,
            ),
          );

          if (
            latestSession.status ===
            "continued"
          ) {
            setChatUnlocked(true);
            setPhase("mutual");
          } else if (
            latestSession.status ===
              "passed" ||
            latestSession.status ===
              "cancelled" ||
            latestSession.status ===
              "ended"
          ) {
            setPhase("passed");
          } else if (
            latestSession.status ===
              "decision" &&
            phase === "connected"
          ) {
            setPhase("decision");
          }
        }

        const authenticatedUser =
          await getAuthenticatedSpeedDatingUser();

        if (cancelled) {
          return;
        }

        applyDecisionRows(
          latestDecisions,
          authenticatedUser.id,
        );

        if (latestChatUnlocked) {
          setChatUnlocked(true);
          setPhase("mutual");
        } else {
          const ownDecision =
            latestDecisions.find(
              (row) =>
                row.user_id ===
                authenticatedUser.id,
            );

          const otherDecision =
            latestDecisions.find(
              (row) =>
                row.user_id !==
                authenticatedUser.id,
            );

          if (
            ownDecision?.decision ===
              "pass" ||
            otherDecision?.decision ===
              "pass"
          ) {
            setPhase("passed");
          } else if (
            ownDecision &&
            !otherDecision
          ) {
            setPhase(
              "waiting-decision",
            );
          }
        }

        setRealtimeStatus(
          "subscribed",
        );
      } catch (error) {
        console.warn(
          "Speed Dating reconciliation warning",
          error,
        );

        if (!cancelled) {
          setRealtimeStatus(
            "degraded",
          );
        }
      } finally {
        reconciliationRunningRef.current =
          false;
      }
    };

    void reconcileSessionState();

    const interval = setInterval(
      () => {
        void reconcileSessionState();
      },
      10000,
    );

    const appStateSubscription =
      AppState.addEventListener(
        "change",
        (nextState) => {
          if (
            nextState === "active"
          ) {
            setRealtimeStatus(
              "recovering",
            );

            void reconcileSessionState();
          }
        },
      );

    return () => {
      cancelled = true;
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [
    phase,
    sessionId,
  ]);

  useEffect(() => {
    if (
      !sessionId ||
      ![
        "connecting",
        "connected",
        "decision",
        "waiting-decision",
      ].includes(phase)
    ) {
      return;
    }

    let cancelled = false;

    const sendHeartbeat = async () => {
      try {
        const heartbeat =
          await heartbeatRemoteSpeedDatingSession(
            sessionId,
          );

        if (cancelled) {
          return;
        }

        if (
          heartbeat.endsAt
        ) {
          setRemainingSeconds(
            secondsUntil(
              heartbeat.endsAt,
            ),
          );
        }

        if (
          heartbeat.status ===
          "decision" &&
          phase === "connected"
        ) {
          setPhase("decision");
        }

        if (
          heartbeat.status ===
          "continued"
        ) {
          setChatUnlocked(true);
          setPhase("mutual");
        }

        if (
          heartbeat.status ===
          "passed" ||
          heartbeat.status ===
          "cancelled" ||
          heartbeat.status ===
          "ended"
        ) {
          setPhase("passed");
        }
      } catch (error) {
        console.warn(
          "Speed Dating heartbeat warning",
          error,
        );
      }
    };

    void sendHeartbeat();

    const interval = setInterval(
      () => {
        void sendHeartbeat();
      },
      15000,
    );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    phase,
    sessionId,
  ]);

  const returnToLobby = useCallback(
    async (
      reason = "user-left",
    ) => {
      if (sessionId) {
        try {
          await leaveRemoteSpeedDatingSession(
            sessionId,
            reason,
          );
        } catch (error) {
          console.warn(
            "Unable to close Speed Date remotely",
            error,
          );
        }
      }

      router.replace("/(tabs)/swipe");
    },
    [
      router,
      sessionId,
    ],
  );

  useEffect(() => {
    const subscription =
      BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (
            phase === "connected" &&
            remainingSeconds > 0
          ) {
            Alert.alert(
              "Leave this Speed Date?",
              "Stay until the timer ends unless you need to leave for comfort or safety.",
              [
                {
                  text: "Stay",
                  style: "cancel",
                },
                {
                  text: "Leave for safety",
                  style: "destructive",
                  onPress: () =>
                    void returnToLobby(
                      "hardware-back-safety-leave",
                    ),
                },
              ],
            );

            return true;
          }

          return false;
        },
      );

    return () =>
      subscription.remove();
  }, [
    phase,
    remainingSeconds,
    returnToLobby,
  ]);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        void unsubscribeFromSpeedDatingSession(
          channelRef.current,
        );
      }
    };
  }, []);

  const cancelSearch = async () => {
    try {
      await cancelRemoteSpeedDatingQueue();
    } catch (error) {
      console.warn(
        "Unable to cancel queue",
        error,
      );
    }

    router.replace("/(tabs)/swipe");
  };

  const showAnotherPrompt = () => {
    setPrompt(
      chooseConversationPrompt(
        prompt.id,
      ),
    );

    setPromptVisible(true);
  };

  const submitDecision = async (
    nextDecision: SpeedDatingDecision,
  ) => {
    if (
      !sessionId ||
      isSubmittingDecision
    ) {
      return;
    }

    setIsSubmittingDecision(true);

    try {
      const result =
        await submitRemoteSpeedDatingDecision(
          sessionId,
          nextDecision,
        );

      setDecision(nextDecision);
      setPartnerDecision(
        result.partnerDecision,
      );

      if (
        result.chatUnlocked ||
        result.status ===
          "mutual-continue"
      ) {
        setChatUnlocked(true);
        setPhase("mutual");
      } else if (
        result.status === "passed"
      ) {
        setPhase("passed");
      } else {
        setPhase("waiting-decision");
      }
    } catch (error) {
      Alert.alert(
        "Unable to save your choice",
        error instanceof Error
          ? error.message
          : "Please try again.",
      );
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const openMessages = () => {
    router.replace(
      "/(tabs)/messages" as never,
    );
  };

  const openMiniGames = () => {
    if (!sessionId) {
      return;
    }

    router.push(
      `/speed-date/game/${encodeURIComponent(
        sessionId,
      )}` as never,
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (
                phase === "searching"
              ) {
                void cancelSearch();
                return;
              }

              if (
                phase === "connected" &&
                remainingSeconds > 0
              ) {
                Alert.alert(
                  "Leave this Speed Date?",
                  "Leave early only when necessary for your comfort or safety.",
                  [
                    {
                      text: "Stay",
                      style: "cancel",
                    },
                    {
                      text: "Leave",
                      style: "destructive",
                      onPress: () =>
                        void returnToLobby("early-leave"),
                    },
                  ],
                );

                return;
              }

              void returnToLobby();
            }}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>
              ×
            </Text>
          </Pressable>

          <View style={styles.topBarCenter}>
            <Text style={styles.topBarEyebrow}>
              {scopeEmoji}{" "}
              {scopeLabel(
                scope,
              ).toUpperCase()}
            </Text>

            <Text style={styles.topBarTitle}>
              {phaseTitle}
            </Text>
          </View>

          <View style={styles.topBarSpacer} />
        </View>

        {[
          "connecting",
          "connected",
          "decision",
          "waiting-decision",
        ].includes(phase) ? (
          <View
            style={[
              styles.realtimeStatusBanner,
              realtimeStatus ===
                "subscribed" &&
                styles.realtimeStatusBannerHealthy,
              realtimeStatus ===
                "degraded" &&
                styles.realtimeStatusBannerDegraded,
            ]}
          >
            <View
              style={[
                styles.realtimeStatusDot,
                realtimeStatus ===
                  "subscribed" &&
                  styles.realtimeStatusDotHealthy,
                realtimeStatus ===
                  "degraded" &&
                  styles.realtimeStatusDotDegraded,
              ]}
            />

            <Text
              style={
                styles.realtimeStatusText
              }
            >
              {realtimeStatus ===
              "subscribed"
                ? "Live session synchronized"
                : realtimeStatus ===
                    "degraded"
                  ? "Connection limited — restoring automatically"
                  : realtimeStatus ===
                      "recovering"
                    ? "Restoring live updates…"
                    : "Connecting live updates…"}
            </Text>
          </View>
        ) : null}

        {phase === "searching" ? (
          <View style={styles.centerStage}>
            <View style={styles.searchOrb}>
              <Text style={styles.searchOrbEmoji}>
                {scopeEmoji}
              </Text>
            </View>

            <Text style={styles.searchTitle}>
              Looking for someone online…
            </Text>

            <Text style={styles.searchDescription}>
              PolyOpen is checking the live authenticated
              queue for another member in the same pool.
            </Text>

            <View style={styles.searchDots}>
              <View style={styles.searchDot} />
              <View style={styles.searchDot} />
              <View style={styles.searchDot} />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                void cancelSearch()
              }
              style={styles.cancelSearchButton}
            >
              <Text
                style={
                  styles.cancelSearchButtonText
                }
              >
                Leave Queue
              </Text>
            </Pressable>
          </View>
        ) : null}

        {phase === "connecting" ? (
          <View style={styles.centerStage}>
            <View style={styles.connectingCard}>
              <Text
                style={styles.connectingEmoji}
              >
                🤝
              </Text>

              <Text
                style={styles.connectingTitle}
              >
                Match found
              </Text>

              <Text
                style={
                  styles.connectingDescription
                }
              >
                PolyOpen is synchronizing the private
                room and shared two-minute timer.
              </Text>
            </View>
          </View>
        ) : null}

        {phase === "connected" ? (
          <View style={styles.connectedStage}>
            <LiveSpeedDatingVideo
              sessionId={sessionId}
              partnerLabel={partnerLabel}
              remainingSeconds={remainingSeconds}
              progressPercent={Math.max(
                0,
                Math.min(
                  100,
                  progress * 100,
                ),
              )}
              onFatalError={(message) => {
                setErrorMessage(message);
                setPhase("error");
              }}
              onSafetyLeave={() => void returnToLobby("safety-leave")}
            />

            <ScrollView
              style={styles.connectedControls}
              contentContainerStyle={
                styles.connectedControlsContent
              }
              showsVerticalScrollIndicator={false}
            >
              {promptVisible ? (
                <View style={styles.promptCard}>
                  <View
                    style={styles.promptHeader}
                  >
                    <View style={styles.promptHeaderText}>
                      <Text
                        style={
                          styles.promptPrivacy
                        }
                      >
                        PRIVATE • ONLY YOU CAN SEE THIS
                      </Text>

                      <Text
                        style={styles.promptTitle}
                      >
                        {prompt.title}
                      </Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setPromptVisible(false)
                      }
                      style={
                        styles.promptCloseButton
                      }
                    >
                      <Text
                        style={
                          styles.promptCloseText
                        }
                      >
                        ×
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.promptText}>
                    “{prompt.prompt}”
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    onPress={showAnotherPrompt}
                    style={
                      styles.anotherPromptButton
                    }
                  >
                    <Text
                      style={
                        styles.anotherPromptButtonText
                      }
                    >
                      Show another prompt
                    </Text>
                  </Pressable>

                  <Text
                    style={
                      styles.promptPrivacyNote
                    }
                  >
                    Prompts are selected locally.
                    PolyOpen does not analyze faces,
                    movements, expressions, voices,
                    or behavior.
                  </Text>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setPromptVisible(true)
                  }
                  style={styles.showPromptButton}
                >
                  <Text
                    style={
                      styles.showPromptButtonText
                    }
                  >
                    💬 Show private conversation
                    prompt
                  </Text>
                </Pressable>
              )}

            </ScrollView>
          </View>
        ) : null}

        {phase === "decision" ? (
          <ScrollView
            style={styles.lightStage}
            contentContainerStyle={
              styles.decisionContent
            }
            showsVerticalScrollIndicator={false}
          >
            <View
              style={styles.decisionEmojiCircle}
            >
              <Text
                style={styles.decisionEmoji}
              >
                ✨
              </Text>
            </View>

            <Text style={styles.decisionTitle}>
              Your two minutes are complete.
            </Text>

            <Text
              style={styles.decisionDescription}
            >
              Your decision is private. Chat unlocks
              only when both people choose Continue.
            </Text>

            <View style={styles.decisionOptions}>
              <Pressable
                accessibilityRole="button"
                disabled={
                  isSubmittingDecision
                }
                onPress={() =>
                  void submitDecision(
                    "continue",
                  )
                }
                style={({ pressed }) => [
                  styles.decisionCard,
                  styles.continueCard,
                  pressed &&
                    styles.decisionCardPressed,
                ]}
              >
                <Text
                  style={
                    styles.decisionCardEmoji
                  }
                >
                  ❤️
                </Text>

                <View
                  style={
                    styles.decisionCardContent
                  }
                >
                  <Text
                    style={
                      styles.decisionCardTitle
                    }
                  >
                    Continue
                  </Text>

                  <Text
                    style={
                      styles.decisionCardText
                    }
                  >
                    I would like to keep talking.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={
                  isSubmittingDecision
                }
                onPress={() =>
                  void submitDecision(
                    "pass",
                  )
                }
                style={({ pressed }) => [
                  styles.decisionCard,
                  styles.passCard,
                  pressed &&
                    styles.decisionCardPressed,
                ]}
              >
                <Text
                  style={
                    styles.decisionCardEmoji
                  }
                >
                  👋
                </Text>

                <View
                  style={
                    styles.decisionCardContent
                  }
                >
                  <Text
                    style={
                      styles.decisionCardTitle
                    }
                  >
                    Respectfully pass
                  </Text>

                  <Text
                    style={
                      styles.decisionCardText
                    }
                  >
                    End the date privately and
                    return to the lobby.
                  </Text>
                </View>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}

        {phase === "waiting-decision" ? (
          <View style={styles.lightCenterStage}>
            <View style={styles.waitingCircle}>
              <Text
                style={styles.waitingEmoji}
              >
                🔒
              </Text>
            </View>

            <Text style={styles.resultTitle}>
              Your choice is saved.
            </Text>

            <Text
              style={styles.resultDescription}
            >
              Waiting for the other member’s private
              decision. They cannot see what you chose.
            </Text>

            <Text style={styles.privateChoice}>
              Your private choice:{" "}
              {decision === "continue"
                ? "Continue"
                : "Pass"}
            </Text>
          </View>
        ) : null}

        {phase === "mutual" ? (
          <ScrollView
            style={styles.lightStage}
            contentContainerStyle={
              styles.decisionContent
            }
            showsVerticalScrollIndicator={false}
          >
            <View
              style={styles.mutualCircle}
            >
              <Text style={styles.mutualEmoji}>
                🎉
              </Text>
            </View>

            <Text style={styles.resultTitle}>
              You both chose Continue.
            </Text>

            <Text
              style={styles.resultDescription}
            >
              PolyOpen has unlocked persistent chat
              for this mutual connection.
            </Text>

            <View style={styles.successCard}>
              <Text
                style={styles.successCardTitle}
              >
                Chat unlocked
              </Text>

              <Text
                style={styles.successCardText}
              >
                Your mutual Continue decision is
                stored securely in Supabase.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={openMessages}
              style={styles.primaryButton}
            >
              <Text
                style={styles.primaryButtonText}
              >
                Open Messages
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={openMiniGames}
              style={styles.secondaryButton}
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                Play a Mini-Game
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => void returnToLobby()}
              style={styles.textButton}
            >
              <Text style={styles.textButtonText}>
                Return to Speed Dating
              </Text>
            </Pressable>

            {chatUnlocked ? (
              <Text
                style={styles.certifiedText}
              >
                Mutual chat unlock confirmed
              </Text>
            ) : null}
          </ScrollView>
        ) : null}

        {phase === "passed" ? (
          <View style={styles.lightCenterStage}>
            <View style={styles.waitingCircle}>
              <Text
                style={styles.waitingEmoji}
              >
                👋
              </Text>
            </View>

            <Text style={styles.resultTitle}>
              Thank you for being respectful.
            </Text>

            <Text
              style={styles.resultDescription}
            >
              At least one person chose Pass. Neither
              private choice is revealed to the other
              member.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => void returnToLobby()}
              style={styles.primaryButton}
            >
              <Text
                style={styles.primaryButtonText}
              >
                Return to Speed Dating
              </Text>
            </Pressable>
          </View>
        ) : null}

        {phase === "error" ? (
          <View style={styles.lightCenterStage}>
            <View style={styles.errorCircle}>
              <Text style={styles.errorEmoji}>
                !
              </Text>
            </View>

            <Text style={styles.resultTitle}>
              Speed Date unavailable
            </Text>

            <Text
              style={styles.resultDescription}
            >
              {errorMessage ||
                "PolyOpen could not open this Speed Date."}
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => void returnToLobby()}
              style={styles.primaryButton}
            >
              <Text
                style={styles.primaryButtonText}
              >
                Return to Lobby
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#120C10",
  },
  screen: {
    flex: 1,
    backgroundColor: "#120C10",
  },
  topBar: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor: "#3C2A34",
    backgroundColor: "#1C1218",
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "#33232C",
  },
  closeButtonText: {
    marginTop: -2,
    color: "#FFFFFF",
    fontSize: 29,
  },
  topBarCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  topBarEyebrow: {
    color: "#FF85C2",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  topBarTitle: {
    marginTop: 3,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  topBarSpacer: {
    width: 42,
  },
  realtimeStatusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 14,
    backgroundColor: "#FFF0D8",
  },
  realtimeStatusBannerHealthy: {
    backgroundColor: "#E8FAF0",
  },
  realtimeStatusBannerDegraded: {
    backgroundColor: "#FFE6E6",
  },
  realtimeStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E49A22",
  },
  realtimeStatusDotHealthy: {
    backgroundColor: "#28B86B",
  },
  realtimeStatusDotDegraded: {
    backgroundColor: "#D9485F",
  },
  realtimeStatusText: {
    marginLeft: 8,
    color: "#5B4651",
    fontSize: 10,
    fontWeight: "800",
  },
  centerStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  searchOrb: {
    width: 130,
    height: 130,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 10,
    borderColor: "#442B38",
    borderRadius: 65,
    backgroundColor: "#F72A94",
  },
  searchOrbEmoji: {
    fontSize: 53,
  },
  searchTitle: {
    marginTop: 28,
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    textAlign: "center",
  },
  searchDescription: {
    maxWidth: 360,
    marginTop: 10,
    color: "#BBA7B2",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  searchDots: {
    marginTop: 26,
    flexDirection: "row",
    gap: 8,
  },
  searchDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#FF70B8",
  },
  cancelSearchButton: {
    marginTop: 28,
    borderRadius: 999,
    paddingHorizontal: 23,
    paddingVertical: 13,
    backgroundColor: "#3A2831",
  },
  cancelSearchButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  connectingCard: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    borderRadius: 26,
    padding: 28,
    backgroundColor: "#2A1B23",
  },
  connectingEmoji: {
    fontSize: 48,
  },
  connectingTitle: {
    marginTop: 16,
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
  },
  connectingDescription: {
    marginTop: 10,
    color: "#C8B5BF",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  connectedStage: {
    flex: 1,
  },
  videoArea: {
    height: "56%",
    minHeight: 360,
    backgroundColor: "#23171D",
  },
  remoteVideo: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#2A1B23",
  },
  partnerAvatar: {
    width: 116,
    height: 116,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 58,
    backgroundColor: "#F72A94",
  },
  partnerAvatarText: {
    color: "#FFFFFF",
    fontSize: 50,
    fontWeight: "900",
  },
  partnerName: {
    marginTop: 18,
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
  },
  partnerLocation: {
    marginTop: 5,
    color: "#C7B4BE",
    fontSize: 14,
  },
  videoPlaceholderBadge: {
    marginTop: 20,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#47313D",
  },
  videoPlaceholderBadgeText: {
    color: "#CDB8C3",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  selfVideo: {
    position: "absolute",
    top: 18,
    right: 16,
    width: 92,
    height: 126,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 18,
    backgroundColor: "#513745",
  },
  selfVideoIcon: {
    fontSize: 34,
  },
  selfVideoLabel: {
    marginTop: 7,
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  timerCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor:
      "rgba(15, 9, 12, 0.86)",
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    textAlign: "center",
  },
  timerTrack: {
    height: 5,
    marginTop: 8,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: "#4C3541",
  },
  timerProgress: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#F72A94",
  },
  timerServerLabel: {
    marginTop: 7,
    color: "#BCA7B2",
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  connectedControls: {
    flex: 1,
    backgroundColor: "#FFF8FC",
  },
  connectedControlsContent: {
    padding: 16,
    paddingBottom: 40,
  },
  promptCard: {
    borderWidth: 1,
    borderColor: "#DAC1FF",
    borderRadius: 22,
    padding: 17,
    backgroundColor: "#F5ECFF",
  },
  promptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  promptHeaderText: {
    flex: 1,
    paddingRight: 10,
  },
  promptPrivacy: {
    color: "#7F4EA1",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  promptTitle: {
    marginTop: 4,
    color: "#362044",
    fontSize: 16,
    fontWeight: "900",
  },
  promptCloseButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#E7D7F4",
  },
  promptCloseText: {
    marginTop: -2,
    color: "#6B3F84",
    fontSize: 23,
  },
  promptText: {
    marginTop: 15,
    color: "#392346",
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "700",
  },
  anotherPromptButton: {
    alignSelf: "flex-start",
    marginTop: 15,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#7D42A2",
  },
  anotherPromptButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  promptPrivacyNote: {
    marginTop: 14,
    color: "#796486",
    fontSize: 10,
    lineHeight: 15,
  },
  showPromptButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#EEE2F7",
  },
  showPromptButtonText: {
    color: "#623882",
    fontSize: 14,
    fontWeight: "900",
  },
  mediaControls: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  mediaButton: {
    flex: 1,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
  },
  mediaButtonDisabled: {
    backgroundColor: "#E5DCE1",
  },
  mediaButtonIcon: {
    fontSize: 20,
  },
  mediaButtonText: {
    marginTop: 4,
    color: "#4C3943",
    fontSize: 11,
    fontWeight: "800",
  },
  lightStage: {
    flex: 1,
    backgroundColor: "#FFF8FC",
  },
  lightCenterStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFF8FC",
  },
  decisionContent: {
    alignItems: "center",
    padding: 24,
    paddingBottom: 70,
  },
  decisionEmojiCircle: {
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 46,
    backgroundColor: "#FFE1F1",
  },
  decisionEmoji: {
    fontSize: 44,
  },
  decisionTitle: {
    marginTop: 24,
    color: "#25171F",
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "900",
    textAlign: "center",
  },
  decisionDescription: {
    maxWidth: 420,
    marginTop: 11,
    color: "#74616C",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },
  decisionOptions: {
    width: "100%",
    marginTop: 26,
    gap: 13,
  },
  decisionCard: {
    minHeight: 114,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 23,
    padding: 17,
  },
  continueCard: {
    borderColor: "#F72A94",
    backgroundColor: "#FFF0F8",
  },
  passCard: {
    borderColor: "#DCCFD6",
    backgroundColor: "#FFFFFF",
  },
  decisionCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
  decisionCardEmoji: {
    width: 46,
    fontSize: 31,
  },
  decisionCardContent: {
    flex: 1,
    marginLeft: 8,
  },
  decisionCardTitle: {
    color: "#2A1B23",
    fontSize: 18,
    fontWeight: "900",
  },
  decisionCardText: {
    marginTop: 5,
    color: "#725F69",
    fontSize: 13,
    lineHeight: 19,
  },
  waitingCircle: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 48,
    backgroundColor: "#EEE2F7",
  },
  waitingEmoji: {
    fontSize: 43,
  },
  mutualCircle: {
    width: 98,
    height: 98,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 49,
    backgroundColor: "#FFE3AF",
  },
  mutualEmoji: {
    fontSize: 47,
  },
  resultTitle: {
    marginTop: 24,
    color: "#25171F",
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "900",
    textAlign: "center",
  },
  resultDescription: {
    maxWidth: 420,
    marginTop: 11,
    color: "#74616C",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },
  privateChoice: {
    marginTop: 19,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    color: "#70415B",
    fontSize: 12,
    fontWeight: "900",
    backgroundColor: "#F4E6ED",
  },
  successCard: {
    width: "100%",
    marginTop: 24,
    borderRadius: 22,
    padding: 20,
    backgroundColor: "#E9F8EF",
  },
  successCardTitle: {
    color: "#205B37",
    fontSize: 18,
    fontWeight: "900",
  },
  successCardText: {
    marginTop: 7,
    color: "#49745A",
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    width: "100%",
    maxWidth: 420,
    minHeight: 62,
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "#F72A94",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    width: "100%",
    maxWidth: 420,
    minHeight: 57,
    marginTop: 11,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#ECE1E7",
  },
  secondaryButtonText: {
    color: "#57424D",
    fontSize: 14,
    fontWeight: "900",
  },
  textButton: {
    marginTop: 18,
    padding: 12,
  },
  textButtonText: {
    color: "#8A6477",
    fontSize: 13,
    fontWeight: "800",
  },
  certifiedText: {
    marginTop: 11,
    color: "#587563",
    fontSize: 11,
    fontWeight: "800",
  },
  errorCircle: {
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 46,
    backgroundColor: "#FFE2E2",
  },
  errorEmoji: {
    color: "#A62D2D",
    fontSize: 42,
    fontWeight: "900",
  },
});
