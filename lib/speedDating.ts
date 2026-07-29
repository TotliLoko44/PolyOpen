export const SPEED_DATE_DURATION_SECONDS = 120;

export type MatchScope =
  | "nearby"
  | "country"
  | "worldwide"
  | "spiritual"
  | "random";

export type DateDecision =
  | "continue"
  | "friends"
  | "pass";

export type SpeedDateStage =
  | "lobby"
  | "ad"
  | "searching"
  | "connected"
  | "decision"
  | "game-offer"
  | "game"
  | "complete";

export type ConversationPrompt = {
  id: string;
  title: string;
  prompt: string;
  category:
    | "easy"
    | "values"
    | "fun"
    | "spiritual"
    | "relationships";
};

export type MiniGameChoice = {
  id: string;
  label: string;
};

export type MiniGameQuestion = {
  id: string;
  title: string;
  prompt: string;
  choices?: MiniGameChoice[];
};

export type MiniGame = {
  id: string;
  name: string;
  description: string;
  questions: MiniGameQuestion[];
};

export type SpeedDatePartner = {
  id: string;
  displayName: string;
  age: number;
  city: string;
  country: string;
  spiritualPath: string;
  interests: string[];
};

export type SpeedDateSession = {
  id: string;
  scope: MatchScope;
  stage: SpeedDateStage;
  startedAt: string | null;
  partner: SpeedDatePartner | null;
  userDecision: DateDecision | null;
  partnerDecision: DateDecision | null;
  gameId: string | null;
};

export const MATCH_SCOPE_OPTIONS: Array<{
  value: MatchScope;
  emoji: string;
  title: string;
  description: string;
  privacyNote?: string;
}> = [
  {
    value: "nearby",
    emoji: "📍",
    title: "Nearby",
    description: "Meet people in your general area.",
    privacyNote:
      "Uses only the broad location already provided in your profile. No live movement tracking.",
  },
  {
    value: "country",
    emoji: "🗺️",
    title: "Same Country",
    description: "Meet someone currently available in your country.",
  },
  {
    value: "worldwide",
    emoji: "🌎",
    title: "Worldwide",
    description: "Connect with someone available anywhere in the world.",
  },
  {
    value: "spiritual",
    emoji: "✨",
    title: "Spiritual Match",
    description: "Prioritize compatible spiritual interests and values.",
  },
  {
    value: "random",
    emoji: "🎲",
    title: "Random Adventure",
    description: "Let PolyOpen surprise you.",
  },
];

export const CONVERSATION_PROMPTS: ConversationPrompt[] = [
  {
    id: "easy-perfect-day",
    title: "Easy opener",
    prompt: "What does your perfect day look like?",
    category: "easy",
  },
  {
    id: "easy-recent-smile",
    title: "Keep it light",
    prompt: "What is something that made you smile recently?",
    category: "easy",
  },
  {
    id: "easy-current-passion",
    title: "Learn their interests",
    prompt: "What is something you are excited about right now?",
    category: "easy",
  },
  {
    id: "fun-travel",
    title: "Dream together",
    prompt: "Where would you travel tomorrow if everything were paid for?",
    category: "fun",
  },
  {
    id: "fun-hidden-talent",
    title: "Unexpected answer",
    prompt: "What is a talent or skill most people do not know you have?",
    category: "fun",
  },
  {
    id: "fun-laugh",
    title: "Create some energy",
    prompt: "What always makes you laugh, no matter how many times you see it?",
    category: "fun",
  },
  {
    id: "values-kindness",
    title: "Explore values",
    prompt: "What does kindness look like in a relationship to you?",
    category: "values",
  },
  {
    id: "values-growth",
    title: "Personal growth",
    prompt: "What is one way you have grown during the last year?",
    category: "values",
  },
  {
    id: "values-community",
    title: "Community",
    prompt: "What makes you feel like you truly belong somewhere?",
    category: "values",
  },
  {
    id: "spiritual-grounding",
    title: "Spiritual connection",
    prompt: "What helps you feel grounded or connected?",
    category: "spiritual",
  },
  {
    id: "spiritual-sign",
    title: "Meaningful experiences",
    prompt: "Have you ever experienced a coincidence that felt meaningful?",
    category: "spiritual",
  },
  {
    id: "spiritual-practice",
    title: "Daily practice",
    prompt: "Is there a spiritual or reflective practice that matters to you?",
    category: "spiritual",
  },
  {
    id: "relationship-communication",
    title: "Communication",
    prompt: "What makes communication feel safe and honest to you?",
    category: "relationships",
  },
  {
    id: "relationship-boundaries",
    title: "Healthy boundaries",
    prompt: "What is one boundary you believe helps relationships stay healthy?",
    category: "relationships",
  },
  {
    id: "relationship-connection",
    title: "Meaningful connection",
    prompt: "What helps you feel genuinely close to another person?",
    category: "relationships",
  },
];

