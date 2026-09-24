import {
  LiveKitRoom as WebLiveKitRoom,
  useConnectionState,
  useRoomContext,
  useTracks,
  VideoTrack as WebVideoTrack,
} from "@livekit/components-react";

export const LiveKitRoom = WebLiveKitRoom as any;
export const VideoTrack = WebVideoTrack as any;
export { useConnectionState, useRoomContext, useTracks };

export const AudioSession = {
  async startAudioSession(): Promise<void> {
    // Browsers manage audio through the LiveKit web room.
  },
  async stopAudioSession(): Promise<void> {
    // The browser room releases its own media resources.
  },
};
