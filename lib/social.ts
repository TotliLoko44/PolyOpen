import { decode } from "base64-arraybuffer";
import { getBlockedUserIds } from "./block";
import { supabase } from "./supabase";

export type FeedItem = {
  post_id: string;
  author_id: string;
  author_name: string | null;
  author_username: string | null;
  author_avatar: string | null;
  caption: string | null;
  post_type: string;
  visibility: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  media_count: number;
  first_media_url: string | null;
  first_media_type?: string | null;
  is_following: boolean;
  is_connected: boolean;
};

export type CommentReactionType = "like" | "dislike";

export type CommentItem = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  like_count: number;
  dislike_count: number;
  my_reaction: CommentReactionType | null;
  replies: CommentItem[];
};

type RawCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  parent_comment_id?: string | null;
};

type RawReactionRow = {
  comment_id: string;
  user_id: string;
  reaction_type: CommentReactionType;
};

type ProfilePostRow = {
  id: string;
  author_id?: string | null;
  user_id?: string | null;
  text?: string | null;
  caption?: string | null;
  media_url?: string | null;
  post_type?: string | null;
  visibility?: string | null;
  created_at?: string | null;
};

function extFromUri(uri: string) {
  const clean = uri.split("?")[0] ?? uri;
  const parts = clean.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "jpg";
}

function mimeFromExt(ext: string) {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "jpeg":
    case "jpg":
      return "image/jpeg";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "m4v":
      return "video/mp4";
    case "webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

function isVideoUri(uri: string) {
  const ext = extFromUri(uri);
  return ["mp4", "mov", "m4v", "webm"].includes(ext);
}

async function blobToArrayBuffer(blob: Blob) {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to convert file."));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to convert file."));
    reader.readAsDataURL(blob);
  });

  return decode(base64);
}

function isPublicVisibility(value?: string | null) {
  return value === "public";
}

function isFriendsVisibility(value?: string | null) {
  return value === "followers" || value === "friends" || value === "connections";
}

function canViewerSeePost(args: {
  viewerId: string;
  authorId?: string | null;
  visibility?: string | null;
  isConnected?: boolean;
}) {
  const { viewerId, authorId, visibility, isConnected } = args;

  if (!authorId) return false;
  if (viewerId === authorId) return true;
  if (isPublicVisibility(visibility)) return true;
  if (isFriendsVisibility(visibility)) return !!isConnected;
  return false;
}

async function hydrateFeedMediaTypes(posts: FeedItem[]) {
  const postIds = posts.map((post) => post.post_id).filter(Boolean);

  if (postIds.length === 0) return posts;

  const { data, error } = await supabase
    .from("post_media")
    .select("post_id, media_url, media_type, sort_order")
    .in("post_id", postIds)
    .order("sort_order", { ascending: true });

  if (error) {
    console.log("FEED MEDIA HYDRATION WARNING:", error.message);
    return posts;
  }

  const firstMediaMap = new Map<
    string,
    {
      media_url: string | null;
      media_type: string | null;
    }
  >();

  for (const row of (data ?? []) as Array<{
    post_id: string;
    media_url?: string | null;
    media_type?: string | null;
  }>) {
    if (!row.post_id || firstMediaMap.has(row.post_id)) continue;

    firstMediaMap.set(row.post_id, {
      media_url: row.media_url ?? null,
      media_type: row.media_type ?? null,
    });
  }

  return posts.map((post) => {
    const firstMedia = firstMediaMap.get(post.post_id);
    const hydratedUrl = post.first_media_url || firstMedia?.media_url || null;
    const hydratedType =
      firstMedia?.media_type ||
      post.first_media_type ||
      (hydratedUrl && isVideoUri(hydratedUrl) ? "video" : null);

    return {
      ...post,
      first_media_url: hydratedUrl,
      first_media_type: hydratedType,
      post_type:
        post.post_type === "video" || hydratedType === "video"
          ? "video"
          : post.post_type,
    };
  });
}

