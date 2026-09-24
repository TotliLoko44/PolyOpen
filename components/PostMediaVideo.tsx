import { ResizeMode, Video } from "expo-av";

type PostMediaVideoProps = {
  uri: string;
  controls?: boolean;
  muted?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  fit?: "contain" | "cover";
};

export function PostMediaVideo({
  uri,
  controls = false,
  muted = true,
  autoPlay = true,
  loop = true,
  fit = "contain",
}: PostMediaVideoProps) {
  return (
    <Video
      source={{ uri }}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#000",
      }}
      resizeMode={fit === "cover" ? ResizeMode.COVER : ResizeMode.CONTAIN}
      shouldPlay={autoPlay}
      isMuted={muted}
      isLooping={loop}
      useNativeControls={controls}
    />
  );
}
