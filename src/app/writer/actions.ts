"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  WRITER_COOKIE,
  checkWriterLogin,
  expectedWriterToken,
  requireWriter,
} from "@/lib/auth";
import {
  insertPost,
  updatePost,
  deletePost,
  getPostById,
  getPostImage,
  getPostImages,
  getGalleryImageBytes,
  setPostImage,
  addPostImages,
  deletePostImageRow,
  setSocialShared,
} from "@/lib/db";
import { slugify } from "@/lib/slug";
import { CATEGORIES } from "@/lib/categories";
import { shareNewPost, deleteFacebookPost } from "@/lib/social";
import { processImageUpload } from "@/lib/image";
import type { VisionFocus } from "@/lib/visionFocus";
import sharp from "sharp";

// Reads every "photos" file plus its matching "photo_credit_<i>" text field,
// in the same order the client rendered them -- so "new:<i>" from the main-
// choice radio lines up with photos[i] here. Focus detection (a Claude
// vision call, several seconds each) only runs for whichever upload is
// actually going to be the main photo -- it's the only one that reads
// focus_x/focus_y, and running it for every photo is what made picking
// several at once look "stuck" for far longer than the upload itself takes.
async function readNewPhotos(
  formData: FormData,
  mainChoice: string
): Promise<{ buffer: Buffer; mime: string; width: number; height: number; credit: string | null; focus: VisionFocus | null }[]> {
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const mainNewIndex = mainChoice.startsWith("new:") ? Number(mainChoice.slice("new:".length)) : -1;
  const photos = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) {
      throw new Error("Uploaded file is not an image");
    }
    const credit = String(formData.get(`photo_credit_${i}`) || "").trim() || null;
    const raw = Buffer.from(await file.arrayBuffer());
    const { buffer, mime, width, height, focus } = await processImageUpload(raw, 1600, i === mainNewIndex);
    photos.push({ buffer, mime, width, height, credit, focus });
  }
  return photos;
}

// Applies the writer's "which photo is the main one" choice, given the new
// photos just uploaded (readNewPhotos above) and, for an edit, whatever the
// post already had. Whichever image loses the "main" slot is preserved by
// moving it into the gallery rather than deleted -- switching the main photo
// shouldn't destroy a photo that was already attached to the article.
async function applyPhotoChoice(
  postId: number,
  mainChoice: string,
  newPhotos: { buffer: Buffer; mime: string; width: number; height: number; credit: string | null; focus: VisionFocus | null }[]
): Promise<void> {
  const existing = await getPostById(postId);
  const galleryOverflow = newPhotos.filter((_, i) => `new:${i}` !== mainChoice);

  if (mainChoice.startsWith("new:")) {
    const index = Number(mainChoice.slice("new:".length));
    const chosen = newPhotos[index];
    if (!chosen) throw new Error("Selected main photo not found");

    if (existing?.image_url) {
      const oldMain = await getPostImage(postId);
      if (oldMain) {
        await addPostImages(postId, [{ data: oldMain.data, mime: oldMain.mime, credit: existing.image_credit }]);
      }
    }
    await setPostImage(postId, chosen.buffer, chosen.mime, `/api/uploads/${postId}`, chosen.credit, {
      width: chosen.width,
      height: chosen.height,
    }, chosen.focus);
    await addPostImages(postId, galleryOverflow.map((p) => ({ data: p.buffer, mime: p.mime, credit: p.credit })));
    return;
  }

  if (mainChoice.startsWith("existing:")) {
    const galleryId = Number(mainChoice.slice("existing:".length));
    // getGalleryImageBytes takes a bare id with no post scoping -- confirm
    // this gallery photo actually belongs to postId first, or a writer could
    // promote a photo from any post (including someone else's) into her own
    // article just by knowing its id.
    const ownGalleryImages = await getPostImages(postId);
    if (!ownGalleryImages.some((img) => img.id === galleryId)) {
      throw new Error("Selected main photo not found");
    }
    const promoted = await getGalleryImageBytes(galleryId);
    if (!promoted) throw new Error("Selected main photo not found");
    const meta = await sharp(promoted.data).metadata();

    if (existing?.image_url) {
      const oldMain = await getPostImage(postId);
      if (oldMain) {
        await addPostImages(postId, [{ data: oldMain.data, mime: oldMain.mime, credit: existing.image_credit }]);
      }
    }
    await setPostImage(postId, promoted.data, promoted.mime, `/api/uploads/${postId}`, null, {
      width: meta.width ?? 0,
      height: meta.height ?? 0,
    }, null);
    await deletePostImageRow(galleryId);
    await addPostImages(postId, newPhotos.map((p) => ({ data: p.buffer, mime: p.mime, credit: p.credit })));
    return;
  }

  // "keep" -- main photo (if any) is unchanged; every new upload just joins the gallery.
  await addPostImages(postId, newPhotos.map((p) => ({ data: p.buffer, mime: p.mime, credit: p.credit })));
}