export async function getFeedForUser(userId: string, limit = 25, offset = 0) {
  const { data, error } = await supabase.rpc("get_feed_for_user", {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;

  const blockedIds = await getBlockedUserIds(userId);

  const visiblePosts = ((data ?? []) as FeedItem[]).filter((post) => {
    if (blockedIds.includes(post.author_id)) return false;

    return canViewerSeePost({
      viewerId: userId,
      authorId: post.author_id,
      visibility: post.visibility,
      isConnected: !!post.is_connected,
    });
  });

  return hydrateFeedMediaTypes(visiblePosts);
}

export async function likePost(
  postId: string,
  userId: string,
  alreadyLiked: boolean
) {
  if (alreadyLiked) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);

    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from("post_likes").insert({
    post_id: postId,
    user_id: userId,
  });

  if (error) throw error;
  return true;
}

export async function uploadPostMedia(
  userId: string,
  postId: string,
  uri: string
) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const ext = extFromUri(uri);
  const contentType = mimeFromExt(ext);
  const filePath = `${userId}/${postId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("post-media")
    .upload(filePath, await blobToArrayBuffer(blob), {
      contentType,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from("post-media").getPublicUrl(filePath);

  return {
    url: data.publicUrl,
    mediaType: contentType.startsWith("video/") ? "video" : "image",
  };
}

export async function createPostWithMedia(args: {
  authorId: string;
  caption: string;
  visibility: "public" | "followers";
  mediaUris: string[];
}) {
  const { authorId, caption, visibility, mediaUris } = args;

  const hasVideo = mediaUris.some((uri) => isVideoUri(uri));

  const postType =
    mediaUris.length === 0
      ? "text"
      : hasVideo
        ? "video"
        : mediaUris.length === 1
          ? "image"
          : "gallery";

  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      author_id: authorId,
      caption: caption.trim() || null,
      post_type: postType,
      visibility,
    })
    .select("id")
    .single();

  if (postError) throw postError;

  if (mediaUris.length > 0) {
    const mediaRows = [];

    for (let i = 0; i < mediaUris.length; i++) {
      const uploaded = await uploadPostMedia(authorId, post.id, mediaUris[i]);

      mediaRows.push({
        post_id: post.id,
        media_url: uploaded.url,
        media_type: uploaded.mediaType,
        sort_order: i,
      });
    }

    const { error: mediaError } = await supabase
      .from("post_media")
      .insert(mediaRows);

    if (mediaError) throw mediaError;
  }

  return post.id;
}

export async function repostPost(args: {
  userId: string;
  originalPost: FeedItem;
}) {
  const { userId, originalPost } = args;

  const validType =
    originalPost.post_type === "text" ||
    originalPost.post_type === "image" ||
    originalPost.post_type === "gallery" ||
    originalPost.post_type === "video"
      ? originalPost.post_type
      : originalPost.first_media_type === "video"
        ? "video"
        : "image";

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: userId,
      caption: `🔁 Reposted\n\n${originalPost.caption ?? ""}`,
      post_type: validType,
      visibility: "public",
    })
    .select("id")
    .single();

  if (error) throw error;

  if (originalPost.first_media_url) {
    const mediaType =
      originalPost.post_type === "video" || originalPost.first_media_type === "video"
        ? "video"
        : "image";

    const { error: mediaError } = await supabase.from("post_media").insert({
      post_id: post.id,
      media_url: originalPost.first_media_url,
      media_type: mediaType,
      sort_order: 0,
    });

    if (mediaError) throw mediaError;
  }

  return post.id;
}

export async function getCommentsForPost(
  postId: string,
  viewerId?: string | null
) {
  const { data: comments, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, body, created_at, parent_comment_id")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const typedComments = (comments ?? []) as RawCommentRow[];
  const commentIds = typedComments.map((comment) => comment.id);
  const userIds = [...new Set(typedComments.map((comment) => comment.user_id))];

  let profileMap = new Map<
    string,
    {
      display_name: string | null;
      profile_photo_url: string | null;
      avatar_url: string | null;
    }
  >();

  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, profile_photo_url, avatar_url")
      .in("id", userIds);

    if (profileError) throw profileError;

    profileMap = new Map(
      ((profiles ?? []) as Array<{
        id: string;
        display_name: string | null;
        profile_photo_url: string | null;
        avatar_url: string | null;
      }>).map((profile) => [profile.id, profile])
    );
  }

  let reactions: RawReactionRow[] = [];

  if (commentIds.length > 0) {
    const { data: reactionRows, error: reactionError } = await supabase
      .from("post_comment_reactions")
      .select("comment_id, user_id, reaction_type")
      .in("comment_id", commentIds);

    if (reactionError) throw reactionError;

    reactions = (reactionRows ?? []) as RawReactionRow[];
  }

  const reactionStats = new Map<
    string,
    {
      like_count: number;
      dislike_count: number;
      my_reaction: CommentReactionType | null;
    }
  >();

  for (const commentId of commentIds) {
    reactionStats.set(commentId, {
      like_count: 0,
      dislike_count: 0,
      my_reaction: null,
    });
  }

  for (const reaction of reactions) {
    const current =
      reactionStats.get(reaction.comment_id) ??
      {
        like_count: 0,
        dislike_count: 0,
        my_reaction: null,
      };

    if (reaction.reaction_type === "like") current.like_count += 1;
    if (reaction.reaction_type === "dislike") current.dislike_count += 1;

    if (viewerId && reaction.user_id === viewerId) {
      current.my_reaction = reaction.reaction_type;
    }

    reactionStats.set(reaction.comment_id, current);
  }

  const hydratedFlat: CommentItem[] = typedComments.map((comment) => {
    const profile = profileMap.get(comment.user_id);
    const stats = reactionStats.get(comment.id) ?? {
      like_count: 0,
      dislike_count: 0,
      my_reaction: null,
    };

    return {
      id: comment.id,
      post_id: comment.post_id,
      user_id: comment.user_id,
      body: comment.body,
      created_at: comment.created_at,
      parent_comment_id: comment.parent_comment_id ?? null,
      author_name: profile?.display_name ?? "User",
      author_avatar: profile?.profile_photo_url || profile?.avatar_url || null,
      like_count: stats.like_count,
      dislike_count: stats.dislike_count,
      my_reaction: stats.my_reaction,
      replies: [],
    };
  });

  const byId = new Map<string, CommentItem>();
  const roots: CommentItem[] = [];

  for (const comment of hydratedFlat) {
    byId.set(comment.id, comment);
  }

  for (const comment of hydratedFlat) {
    if (comment.parent_comment_id) {
      const parent = byId.get(comment.parent_comment_id);

      if (parent) {
        parent.replies.push(comment);
      } else {
        roots.push(comment);
      }
    } else {
      roots.push(comment);
    }
  }

  return roots;
}

export async function addCommentToPost(args: {
  postId: string;
  userId: string;
  body: string;
  parentCommentId?: string | null;
}) {
  const { postId, userId, body, parentCommentId = null } = args;

  const trimmed = body.trim();

  if (!trimmed) {
    throw new Error("Comment cannot be empty.");
  }

  const { data: insertedComment, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: postId,
      user_id: userId,
      body: trimmed,
      parent_comment_id: parentCommentId,
    })
    .select("id, post_id")
    .single();

  if (error) throw error;

  try {
    const [{ data: postRow }, { data: profileRow }] = await Promise.all([
      supabase.from("posts").select("author_id").eq("id", postId).maybeSingle(),

      supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const postOwnerId = postRow?.author_id;

    if (postOwnerId && postOwnerId !== userId) {
      const commenterName =
        profileRow?.display_name || profileRow?.username || "Someone";

      const { createCommentNotification } = await import("./notifications");

      await createCommentNotification({
        postOwnerId,
        commenterUserId: userId,
        commenterName,
        postId,
        commentId: insertedComment.id,
      });
    }
  } catch (notificationError) {
    console.log("COMMENT NOTIFICATION ERROR:", notificationError);
  }

  return insertedComment;
}

export async function setCommentReaction(args: {
  commentId: string;
  userId: string;
  reactionType: CommentReactionType;
  currentReaction?: CommentReactionType | null;
}) {
  const { commentId, userId, reactionType, currentReaction = null } = args;

  if (currentReaction === reactionType) {
    const { error } = await supabase
      .from("post_comment_reactions")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);

    if (error) throw error;
    return null;
  }

  const { error } = await supabase
    .from("post_comment_reactions")
    .upsert(
      {
        comment_id: commentId,
        user_id: userId,
        reaction_type: reactionType,
      },
      {
        onConflict: "comment_id,user_id",
      }
    );

  if (error) throw error;

  return reactionType;
}

async function getMediaMapForPostIds(postIds: string[]) {
  const mediaMap: Record<string, string[]> = {};

  if (postIds.length === 0) return mediaMap;

  const { data: mediaRows, error: mediaError } = await supabase
    .from("post_media")
    .select("post_id, media_url, sort_order")
    .in("post_id", postIds)
    .order("sort_order", { ascending: true });

  if (mediaError) throw mediaError;

  for (const row of (mediaRows ?? []) as Array<{
    post_id: string;
    media_url?: string | null;
  }>) {
    if (!row.post_id || !row.media_url) continue;
    if (!mediaMap[row.post_id]) mediaMap[row.post_id] = [];
    mediaMap[row.post_id].push(row.media_url);
  }

  return mediaMap;
}

export async function getPostsForProfile(authorId: string) {
  const { data: posts, error: postError } = await supabase
    .from("posts")
    .select(
      "id, author_id, user_id, text, caption, media_url, post_type, visibility, created_at"
    )
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });

  if (postError) throw postError;

  const typedPosts = (posts ?? []) as ProfilePostRow[];
  const postIds = typedPosts.map((post) => post.id);
  const mediaMap = await getMediaMapForPostIds(postIds);

  return typedPosts.map((post) => {
    const mediaUrls =
      mediaMap[post.id] ?? (post.media_url ? [post.media_url] : []);

    return {
      ...post,
      first_media_url: mediaUrls[0] ?? null,
      media_urls: mediaUrls,
    };
  });
}

export async function getVisiblePostsForProfile(
  viewerId: string,
  authorId: string
) {
  const blockedIds = await getBlockedUserIds(viewerId);
  if (blockedIds.includes(authorId)) return [];

  let isConnected = false;

  if (viewerId !== authorId) {
    const { data: connectionRow, error: connectionError } = await supabase
      .from("connections")
      .select("status")
      .or(
        `and(requester_id.eq.${viewerId},addressee_id.eq.${authorId}),and(requester_id.eq.${authorId},addressee_id.eq.${viewerId})`
      )
      .eq("status", "accepted")
      .maybeSingle();

    if (connectionError) throw connectionError;
    isConnected = !!connectionRow;
  }

  const { data: posts, error: postError } = await supabase
    .from("posts")
    .select(
      "id, author_id, user_id, text, caption, media_url, post_type, visibility, created_at"
    )
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });

  if (postError) throw postError;

  const typedPosts = ((posts ?? []) as ProfilePostRow[]).filter((post) =>
    canViewerSeePost({
      viewerId,
      authorId: post.author_id ?? authorId,
      visibility: post.visibility,
      isConnected,
    })
  );

  const postIds = typedPosts.map((post) => post.id);
  const mediaMap = await getMediaMapForPostIds(postIds);

  return typedPosts.map((post) => {
    const mediaUrls =
      mediaMap[post.id] ?? (post.media_url ? [post.media_url] : []);

    return {
      ...post,
      first_media_url: mediaUrls[0] ?? null,
      media_urls: mediaUrls,
    };
  });
}

export async function deletePost(postId: string) {
  const { data: mediaRows, error: mediaReadError } = await supabase
    .from("post_media")
    .select("media_url")
    .eq("post_id", postId);

  if (mediaReadError) throw mediaReadError;

  const storagePaths: string[] = [];

  for (const row of (mediaRows ?? []) as Array<{ media_url?: string | null }>) {
    const mediaUrl = row.media_url ?? "";
    const marker = "/storage/v1/object/public/post-media/";

    if (mediaUrl.includes(marker)) {
      const path = mediaUrl.split(marker)[1];
      if (path) storagePaths.push(path);
    }
  }

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("post-media")
      .remove(storagePaths);

    if (storageError) {
      console.log("Storage delete warning:", storageError.message);
    }
  }

  const { error: mediaDeleteError } = await supabase
    .from("post_media")
    .delete()
    .eq("post_id", postId);

  if (mediaDeleteError) throw mediaDeleteError;

  const { error: likesDeleteError } = await supabase
    .from("post_likes")
    .delete()
    .eq("post_id", postId);

  if (likesDeleteError) throw likesDeleteError;

  const { data: commentRows, error: commentReadError } = await supabase
    .from("post_comments")
    .select("id")
    .eq("post_id", postId);

  if (commentReadError) throw commentReadError;

  const commentIds = ((commentRows ?? []) as Array<{ id: string }>).map(
    (row) => row.id
  );

  if (commentIds.length > 0) {
    const { error: reactionDeleteError } = await supabase
      .from("post_comment_reactions")
      .delete()
      .in("comment_id", commentIds);

    if (reactionDeleteError) throw reactionDeleteError;
  }

  const { error: commentsDeleteError } = await supabase
    .from("post_comments")
    .delete()
    .eq("post_id", postId);

  if (commentsDeleteError) throw commentsDeleteError;

  const { error: postDeleteError } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId);

  if (postDeleteError) throw postDeleteError;
}