export const MINI_GAMES: MiniGame[] = [
  {
    id: "would-you-rather",
    name: "Would You Rather",
    description: "Choose between two possibilities and explain why.",
    questions: [
      {
        id: "wyr-1",
        title: "Adventure",
        prompt: "Would you rather explore space or the deepest part of the ocean?",
        choices: [
          { id: "space", label: "Explore space" },
          { id: "ocean", label: "Explore the ocean" },
        ],
      },
      {
        id: "wyr-2",
        title: "Lifestyle",
        prompt: "Would you rather live near the ocean or in the mountains?",
        choices: [
          { id: "ocean", label: "Near the ocean" },
          { id: "mountains", label: "In the mountains" },
        ],
      },
      {
        id: "wyr-3",
        title: "Connection",
        prompt: "Would you rather have a long conversation or share an adventure?",
        choices: [
          { id: "conversation", label: "Long conversation" },
          { id: "adventure", label: "Shared adventure" },
        ],
      },
      {
        id: "wyr-4",
        title: "Time",
        prompt: "Would you rather revisit one great memory or see one day in your future?",
        choices: [
          { id: "memory", label: "Revisit a memory" },
          { id: "future", label: "See the future" },
        ],
      },
    ],
  },
  {
    id: "green-flag",
    name: "Green Flag",
    description: "Compare what makes each of you feel safe and appreciated.",
    questions: [
      {
        id: "green-1",
        title: "Communication",
        prompt: "Name one communication habit you consider a green flag.",
      },
      {
        id: "green-2",
        title: "Respect",
        prompt: "What is one small action that makes you feel respected?",
      },
      {
        id: "green-3",
        title: "Conflict",
        prompt: "What does a healthy disagreement look like to you?",
      },
      {
        id: "green-4",
        title: "Affection",
        prompt: "How do you naturally show someone that you care?",
      },
    ],
  },
  {
    id: "two-truths",
    name: "Two Truths and a Dream",
    description: "Share two real facts and one thing you hope to do someday.",
    questions: [
      {
        id: "truth-1",
        title: "First truth",
        prompt: "Share one surprising fact about yourself.",
      },
      {
        id: "truth-2",
        title: "Second truth",
        prompt: "Share something you have done that you are proud of.",
      },
      {
        id: "truth-3",
        title: "Your dream",
        prompt: "Share one experience you hope to have someday.",
      },
    ],
  },
  {
    id: "deeper-questions",
    name: "Deeper Questions",
    description: "Move beyond small talk with meaningful prompts.",
    questions: [
      {
        id: "deep-1",
        title: "Feeling understood",
        prompt: "What makes you feel truly understood by another person?",
      },
      {
        id: "deep-2",
        title: "Growth",
        prompt: "What lesson has changed the way you approach relationships?",
      },
      {
        id: "deep-3",
        title: "Authenticity",
        prompt: "When do you feel most like your authentic self?",
      },
      {
        id: "deep-4",
        title: "Future",
        prompt: "What kind of connection are you hoping to build?",
      },
    ],
  },
];

const DEMO_PARTNERS: SpeedDatePartner[] = [
  {
    id: "demo-luna",
    displayName: "Luna",
    age: 31,
    city: "Sacramento",
    country: "United States",
    spiritualPath: "Meditation and nature",
    interests: ["Hiking", "Art", "Music"],
  },
  {
    id: "demo-river",
    displayName: "River",
    age: 29,
    city: "Portland",
    country: "United States",
    spiritualPath: "Mindfulness",
    interests: ["Travel", "Cooking", "Live music"],
  },
  {
    id: "demo-sage",
    displayName: "Sage",
    age: 35,
    city: "Austin",
    country: "United States",
    spiritualPath: "Personal growth",
    interests: ["Books", "Fitness", "Community"],
  },
];

export function createSessionId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `speed-date-${Date.now()}-${random}`;
}

export function chooseConversationPrompt(
  previousPromptId?: string | null,
): ConversationPrompt {
  const options = previousPromptId
    ? CONVERSATION_PROMPTS.filter(
        (prompt) => prompt.id !== previousPromptId,
      )
    : CONVERSATION_PROMPTS;

  const index = Math.floor(Math.random() * options.length);
  return options[index] ?? CONVERSATION_PROMPTS[0];
}

export function chooseDemoPartner(): SpeedDatePartner {
  const index = Math.floor(Math.random() * DEMO_PARTNERS.length);
  return DEMO_PARTNERS[index] ?? DEMO_PARTNERS[0];
}

export function getMiniGame(gameId: string | null): MiniGame {
  return (
    MINI_GAMES.find((game) => game.id === gameId) ??
    MINI_GAMES[0]
  );
}

export function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function scopeLabel(scope: MatchScope): string {
  return (
    MATCH_SCOPE_OPTIONS.find((option) => option.value === scope)
      ?.title ?? "Worldwide"
  );
}
