import { supabase } from "./supabase";

export async function uploadVoice(args: {
  uri: string;
  matchId: string;
  userId: string;
}) {
  const { uri, matchId, userId } = args;

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const filePath = `voice/${matchId}/${userId}-${Date.now()}.m4a`;

  const { error } = await supabase.storage
    .from("voice-files")
    .upload(filePath, arrayBuffer, {
      contentType: "audio/mp4",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return filePath;
}