import { registerGlobals } from "@livekit/react-native";

let liveKitGlobalsRegistered = false;

export function registerPolyOpenLiveKitGlobals(): void {
  if (liveKitGlobalsRegistered) {
    return;
  }

  registerGlobals();
  liveKitGlobalsRegistered = true;
}

registerPolyOpenLiveKitGlobals();
