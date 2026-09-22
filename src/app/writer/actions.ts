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
import { insertPost, updatePost, deletePost, getPostById, setPostImage, setSocialShared } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { CATEGORIES } from "@/lib/categories";
import { shareNewPost, deleteFacebookPost } from "@/lib/social";
import { processImageUpload } from "@/lib/image";

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

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) {
      throw new Error("Uploaded file is not an image");
    }
    const credit = String(formData.get("photoCredit") || "").trim() || null;
    const raw = Buffer.from(await photo.arrayBuffer());
    const { buffer, mime, width, height, focus } = await processImageUpload(raw, 1600);
    await setPostImage(id, buffer, mime, `/api/uploads/${id}`, credit, { width, height }, focus);
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

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) {
      throw new Error("Uploaded file is not an image");
    }
    const credit = String(formData.get("photoCredit") || "").trim() || null;
    const raw = Buffer.from(await photo.arrayBuffer());
    const { buffer, mime, width, height, focus } = await processImageUpload(raw, 1600);
    await setPostImage(id, buffer, mime, `/api/uploads/${id}`, credit, { width, height }, focus);
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
