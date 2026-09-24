import React from "react";

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
  return React.createElement("video" as any, {
    src: uri,
    autoPlay,
    muted,
    loop,
    playsInline: true,
    controls,
    preload: "metadata",
    style: {
      display: "block",
      width: "100%",
      height: "100%",
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: fit,
      objectPosition: "center center",
      margin: "auto",
      backgroundColor: "#000",
    },
  });
}