export async function writerLoginAction(formData: FormData): Promise<void> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  const writer = await checkWriterLogin(username, password);
  if (!writer) {
    redirect("/writer/login?error=1");
  }

  const store = await cookies();
  store.set(WRITER_COOKIE, await expectedWriterToken(writer.username, writer.password), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/writer");
}

export async function writerLogoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(WRITER_COOKIE);
  redirect("/writer/login");
}

export async function createWriterPostAction(formData: FormData): Promise<void> {
  const writer = await requireWriter();

  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const category = String(formData.get("category") || "Music");
  const status = formData.get("status") === "draft" ? "draft" : "published";

  if (!title) throw new Error("Title is required");
  if (!body) throw new Error("Body is required");
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    throw new Error("Invalid category");
  }

  const id = await insertPost({
    slug: slugify(title),
    title,
    body,
    sources: [],
    similarity_note: null,
    image_url: null,
    image_credit_name: null,
    image_credit_url: null,
    category,
    status,
    author: writer.name,
  });

  const mainChoice = String(formData.get("mainChoice") || "new:0");
  const newPhotos = await readNewPhotos(formData, mainChoice);
  if (newPhotos.length > 0) {
    await applyPhotoChoice(id, mainChoice, newPhotos);
  }

  if (status === "published") {
    const post = await getPostById(id);
    if (post) {
      const result = await shareNewPost({ id: post.id, title: post.title, slug: post.slug, image_url: post.image_url });
      await setSocialShared(post.id, result.ok, result.fbPostId);
    }
  }

  revalidatePath("/");
  redirect("/writer?posted=1");
}

export async function updateWriterPostAction(id: number, formData: FormData): Promise<void> {
  const writer = await requireWriter();

  const existing = await getPostById(id);
  // A writer can only edit their own byline -- someone else's post (or a
  // stale/guessed id) is treated the same as "not found".
  if (!existing || existing.author !== writer.name) {
    throw new Error("Post not found");
  }

  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const category = String(formData.get("category") || "Music");
  const status = formData.get("status") === "draft" ? "draft" : "published";

  if (!title) throw new Error("Title is required");
  if (!body) throw new Error("Body is required");
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    throw new Error("Invalid category");
  }

  await updatePost(id, {
    slug: existing.slug,
    title,
    body,
    category,
    status,
  });

  const mainChoice = String(formData.get("mainChoice") || "keep");
  const newPhotos = await readNewPhotos(formData, mainChoice);
  if (newPhotos.length > 0 || mainChoice.startsWith("existing:")) {
    await applyPhotoChoice(id, mainChoice, newPhotos);
  }

  if (existing.status !== "published" && status === "published") {
    const post = await getPostById(id);
    if (post) {
      const result = await shareNewPost({ id: post.id, title: post.title, slug: post.slug, image_url: post.image_url });
      await setSocialShared(post.id, result.ok, result.fbPostId);
    }
  }

  revalidatePath("/");
  revalidatePath(`/posts/${existing.slug}`);
  redirect("/writer?updated=1");
}

export async function deleteWriterPostAction(id: number): Promise<void> {
  const writer = await requireWriter();

  const existing = await getPostById(id);
  // Same ownership check as edit/update -- deleting someone else's post (or
  // a stale/guessed id) is treated the same as "not found".
  if (!existing || existing.author !== writer.name) {
    throw new Error("Post not found");
  }

  if (existing.fb_post_id) {
    try {
      await deleteFacebookPost(existing.fb_post_id);
    } catch (err) {
      console.error("Facebook post delete failed:", err);
    }
  }

  await deletePost(id);

  revalidatePath("/");
  redirect("/writer?deleted=1");
}

export async function deleteWriterGalleryImageAction(postId: number, imageId: number): Promise<void> {
  const writer = await requireWriter();

  const existing = await getPostById(postId);
  if (!existing || existing.author !== writer.name) {
    throw new Error("Post not found");
  }

  // deletePostImageRow takes a bare image id with no post scoping -- confirm
  // this image actually belongs to postId first, or a writer could delete
  // any gallery row on any post (including someone else's) just by knowing
  // its id.
  const galleryImages = await getPostImages(postId);
  if (!galleryImages.some((img) => img.id === imageId)) {
    throw new Error("Photo not found on this post");
  }

  await deletePostImageRow(imageId);
  revalidatePath(`/writer/${postId}/edit`);
}
