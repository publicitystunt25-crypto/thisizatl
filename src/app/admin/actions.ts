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
} from "@/lib/db";
import { slugify } from "@/lib/slug";
import { CATEGORIES } from "@/lib/categories";

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

async function saveImageIfPresent(postId: number, formData: FormData) {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return;
  if (!file.type.startsWith("image/")) {
    throw new Error("Uploaded file is not an image");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  await setPostImage(postId, buffer, file.type, `/api/uploads/${postId}`);
}

export async function createPostAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const fields = readPostFields(formData);

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
  });

  await saveImageIfPresent(id, formData);

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

  await updatePost(id, {
    slug: existing.slug,
    title: fields.title,
    body: fields.body,
    category: fields.category,
    status: fields.status,
  });

  await saveImageIfPresent(id, formData);

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/posts/${existing.slug}`);
  redirect("/admin");
}

export async function deletePostAction(id: number): Promise<void> {
  await requireAdmin();
  await deletePost(id);
  revalidatePath("/");
  revalidatePath("/admin");
}
