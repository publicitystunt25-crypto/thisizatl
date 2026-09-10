"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ADMIN_COOKIE,
  checkPassword,
  expectedSessionToken,
  requireAdmin,
} from "@/lib/auth";
import {
  insertPost,
  updatePost,
  deletePost,
  setPostImage,
  getPostById,
  addPostImages,
  deletePostImageRow,
  clearPostImage,
  setFeaturedPost,
  unsetFeaturedPost,
  setSocialShared,
  setIgFeedShared,
  setIgMediaId,
  schedulePost,
  cancelSchedule,
  clearSchedule,
} from "@/lib/db";
import { slugify } from "@/lib/slug";
import { CATEGORIES } from "@/lib/categories";
import { shareNewPost, postToInstagramFeed, extractInstagramHandle, deleteFacebookPost } from "@/lib/social";
import { generateFeedCaption } from "@/lib/generate";
import { sendArticleLiveNotification } from "@/lib/email";
import { fromEasternDatetimeLocalValue } from "@/lib/date";
import { processImageUpload } from "@/lib/image";

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") || "");
  const ok = await checkPassword(password);
  if (!ok) {
    redirect("/admin/login?error=1");
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, await expectedSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

function readPostFields(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const category = String(formData.get("category") || "News");
  const status = formData.get("status") === "draft" ? "draft" : "published";

  if (!title) throw new Error("Title is required");
  if (!body) throw new Error("Body is required");
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    throw new Error("Invalid category");
  }

  return { title, body, category, status: status as "draft" | "published" };
}

function readImageCredit(formData: FormData): string | null {
  const raw = String(formData.get("image_credit") || "").trim();
  return raw || null;
}

function readCreatedAt(formData: FormData): string | null {
  const raw = String(formData.get("created_at") || "").trim();
  if (!raw) return null;
  try {
    return fromEasternDatetimeLocalValue(raw);
  } catch {
    return null;
  }
}

async function saveImageIfPresent(
  postId: number,
  formData: FormData,
  credit: string | null
) {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return;
  if (!file.type.startsWith("image/")) {
    throw new Error("Uploaded file is not an image");
  }
  const raw = Buffer.from(await file.arrayBuffer());
  const { buffer, mime, width, height, focus } = await processImageUpload(raw, 1600);
  await setPostImage(postId, buffer, mime, `/api/uploads/${postId}`, credit, { width, height }, focus);
}

async function saveGalleryIfPresent(postId: number, formData: FormData) {
  const files = formData.getAll("gallery").filter((f) => f instanceof File && f.size > 0) as File[];
  if (files.length === 0) return;

  const images: { data: Buffer; mime: string; credit: string | null }[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) {
      throw new Error("Uploaded gallery file is not an image");
    }
    const credit = String(formData.get(`gallery_credit_${i}`) || "").trim() || null;
    const raw = Buffer.from(await file.arrayBuffer());
    const { buffer, mime } = await processImageUpload(raw, 1200);
    images.push({ data: buffer, mime, credit });
  }
  await addPostImages(postId, images);
}

