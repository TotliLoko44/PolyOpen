import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  useConnectionState,
  useRoomContext,
  useTracks,
} from "../../lib/liveKitComponents";
import {
  ConnectionState,
  Track,
} from "livekit-client";

import {
  requestSpeedDatingLiveKitCredentials,
  SpeedDatingLiveKitCredentials,
} from "../../lib/speedDatingLiveKit";

type LiveSpeedDatingVideoProps = {
  sessionId: string;
  partnerLabel: string;
  remainingSeconds: number;
  progressPercent: number;
  onFatalError: (message: string) => void;
  onSafetyLeave: () => void;
};

type ConnectedVideoRoomProps = {
  partnerLabel: string;
  remainingSeconds: number;
  progressPercent: number;
  onSafetyLeave: () => void;
};

function ConnectedVideoRoom({
  partnerLabel,
  remainingSeconds,
  progressPercent,
  onSafetyLeave,
}: ConnectedVideoRoomProps) {
  const room = useRoomContext();
  const connectionState = useConnectionState();

  const cameraTracks = useTracks(
    [Track.Source.Camera],
    {
      onlySubscribed: true,
    },
  );

  const localCameraTrack = useMemo(
    () =>
      cameraTracks.find(
        (reference) =>
          reference.participant.isLocal,
      ),
    [cameraTracks],
  );

  const remoteCameraTrack = useMemo(
    () =>
      cameraTracks.find(
        (reference) =>
          !reference.participant.isLocal,
      ),
    [cameraTracks],
  );

  const [microphoneEnabled, setMicrophoneEnabled] =
    useState(true);

  const [cameraEnabled, setCameraEnabled] =
    useState(true);

  const [isChangingMedia, setIsChangingMedia] =
    useState(false);

  const [mediaError, setMediaError] =
    useState("");

  const toggleMicrophone = useCallback(async () => {
    if (isChangingMedia) {
      return;
    }

    setIsChangingMedia(true);
    setMediaError("");

    const nextEnabled = !microphoneEnabled;

    try {
      await room.localParticipant.setMicrophoneEnabled(
        nextEnabled,
      );

      setMicrophoneEnabled(nextEnabled);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to change microphone status.";

      setMediaError(message);

      Alert.alert(
        "Microphone unavailable",
        message,
      );
    } finally {
      setIsChangingMedia(false);
    }
  }, [
    isChangingMedia,
    microphoneEnabled,
    room.localParticipant,
  ]);

  const toggleCamera = useCallback(async () => {
    if (isChangingMedia) {
      return;
    }

    setIsChangingMedia(true);
    setMediaError("");

    const nextEnabled = !cameraEnabled;

    try {
      await room.localParticipant.setCameraEnabled(
        nextEnabled,
      );

      setCameraEnabled(nextEnabled);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to change camera status.";

      setMediaError(message);

      Alert.alert(
        "Camera unavailable",
        message,
      );
    } finally {
      setIsChangingMedia(false);
    }
  }, [
    cameraEnabled,
    isChangingMedia,
    room.localParticipant,
  ]);

  const connectionLabel = useMemo(() => {
    if (
      connectionState ===
      ConnectionState.Connected
    ) {
      return "Connected securely";
    }

    if (
      connectionState ===
      ConnectionState.Reconnecting
    ) {
      return "Reconnecting…";
    }

    if (
      connectionState ===
      ConnectionState.Connecting
    ) {
      return "Connecting…";
    }

    return "Disconnected";
  }, [connectionState]);

  return (
    <View style={styles.container}>
      <View style={styles.remoteStage}>
        {remoteCameraTrack ? (
          <VideoTrack
            trackRef={remoteCameraTrack}
            style={styles.remoteVideo}
            objectFit="cover"
            mirror={false}
            zOrder={0}
          />
        ) : (
          <View style={styles.remotePlaceholder}>
            <View style={styles.partnerAvatar}>
              <Text style={styles.partnerAvatarText}>
                {partnerLabel
                  .slice(0, 1)
                  .toUpperCase()}
              </Text>
            </View>

            <Text style={styles.partnerName}>
              {partnerLabel}
            </Text>

            <Text style={styles.waitingForVideo}>
              Waiting for their camera…
            </Text>
          </View>
        )}

        <View style={styles.connectionBadge}>
          <View
            style={[
              styles.connectionDot,
              connectionState ===
                ConnectionState.Connected &&
                styles.connectionDotConnected,
            ]}
          />

          <Text style={styles.connectionText}>
            {connectionLabel}
          </Text>
        </View>

        <View style={styles.localPreview}>
          {localCameraTrack && cameraEnabled ? (
            <VideoTrack
              trackRef={localCameraTrack}
              style={styles.localVideo}
              objectFit="cover"
              mirror
              zOrder={1}
            />
          ) : (
            <View style={styles.localPlaceholder}>
              <Text style={styles.localPlaceholderIcon}>
                📷
              </Text>

              <Text style={styles.localPlaceholderText}>
                Camera off
              </Text>
            </View>
          )}

          <View style={styles.youBadge}>
            <Text style={styles.youBadgeText}>
              YOU
            </Text>
          </View>
        </View>

        <View style={styles.timerCard}>
          <Text style={styles.timerText}>
            {Math.floor(
              Math.max(
                0,
                remainingSeconds,
              ) / 60,
            )}
            :
            {(
              Math.max(
                0,
                remainingSeconds,
              ) % 60
            )
              .toString()
              .padStart(2, "0")}
          </Text>

          <View style={styles.timerTrack}>
            <View
              style={[
                styles.timerProgress,
                {
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      progressPercent,
                    ),
                  )}%`,
                },
              ]}
            />
          </View>

          <Text style={styles.timerLabel}>
            Synchronized server timer
          </Text>
        </View>
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            microphoneEnabled
              ? "Mute microphone"
              : "Unmute microphone"
          }
          disabled={isChangingMedia}
          onPress={() =>
            void toggleMicrophone()
          }
          style={[
            styles.controlButton,
            !microphoneEnabled &&
              styles.controlButtonDisabled,
          ]}
        >
          <Text style={styles.controlIcon}>
            {microphoneEnabled
              ? "🎙️"
              : "🔇"}
          </Text>

          <Text style={styles.controlText}>
            {microphoneEnabled
              ? "Mute"
              : "Unmute"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            cameraEnabled
              ? "Turn camera off"
              : "Turn camera on"
          }
          disabled={isChangingMedia}
          onPress={() =>
            void toggleCamera()
          }
          style={[
            styles.controlButton,
            !cameraEnabled &&
              styles.controlButtonDisabled,
          ]}
        >
          <Text style={styles.controlIcon}>
            {cameraEnabled
              ? "📹"
              : "🚫"}
          </Text>

          <Text style={styles.controlText}>
            {cameraEnabled
              ? "Camera"
              : "Camera off"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open safety options"
          onPress={() => {
            Alert.alert(
              "Safety options",
              "Leave immediately if the other member makes you uncomfortable or violates PolyOpen’s community rules.",
              [
                {
                  text: "Stay",
                  style: "cancel",
                },
                {
                  text: "Leave",
                  style: "destructive",
                  onPress: onSafetyLeave,
                },
              ],
            );
          }}
          style={styles.controlButton}
        >
          <Text style={styles.controlIcon}>
            🛡️
          </Text>

          <Text style={styles.controlText}>
            Safety
          </Text>
        </Pressable>
      </View>

      {isChangingMedia ? (
        <View style={styles.mediaBusyRow}>
          <ActivityIndicator size="small" />

          <Text style={styles.mediaBusyText}>
            Updating media…
          </Text>
        </View>
      ) : null}

      {mediaError ? (
        <Text style={styles.mediaError}>
          {mediaError}
        </Text>
      ) : null}
    </View>
  );
}

export default function LiveSpeedDatingVideo({
  sessionId,
  partnerLabel,
  remainingSeconds,
  progressPercent,
  onFatalError,
  onSafetyLeave,
}: LiveSpeedDatingVideoProps) {
  const [credentials, setCredentials] =
    useState<SpeedDatingLiveKitCredentials | null>(
      null,
    );

  const [loadingMessage, setLoadingMessage] =
    useState(
      "Preparing secure video…",
    );

  const [connectionError, setConnectionError] =
    useState("");

  const [retryNumber, setRetryNumber] =
    useState(0);

  useEffect(() => {
    let active = true;

    const prepareVideo = async () => {
      setConnectionError("");
      setLoadingMessage(
        retryNumber > 0
          ? "Reconnecting secure video…"
          : "Preparing secure video…",
      );

      try {
        await AudioSession.startAudioSession();

        const nextCredentials =
          await requestSpeedDatingLiveKitCredentials(
            sessionId,
          );

        if (!active) {
          return;
        }

        setCredentials(nextCredentials);
      } catch (error) {
        if (!active) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "PolyOpen could not prepare the video room.";

        setConnectionError(message);
      }
    };

    void prepareVideo();

    return () => {
      active = false;

      void AudioSession.stopAudioSession();
    };
  }, [
    retryNumber,
    sessionId,
  ]);

  if (!credentials) {
    return (
      <View style={styles.loadingStage}>
        {connectionError ? (
          <>
            <View style={styles.errorCircle}>
              <Text style={styles.errorCircleText}>
                !
              </Text>
            </View>

            <Text style={styles.loadingTitle}>
              Video unavailable
            </Text>

            <Text style={styles.loadingText}>
              {connectionError}
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setRetryNumber(
                  (value) => value + 1,
                )
              }
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>
                Retry Video
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                onFatalError(
                  connectionError,
                )
              }
              style={styles.continueWithoutVideoButton}
            >
              <Text
                style={
                  styles.continueWithoutVideoText
                }
              >
                Return to Lobby
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator
              size="large"
            />

            <Text style={styles.loadingTitle}>
              {loadingMessage}
            </Text>

            <Text style={styles.loadingText}>
              PolyOpen is opening the private
              two-person LiveKit room.
            </Text>
          </>
        )}
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={credentials.serverUrl}
      token={credentials.token}
      connect
      audio
      video
      options={{
        adaptiveStream: true,
        dynacast: true,
      }}
      onConnected={() => {
        setConnectionError("");
      }}
      onDisconnected={() => {
        setCredentials(null);
        setLoadingMessage(
          "Reconnecting secure video…",
        );

        setTimeout(() => {
          setRetryNumber(
            (value) => value + 1,
          );
        }, 1200);
      }}
      onError={(error: any) => {
        console.error(
          "LiveKit Speed Dating error",
          error,
        );

        setConnectionError(
          error.message ||
            "The live video connection failed.",
        );
      }}
      onMediaDeviceFailure={(failure: any) => {
        const message = failure
          ? `Camera or microphone error: ${failure}`
          : "PolyOpen could not access the camera or microphone.";

        setConnectionError(message);
      }}
    >
      <ConnectedVideoRoom
        partnerLabel={partnerLabel}
        remainingSeconds={remainingSeconds}
        progressPercent={progressPercent}
        onSafetyLeave={onSafetyLeave}
      />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF8FC",
  },
  remoteStage: {
    height: 390,
    overflow: "hidden",
    backgroundColor: "#21151C",
  },
  remoteVideo: {
    width: "100%",
    height: "100%",
  },
  remotePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  partnerAvatar: {
    width: 112,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 56,
    backgroundColor: "#F72A94",
  },
  partnerAvatarText: {
    color: "#FFFFFF",
    fontSize: 48,
    fontWeight: "900",
  },
  partnerName: {
    marginTop: 16,
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
  },
  waitingForVideo: {
    marginTop: 6,
    color: "#C4B0BA",
    fontSize: 13,
  },
  connectionBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "rgba(16, 9, 13, 0.82)",
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F1A23B",
  },
  connectionDotConnected: {
    backgroundColor: "#36D17C",
  },
  connectionText: {
    marginLeft: 7,
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  localPreview: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 100,
    height: 138,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 18,
    backgroundColor: "#47313D",
  },
  localVideo: {
    width: "100%",
    height: "100%",
  },
  localPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  localPlaceholderIcon: {
    fontSize: 29,
  },
  localPlaceholderText: {
    marginTop: 5,
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  youBadge: {
    position: "absolute",
    left: 7,
    bottom: 7,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: "rgba(12, 7, 10, 0.76)",
  },
  youBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
  },
  timerCard: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 17,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "rgba(15, 9, 12, 0.87)",
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  timerTrack: {
    height: 5,
    marginTop: 7,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: "#4C3541",
  },
  timerProgress: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#F72A94",
  },
  timerLabel: {
    marginTop: 6,
    color: "#BAA5B0",
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
  },
  controls: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    backgroundColor: "#FFF8FC",
  },
  controlButton: {
    flex: 1,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
  },
  controlButtonDisabled: {
    backgroundColor: "#E4DADF",
  },
  controlIcon: {
    fontSize: 20,
  },
  controlText: {
    marginTop: 4,
    color: "#4C3943",
    fontSize: 11,
    fontWeight: "800",
  },
  mediaBusyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 10,
    backgroundColor: "#FFF8FC",
  },
  mediaBusyText: {
    marginLeft: 8,
    color: "#786570",
    fontSize: 11,
  },
  mediaError: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    color: "#A53345",
    fontSize: 11,
    textAlign: "center",
    backgroundColor: "#FFF8FC",
  },
  loadingStage: {
    minHeight: 390,
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
    backgroundColor: "#21151C",
  },
  loadingTitle: {
    marginTop: 18,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  loadingText: {
    maxWidth: 360,
    marginTop: 9,
    color: "#C5B1BB",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  errorCircle: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 39,
    backgroundColor: "#5A2631",
  },
  errorCircleText: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "900",
  },
  retryButton: {
    minWidth: 190,
    minHeight: 52,
    marginTop: 21,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#F72A94",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  continueWithoutVideoButton: {
    marginTop: 10,
    padding: 12,
  },
  continueWithoutVideoText: {
    color: "#D5C0CA",
    fontSize: 12,
    fontWeight: "800",
  },
});
