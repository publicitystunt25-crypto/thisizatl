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

function readImageCredit(formData: FormData): string | null {
  const raw = String(formData.get("image_credit") || "").trim();
  return raw || null;
}

function readCreatedAt(formData: FormData): string | null {
  const raw = String(formData.get("created_at") || "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
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
  const buffer = Buffer.from(await file.arrayBuffer());
  await setPostImage(postId, buffer, file.type, `/api/uploads/${postId}`, credit);
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
    const buffer = Buffer.from(await file.arrayBuffer());
    images.push({ data: buffer, mime: file.type, credit });
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
