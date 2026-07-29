import {
  DateDecision,
  MatchScope,
  SpeedDatePartner,
  SpeedDateSession,
  SpeedDateStage,
  createSessionId,
} from "./speedDating";

const sessions = new Map<string, SpeedDateSession>();

export function createSpeedDateSession(
  scope: MatchScope,
): SpeedDateSession {
  const session: SpeedDateSession = {
    id: createSessionId(),
    scope,
    stage: "ad",
    startedAt: null,
    partner: null,
    userDecision: null,
    partnerDecision: null,
    gameId: null,
  };

  sessions.set(session.id, session);
  return session;
}

export function getSpeedDateSession(
  sessionId: string,
): SpeedDateSession | null {
  return sessions.get(sessionId) ?? null;
}

export function updateSpeedDateSession(
  sessionId: string,
  changes: Partial<SpeedDateSession>,
): SpeedDateSession | null {
  const existing = sessions.get(sessionId);

  if (!existing) {
    return null;
  }

  const updated: SpeedDateSession = {
    ...existing,
    ...changes,
  };

  sessions.set(sessionId, updated);
  return updated;
}

export function setSpeedDateStage(
  sessionId: string,
  stage: SpeedDateStage,
): SpeedDateSession | null {
  return updateSpeedDateSession(sessionId, { stage });
}

export function connectSpeedDatePartner(
  sessionId: string,
  partner: SpeedDatePartner,
): SpeedDateSession | null {
  return updateSpeedDateSession(sessionId, {
    stage: "connected",
    startedAt: new Date().toISOString(),
    partner,
  });
}

export function saveSpeedDateDecision(
  sessionId: string,
  decision: DateDecision,
): SpeedDateSession | null {
  return updateSpeedDateSession(sessionId, {
    userDecision: decision,
  });
}

export function selectSpeedDateGame(
  sessionId: string,
  gameId: string,
): SpeedDateSession | null {
  return updateSpeedDateSession(sessionId, {
    stage: "game",
    gameId,
  });
}

export function deleteSpeedDateSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function clearSpeedDateSessions(): void {
  sessions.clear();
}
