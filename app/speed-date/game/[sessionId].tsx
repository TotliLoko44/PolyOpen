import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
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

import { useAuth } from "../../../lib/auth";
import {
  showMiniGameInterstitial,
  type InterstitialOutcome,
} from "../../../lib/ads";
import {
  MINI_GAMES,
  getMiniGame,
} from "../../../lib/speedDating";
import {
  getSpeedDateSession,
  selectSpeedDateGame,
} from "../../../lib/speedDatingStore";

type GamePhase =
  | "ad"
  | "selection"
  | "playing"
  | "complete";

export default function SpeedDateGameScreen() {
  const router = useRouter();
  const { userId } = useAuth();

  const params = useLocalSearchParams<{
    sessionId?: string | string[];
  }>();

  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId ?? "";

  const session = getSpeedDateSession(sessionId);

  const [phase, setPhase] =
    useState<GamePhase>("ad");

  const [adStatus, setAdStatus] =
    useState<
      | "preparing"
      | "showing"
      | "skipped"
      | "fallback"
    >("preparing");

  const [adOutcome, setAdOutcome] =
    useState<InterstitialOutcome | null>(
      null,
    );

  const adRequestStartedRef =
    useRef(false);
  const [selectedGameId, setSelectedGameId] =
    useState<string | null>(session?.gameId ?? null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] =
    useState<string | null>(null);

  useEffect(() => {
    if (
      phase !== "ad" ||
      adRequestStartedRef.current
    ) {
      return;
    }

    adRequestStartedRef.current =
      true;

    let active = true;

    const runInterstitial =
      async () => {
        setAdStatus(
          "preparing",
        );

        const outcome =
          await showMiniGameInterstitial(
            userId,
            {
              timeoutMs: 9000,
            },
          );

        if (!active) {
          return;
        }

        setAdOutcome(outcome);

        if (
          outcome ===
            "skipped-ad-free" ||
          outcome ===
            "skipped-platform"
        ) {
          setAdStatus(
            "skipped",
          );
        } else if (
          outcome === "shown"
        ) {
          setAdStatus(
            "showing",
          );
        } else {
          setAdStatus(
            "fallback",
          );
        }

        setPhase(
          "selection",
        );
      };

    void runInterstitial();

    return () => {
      active = false;
    };
  }, [
    phase,
    userId,
  ]);

  const selectedGame = useMemo(
    () => getMiniGame(selectedGameId),
    [selectedGameId],
  );

  const question =
    selectedGame.questions[questionIndex] ??
    selectedGame.questions[0];

  const chooseGame = (gameId: string) => {
    selectSpeedDateGame(sessionId, gameId);
    setSelectedGameId(gameId);
    setQuestionIndex(0);
    setSelectedChoiceId(null);
    setPhase("playing");
  };

  const nextQuestion = () => {
    const nextIndex = questionIndex + 1;

    if (nextIndex >= selectedGame.questions.length) {
      setPhase("complete");
      return;
    }

    setQuestionIndex(nextIndex);
    setSelectedChoiceId(null);
  };

  if (phase === "ad") {
    return (
      <SafeAreaView
        style={
          styles.darkSafeArea
        }
      >
        <View style={styles.adScreen}>
          <View style={styles.adCard}>
            <Text
              style={
                styles.adEyebrow
              }
            >
              MINI-GAME CHECKPOINT
            </Text>

            <View
              style={
                styles.adPlaceholder
              }
            >
              <Text
                style={
                  styles.adIcon
                }
              >
                ▶
              </Text>

              <Text
                style={
                  styles.adTitle
                }
              >
                {adStatus ===
                "skipped"
                  ? "No Ads access verified"
                  : "Preparing your mini-game"}
              </Text>

              <Text
                style={
                  styles.adText
                }
              >
                {adStatus ===
                "skipped"
                  ? "Your Premium + No Ads access skips this advertisement."
                  : adStatus ===
                      "fallback"
                    ? "The advertisement could not load. PolyOpen is opening the mini-games without blocking you."
                    : "PolyOpen is securely loading the mini-game advertisement."}
              </Text>
            </View>

            <Text
              style={
                styles.adCountdown
              }
            >
              {adOutcome ===
              "skipped-ad-free"
                ? "Ad skipped"
                : "Opening mini-games…"}
            </Text>
          </View>

          <Text style={styles.adFooter}>
            Premium + No Ads members skip advertisements automatically.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "selection") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.selectionContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>←</Text>
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.headerEyebrow}>
                KEEP THE CONVERSATION GOING
              </Text>
              <Text style={styles.headerTitle}>
                Choose a Mini-Game
              </Text>
            </View>
          </View>

          <Text style={styles.selectionDescription}>
            Pick a game together. Each person can answer aloud
            and explain what makes their answer meaningful.
          </Text>

          <View style={styles.gameList}>
            {MINI_GAMES.map((game, index) => (
              <Pressable
                key={game.id}
                accessibilityRole="button"
                onPress={() => chooseGame(game.id)}
                style={({ pressed }) => [
                  styles.gameCard,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.gameNumber}>
                  <Text style={styles.gameNumberText}>
                    {index + 1}
                  </Text>
                </View>

                <View style={styles.gameCardContent}>
                  <Text style={styles.gameName}>
                    {game.name}
                  </Text>
                  <Text style={styles.gameDescription}>
                    {game.description}
                  </Text>
                  <Text style={styles.questionCount}>
                    {game.questions.length} prompts
                  </Text>
                </View>

                <Text style={styles.gameArrow}>→</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.privacyNote}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={styles.privacyText}>
              Answers remain between the two participants unless
              either person chooses to share them.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === "complete") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.completeScreen}>
          <View style={styles.completeCircle}>
            <Text style={styles.completeEmoji}>🎉</Text>
          </View>

          <Text style={styles.completeTitle}>
            Game complete!
          </Text>

          <Text style={styles.completeDescription}>
            You finished {selectedGame.name}. You can keep
            talking, return to speed dating, or play another game.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSelectedGameId(null);
              setQuestionIndex(0);
              setSelectedChoiceId(null);
              setPhase("selection");
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              Choose Another Game
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace("/(tabs)/swipe")
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              Return to Speed Dating
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.playScreen}>
        <View style={styles.playHeader}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPhase("selection")}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>

          <View style={styles.playHeaderText}>
            <Text style={styles.playGameName}>
              {selectedGame.name}
            </Text>
            <Text style={styles.playProgress}>
              Question {questionIndex + 1} of{" "}
              {selectedGame.questions.length}
            </Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  ((questionIndex + 1) /
                    selectedGame.questions.length) *
                  100
                }%`,
              },
            ]}
          />
        </View>

        <ScrollView
          style={styles.questionScroll}
          contentContainerStyle={styles.questionContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.questionEyebrow}>
            {question.title.toUpperCase()}
          </Text>

          <Text style={styles.questionText}>
            {question.prompt}
          </Text>

          {question.choices?.length ? (
            <View style={styles.choiceList}>
              {question.choices.map((choice) => {
                const isSelected =
                  selectedChoiceId === choice.id;

                return (
                  <Pressable
                    key={choice.id}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: isSelected,
                    }}
                    onPress={() =>
                      setSelectedChoiceId(choice.id)
                    }
                    style={[
                      styles.choiceCard,
                      isSelected &&
                        styles.choiceCardSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        isSelected &&
                          styles.choiceTextSelected,
                      ]}
                    >
                      {choice.label}
                    </Text>

                    {isSelected ? (
                      <Text style={styles.choiceCheck}>✓</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.openAnswerCard}>
              <Text style={styles.openAnswerEmoji}>💬</Text>
              <Text style={styles.openAnswerTitle}>
                Take turns answering aloud
              </Text>
              <Text style={styles.openAnswerText}>
                Listen fully, then ask one follow-up question
                about the other person’s answer.
              </Text>
            </View>
          )}

          <View style={styles.conversationReminder}>
            <Text style={styles.conversationReminderTitle}>
              Make it a conversation
            </Text>
            <Text style={styles.conversationReminderText}>
              Do not rush to the next card. The best part is
              learning why each person answered the way they did.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <Pressable
            accessibilityRole="button"
            onPress={nextQuestion}
            style={styles.nextButton}
          >
            <Text style={styles.nextButtonText}>
              {questionIndex + 1 >=
              selectedGame.questions.length
                ? "Finish Game"
                : "Next Question"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  darkSafeArea: {
    flex: 1,
    backgroundColor: "#120C10",
  },
  adScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  adCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 26,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  adEyebrow: {
    color: "#8C7782",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },
  adPlaceholder: {
    minHeight: 300,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    padding: 24,
    backgroundColor: "#F3ECF0",
  },
  adIcon: {
    color: "#F72A94",
    fontSize: 44,
  },
  adTitle: {
    marginTop: 14,
    color: "#291A22",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  adText: {
    marginTop: 9,
    color: "#75636D",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  adCountdown: {
    minHeight: 20,
    marginTop: 17,
    color: "#B4005B",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  adFooter: {
    marginTop: 16,
    color: "#A8939E",
    fontSize: 12,
    textAlign: "center",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF8FC",
  },
  screen: {
    flex: 1,
    backgroundColor: "#FFF8FC",
  },
  selectionContent: {
    padding: 20,
    paddingBottom: 70,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#EEE2E8",
  },
  backButtonText: {
    color: "#4F3944",
    fontSize: 25,
    fontWeight: "700",
  },
  headerText: {
    flex: 1,
    marginLeft: 13,
  },
  headerEyebrow: {
    color: "#B00059",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  headerTitle: {
    marginTop: 3,
    color: "#24161E",
    fontSize: 27,
    fontWeight: "900",
  },
  selectionDescription: {
    marginTop: 20,
    color: "#74616B",
    fontSize: 15,
    lineHeight: 23,
  },
  gameList: {
    marginTop: 23,
    gap: 13,
  },
  gameCard: {
    minHeight: 122,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EDD9E4",
    borderRadius: 23,
    padding: 17,
    backgroundColor: "#FFFFFF",
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
  gameNumber: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#F72A94",
  },
  gameNumberText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  gameCardContent: {
    flex: 1,
    marginLeft: 14,
  },
  gameName: {
    color: "#2A1B23",
    fontSize: 18,
    fontWeight: "900",
  },
  gameDescription: {
    marginTop: 5,
    color: "#77646E",
    fontSize: 13,
    lineHeight: 19,
  },
  questionCount: {
    marginTop: 8,
    color: "#B00059",
    fontSize: 11,
    fontWeight: "900",
  },
  gameArrow: {
    marginLeft: 10,
    color: "#F72A94",
    fontSize: 24,
    fontWeight: "800",
  },
  privacyNote: {
    marginTop: 18,
    flexDirection: "row",
    borderRadius: 18,
    padding: 15,
    backgroundColor: "#EDF6FF",
  },
  privacyIcon: {
    fontSize: 20,
  },
  privacyText: {
    flex: 1,
    marginLeft: 10,
    color: "#4E6880",
    fontSize: 12,
    lineHeight: 18,
  },
  completeScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
  },
  completeCircle: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 52,
    backgroundColor: "#FFE4F2",
  },
  completeEmoji: {
    fontSize: 49,
  },
  completeTitle: {
    marginTop: 25,
    color: "#291A22",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  completeDescription: {
    maxWidth: 410,
    marginTop: 11,
    color: "#74616B",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },
  primaryButton: {
    width: "100%",
    maxWidth: 420,
    minHeight: 62,
    marginTop: 27,
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
  playScreen: {
    flex: 1,
    backgroundColor: "#FFF8FC",
  },
  playHeader: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  playHeaderText: {
    flex: 1,
    marginLeft: 13,
  },
  playGameName: {
    color: "#2A1B23",
    fontSize: 19,
    fontWeight: "900",
  },
  playProgress: {
    marginTop: 3,
    color: "#87737D",
    fontSize: 12,
  },
  progressTrack: {
    height: 6,
    marginHorizontal: 20,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: "#E7D8E0",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#F72A94",
  },
  questionScroll: {
    flex: 1,
  },
  questionContent: {
    padding: 24,
    paddingBottom: 44,
  },
  questionEyebrow: {
    color: "#B00059",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },
  questionText: {
    marginTop: 16,
    color: "#24161E",
    fontSize: 30,
    lineHeight: 40,
    fontWeight: "900",
    textAlign: "center",
  },
  choiceList: {
    marginTop: 30,
    gap: 13,
  },
  choiceCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E8D7E0",
    borderRadius: 22,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
  },
  choiceCardSelected: {
    borderColor: "#F72A94",
    backgroundColor: "#FFF0F8",
  },
  choiceText: {
    flex: 1,
    color: "#4D3943",
    fontSize: 17,
    fontWeight: "800",
  },
  choiceTextSelected: {
    color: "#A80055",
  },
  choiceCheck: {
    color: "#F72A94",
    fontSize: 21,
    fontWeight: "900",
  },
  openAnswerCard: {
    marginTop: 30,
    alignItems: "center",
    borderRadius: 24,
    padding: 24,
    backgroundColor: "#F4EBF0",
  },
  openAnswerEmoji: {
    fontSize: 37,
  },
  openAnswerTitle: {
    marginTop: 13,
    color: "#3D2934",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  openAnswerText: {
    marginTop: 8,
    color: "#745F6A",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  conversationReminder: {
    marginTop: 22,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#FFF0CF",
  },
  conversationReminderTitle: {
    color: "#574016",
    fontSize: 15,
    fontWeight: "900",
  },
  conversationReminderText: {
    marginTop: 6,
    color: "#765E34",
    fontSize: 13,
    lineHeight: 20,
  },
  bottomBar: {
    padding: 17,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2D2DA",
    backgroundColor: "#FFFFFF",
  },
  nextButton: {
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#F72A94",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
});
