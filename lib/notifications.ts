import { supabase } from "./supabase";

export type NotificationType =
  | "follow"
  | "like"
  | "comment"
  | "match"
  | "message"
  | "view"
  | "profile_like"
  | "profile_view"
  | "super_like"
  | "boost"
  | "system";

type CreateNotificationParams = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  data?: Record<string, any>;
};

export async function createNotification(params: CreateNotificationParams) {
  const { userId, actorId, type, title, body, data } = params;

  if (!userId) return;
  if (actorId && actorId === userId) return;

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    actor_id: actorId ?? null,
    type,
    title,
    body: body ?? null,
    data: data ?? {},
  });

  if (error) {
    console.log("CREATE NOTIFICATION ERROR:", error.message);
  }
}

export async function createFollowNotification(params: {
  followedUserId: string;
  followerUserId: string;
  followerName?: string | null;
}) {
  await createNotification({
    userId: params.followedUserId,
    actorId: params.followerUserId,
    type: "follow",
    title: "New follower",
    body: `${params.followerName || "Someone"} followed you.`,
    data: {
      kind: "follow",
      route: "profile",
      actorId: params.followerUserId,
      actor_id: params.followerUserId,
      profileId: params.followerUserId,
      profile_id: params.followerUserId,
      userId: params.followerUserId,
      user_id: params.followerUserId,
    },
  });
}

export async function createLikeNotification(params: {
  postOwnerId: string;
  likerUserId: string;
  likerName?: string | null;
  postId: string;
}) {
  await createNotification({
    userId: params.postOwnerId,
    actorId: params.likerUserId,
    type: "like",
    title: "New like",
    body: `${params.likerName || "Someone"} liked your post.`,
    data: {
      kind: "post_like",
      route: "post",
      actorId: params.likerUserId,
      actor_id: params.likerUserId,
      postId: params.postId,
      post_id: params.postId,
      profileId: params.likerUserId,
      profile_id: params.likerUserId,
      userId: params.likerUserId,
      user_id: params.likerUserId,
    },
  });
}

export async function createProfileLikeNotification(params: {
  likedUserId: string;
  likerUserId: string;
  likerName?: string | null;
}) {
  await createNotification({
    userId: params.likedUserId,
    actorId: params.likerUserId,
    type: "profile_like",
    title: "New profile like",
    body: `${params.likerName || "Someone"} liked your profile.`,
    data: {
      kind: "profile_like",
      route: "profile",
      source: "profile_like_notification",
      lockedPreview: "1",
      actorId: params.likerUserId,
      actor_id: params.likerUserId,
      likerId: params.likerUserId,
      liker_id: params.likerUserId,
      profileLikeId: params.likerUserId,
      profile_like_id: params.likerUserId,
      profileId: params.likerUserId,
      profile_id: params.likerUserId,
      userId: params.likerUserId,
      user_id: params.likerUserId,
    },
  });
}

export async function createSuperLikeNotification(params: {
  receiverUserId: string;
  senderUserId: string;
  senderName?: string | null;
}) {
  await createNotification({
    userId: params.receiverUserId,
    actorId: params.senderUserId,
    type: "super_like",
    title: "New Super Like",
    body: `${params.senderName || "Someone"} super liked your profile.`,
    data: {
      kind: "super_like",
      route: "profile",
      source: "profile_like_notification",
      lockedPreview: "1",
      actorId: params.senderUserId,
      actor_id: params.senderUserId,
      likerId: params.senderUserId,
      liker_id: params.senderUserId,
      profileLikeId: params.senderUserId,
      profile_like_id: params.senderUserId,
      profileId: params.senderUserId,
      profile_id: params.senderUserId,
      userId: params.senderUserId,
      user_id: params.senderUserId,
    },
  });
}

export async function createCommentNotification(params: {
  postOwnerId: string;
  commenterUserId: string;
  commenterName?: string | null;
  postId: string;
  commentId?: string | null;
}) {
  await createNotification({
    userId: params.postOwnerId,
    actorId: params.commenterUserId,
    type: "comment",
    title: "New comment",
    body: `${params.commenterName || "Someone"} commented on your post.`,
    data: {
      kind: "post_comment",
      route: "post_comments",
      actorId: params.commenterUserId,
      actor_id: params.commenterUserId,
      postId: params.postId,
      post_id: params.postId,
      commentId: params.commentId ?? null,
      comment_id: params.commentId ?? null,
      profileId: params.commenterUserId,
      profile_id: params.commenterUserId,
      userId: params.commenterUserId,
      user_id: params.commenterUserId,
    },
  });
}

export async function createMatchNotification(params: {
  userId: string;
  matchedUserId: string;
  matchedUserName?: string | null;
  matchId?: string | null;
}) {
  await createNotification({
    userId: params.userId,
    actorId: params.matchedUserId,
    type: "match",
    title: "New match",
    body: `You matched with ${params.matchedUserName || "someone"}.`,
    data: {
      kind: "match",
      route: "chat",
      actorId: params.matchedUserId,
      actor_id: params.matchedUserId,
      matchId: params.matchId,
      match_id: params.matchId,
      profileId: params.matchedUserId,
      profile_id: params.matchedUserId,
      userId: params.matchedUserId,
      user_id: params.matchedUserId,
    },
  });
}

export async function createMessageNotification(params: {
  receiverUserId: string;
  senderUserId: string;
  senderName?: string | null;
  matchId: string;
  messagePreview?: string | null;
}) {
  const preview = params.messagePreview?.trim();

  await createNotification({
    userId: params.receiverUserId,
    actorId: params.senderUserId,
    type: "message",
    title: `New message from ${params.senderName || "someone"}`,
    body: preview || "You have a new message.",
    data: {
      kind: "message",
      route: "chat",
      actorId: params.senderUserId,
      actor_id: params.senderUserId,
      matchId: params.matchId,
      match_id: params.matchId,
      profileId: params.senderUserId,
      profile_id: params.senderUserId,
      userId: params.senderUserId,
      user_id: params.senderUserId,
    },
  });
}

export async function createProfileViewNotification(params: {
  viewedUserId: string;
  viewerUserId: string;
  viewerName?: string | null;
}) {
  await createNotification({
    userId: params.viewedUserId,
    actorId: params.viewerUserId,
    type: "profile_view",
    title: "Someone viewed your profile",
    body: `${params.viewerName || "Someone"} viewed your profile.`,
    data: {
      kind: "profile_view",
      route: "profile",
      source: "profile_view_notification",
      lockedPreview: "1",
      actorId: params.viewerUserId,
      actor_id: params.viewerUserId,
      viewerId: params.viewerUserId,
      viewer_id: params.viewerUserId,
      profileViewId: params.viewerUserId,
      profile_view_id: params.viewerUserId,
      profileId: params.viewerUserId,
      profile_id: params.viewerUserId,
      userId: params.viewerUserId,
      user_id: params.viewerUserId,
    },
  });
}

export async function createBoostExpiringNotification(params: {
  userId: string;
  minutesLeft?: number | null;
}) {
  const minutes = params.minutesLeft ?? null;

  await createNotification({
    userId: params.userId,
    actorId: null,
    type: "boost",
    title: "Your boost is almost over",
    body:
      typeof minutes === "number" && minutes > 0
        ? `Your boost has about ${minutes} minutes left.`
        : "Your boost is almost over.",
    data: {
      kind: "boost_expiring",
      route: "premium",
    },
  });
}

export async function getProfileDisplayName(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .maybeSingle();

  return data?.display_name || data?.username || "Someone";
}