export async function createPostAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const fields = readPostFields(formData);
  const credit = readImageCredit(formData);
  const createdAt = readCreatedAt(formData);

  const id = await insertPost({
    slug: slugify(fields.title),
    title: fields.title,
    body: fields.body,
    sources: [],
    similarity_note: null,
    image_url: null,
    image_credit_name: null,
    image_credit_url: null,
    category: fields.category,
    status: fields.status,
    author: "ThisIzATL Staff",
    created_at: createdAt,
  });

  await saveImageIfPresent(id, formData, credit);
  await saveGalleryIfPresent(id, formData);

  if (fields.status === "published") {
    const post = await getPostById(id);
    if (post) {
      const result = await shareNewPost({ id: post.id, title: post.title, slug: post.slug, image_url: post.image_url });
      await setSocialShared(post.id, result.ok, result.fbPostId);
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function updatePostAction(
  id: number,
  formData: FormData
): Promise<void> {
  await requireAdmin();
  const existing = await getPostById(id);
  if (!existing) throw new Error("Post not found");

  const fields = readPostFields(formData);
  const credit = readImageCredit(formData);
  const createdAt = readCreatedAt(formData);

  await updatePost(id, {
    slug: existing.slug,
    title: fields.title,
    body: fields.body,
    category: fields.category,
    status: fields.status,
    image_credit: credit,
    created_at: createdAt,
  });

  await saveImageIfPresent(id, formData, credit);
  await saveGalleryIfPresent(id, formData);

  if (existing.status === "draft" && fields.status === "published") {
    const post = await getPostById(id);
    if (post) {
      const result = await shareNewPost({ id: post.id, title: post.title, slug: post.slug, image_url: post.image_url });
      await setSocialShared(post.id, result.ok, result.fbPostId);
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/posts/${existing.slug}`);
  redirect("/admin");
}

export async function deletePostAction(id: number): Promise<void> {
  await requireAdmin();
  const post = await getPostById(id);
  if (post?.fb_post_id) {
    try {
      await deleteFacebookPost(post.fb_post_id);
    } catch (err) {
      console.error("Facebook post delete failed:", err);
    }
  }
  await deletePost(id);
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function deleteGalleryImageAction(
  imageId: number,
  postId: number
): Promise<void> {
  await requireAdmin();
  await deletePostImageRow(imageId);
  revalidatePath(`/admin/${postId}/edit`);
  revalidatePath("/");
}

export async function deleteFeaturedImageAction(postId: number): Promise<void> {
  await requireAdmin();
  await clearPostImage(postId);
  revalidatePath(`/admin/${postId}/edit`);
  revalidatePath("/");
}

export async function setFeaturedPostAction(id: number): Promise<void> {
  await requireAdmin();
  await setFeaturedPost(id);
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function unsetFeaturedPostAction(id: number): Promise<void> {
  await requireAdmin();
  await unsetFeaturedPost(id);
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function approvePostAction(id: number): Promise<void> {
  await requireAdmin();
  const post = await getPostById(id);
  if (!post) throw new Error("Post not found");

  // Guards against double-posting to Facebook/Instagram if this action fires
  // twice for the same click -- e.g. a slow request getting silently retried
  // by the browser or a proxy. A post that's already published has nothing
  // left to do here.
  if (post.status === "published") return;

  await updatePost(id, {
    slug: post.slug,
    title: post.title,
    body: post.body,
    category: post.category,
    status: "published",
  });

  let instagramHandle: string | null = null;
  try {
    const sources = JSON.parse(post.sources) as { source: string; url: string }[];
    const igSource = sources.find((s) => s.source === "Instagram");
    instagramHandle = extractInstagramHandle(igSource?.url);
  } catch {
    // sources isn't valid JSON or doesn't include an Instagram entry -- fine,
    // just means no tag gets attached.
  }

  const result = await shareNewPost({
    id: post.id,
    title: post.title,
    slug: post.slug,
    image_url: post.image_url,
    instagramHandle,
  });
  await setSocialShared(post.id, result.ok, result.fbPostId);
  await clearSchedule(post.id);

  if (post.submitter_email) {
    try {
      await sendArticleLiveNotification(post.submitter_email, post.image_credit || "there", post.title, post.slug);
    } catch (err) {
      console.error("Article-live notification email failed:", err);
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

// Approves the post the same way approvePostAction does, then additionally
// publishes it to the Instagram Feed (not just the Story) with a
// Claude-written caption and a collaborator invite to the artist's own
// account -- the collab invite is what actually triggers a notification to
// them. Requires a valid Instagram handle on the submission; without one
// there's nobody to invite, so this falls back to a plain approve.
export async function acceptAllAction(id: number): Promise<void> {
  await requireAdmin();
  const post = await getPostById(id);
  if (!post) throw new Error("Post not found");

  let instagramHandle: string | null = null;
  let collaboratorHandles: string[] = [];
  try {
    const sources = JSON.parse(post.sources) as { source: string; url: string }[];
    const igSource = sources.find((s) => s.source === "Instagram");
    instagramHandle = extractInstagramHandle(igSource?.url);
    collaboratorHandles = sources
      .filter((s) => s.source === "Collaborator")
      .map((s) => extractInstagramHandle(s.url))
      .filter((h): h is string => !!h);
  } catch {
    // sources isn't valid JSON or doesn't include an Instagram entry -- fine,
    // just means no tag/collab gets attached.
  }

  if (post.status !== "published") {
    await updatePost(id, {
      slug: post.slug,
      title: post.title,
      body: post.body,
      category: post.category,
      status: "published",
    });

    const result = await shareNewPost({
      id: post.id,
      title: post.title,
      slug: post.slug,
      image_url: post.image_url,
      instagramHandle,
    });
    await setSocialShared(post.id, result.ok, result.fbPostId);
    await clearSchedule(post.id);

    if (post.submitter_email) {
      try {
        await sendArticleLiveNotification(post.submitter_email, post.image_credit || "there", post.title, post.slug);
      } catch (err) {
        console.error("Article-live notification email failed:", err);
      }
    }
  }

  if (instagramHandle && !post.ig_feed_shared) {
    try {
      const caption = await generateFeedCaption({
        title: post.title,
        body: post.body,
        instagramHandle,
      });
      const feedResult = await postToInstagramFeed({
        id: post.id,
        title: post.title,
        slug: post.slug,
        image_url: post.image_url,
        instagramHandle,
        collaboratorHandles,
        caption,
      });
      if (feedResult.mediaId) {
        await setIgMediaId(post.id, feedResult.mediaId);
      }
      await setIgFeedShared(post.id, true);
    } catch (err) {
      console.error("Instagram feed publish failed:", err);
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function schedulePostAction(id: number, formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = String(formData.get("scheduledFor") || "").trim();
  if (!raw) throw new Error("Scheduled time is required");
  const scheduledFor = fromEasternDatetimeLocalValue(raw);
  await schedulePost(id, scheduledFor);
  revalidatePath("/admin");
}

export async function cancelScheduleAction(id: number): Promise<void> {
  await requireAdmin();
  await cancelSchedule(id);
  revalidatePath("/admin");
}

export async function retrySocialShareAction(id: number): Promise<void> {
  await requireAdmin();
  const post = await getPostById(id);
  if (!post) throw new Error("Post not found");

  let instagramHandle: string | null = null;
  try {
    const sources = JSON.parse(post.sources) as { source: string; url: string }[];
    const igSource = sources.find((s) => s.source === "Instagram");
    instagramHandle = extractInstagramHandle(igSource?.url);
  } catch {
    // sources isn't valid JSON or doesn't include an Instagram entry -- fine,
    // just means no tag gets attached.
  }

  const result = await shareNewPost({
    id: post.id,
    title: post.title,
    slug: post.slug,
    image_url: post.image_url,
    instagramHandle,
    existingFbPostId: post.fb_post_id,
  });
  await setSocialShared(post.id, result.ok, result.fbPostId);

  revalidatePath("/admin");
}
