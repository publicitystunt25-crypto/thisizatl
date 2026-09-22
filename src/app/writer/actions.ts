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
import sharp from "sharp";

// Applies the writer's "which photo is the main one" choice and writes each
// new upload to the database as soon as it's processed, one at a time --
// rather than decoding/resizing every photo into memory first and only then
// writing any of them. This server runs with 512MB of RAM total; sharp
// decodes a JPEG to a raw, uncompressed bitmap while resizing it, which can
// balloon well past the original file's size, so holding several photos'
// worth of that in memory at once is what was crashing the whole site with
// an out-of-memory kill on a multi-photo upload -- not a size-limit
// rejection, an actual server crash affecting every visitor. Processing and
// storing one photo before starting the next keeps peak memory to roughly
// one photo's worth regardless of how many are attached.
//
// Whichever image loses the "main" slot is preserved by moving it into the
// gallery rather than deleted -- switching the main photo shouldn't destroy
// a photo that was already attached to the article.
async function processAndSaveNewPhotos(
  postId: number,
  formData: FormData,
  mainChoice: string
): Promise<void> {
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  // No new files and no "promote an existing gallery photo" choice means
  // there's nothing to do -- the default mainChoice ("new:0"/"keep") when no
  // photo was ever attached shouldn't be treated as a real selection.
  if (files.length === 0 && !mainChoice.startsWith("existing:")) return;

  const mainNewIndex = mainChoice.startsWith("new:") ? Number(mainChoice.slice("new:".length)) : -1;
  if (files.length > 0 && mainNewIndex >= 0 && !files[mainNewIndex]) {
    throw new Error("Selected main photo not found");
  }

  const existing = await getPostById(postId);

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
  } else if (mainNewIndex >= 0 && existing?.image_url) {
    const oldMain = await getPostImage(postId);
    if (oldMain) {
      await addPostImages(postId, [{ data: oldMain.data, mime: oldMain.mime, credit: existing.image_credit }]);
    }
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) {
      throw new Error("Uploaded file is not an image");
    }
    const credit = String(formData.get(`photo_credit_${i}`) || "").trim() || null;
    const raw = Buffer.from(await file.arrayBuffer());
    const isMain = i === mainNewIndex;
    const { buffer, mime, width, height, focus } = await processImageUpload(raw, 1600, isMain);

    if (isMain) {
      await setPostImage(postId, buffer, mime, `/api/uploads/${postId}`, credit, { width, height }, focus);
    } else {
      await addPostImages(postId, [{ data: buffer, mime, credit }]);
    }
    // buffer/raw fall out of scope here and can be garbage collected before
    // the next file is even read off disk, instead of all of them living
    // until the whole batch finishes.
  }
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
  await processAndSaveNewPhotos(id, formData, mainChoice);

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
  await processAndSaveNewPhotos(id, formData, mainChoice);

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
