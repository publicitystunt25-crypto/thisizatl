"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  addPostImages,
  deleteCoverageRequest,
  deletePost,
  getCoverageRequest,
  insertPost,
  listCoverageRequestImages,
  setCoverageRequestPost,
  setCoverageRequestStatus,
  setPostImage,
  type CoverageStatus,
} from "@/lib/db";
import { generateCoverageDraft } from "@/lib/coverageDraft";
import { processImageUpload } from "@/lib/image";
import { normalizeInstagramInput } from "@/lib/social";
import { slugify } from "@/lib/slug";

const STATUSES: CoverageStatus[] = ["new", "accepted", "declined", "covered"];

export async function setCoverageStatusAction(id: number, status: CoverageStatus): Promise<void> {
  await requireAdmin();
  if (!STATUSES.includes(status)) throw new Error("Invalid status");
  await setCoverageRequestStatus(id, status);
  revalidatePath("/admin/requests");
  revalidatePath("/admin");
}

// Permanent. Photos go with it; a draft article made from the request stays.
export async function deleteCoverageRequestAction(id: number): Promise<void> {
  await requireAdmin();
  await deleteCoverageRequest(id);
  revalidatePath("/admin/requests");
  revalidatePath("/admin");
}

// Writes a first draft from the request and opens it in the editor. Nothing is
// published or posted: it's an ordinary draft you review, edit and approve.
export async function createDraftFromRequestAction(id: number): Promise<void> {
  await requireAdmin();
  const request = await getCoverageRequest(id);
  if (!request) throw new Error("Request not found");
  if (request.post_id) redirect(`/admin/${request.post_id}/edit`);

  const draft = await generateCoverageDraft(request);

  const instagramUrl = request.subject_instagram ? normalizeInstagramInput(request.subject_instagram) : null;
  let collabUrls: string[] = [];
  try {
    collabUrls = request.collab_instagrams ? (JSON.parse(request.collab_instagrams) as string[]) : [];
  } catch {
    collabUrls = [];
  }
  const postId = await insertPost({
    slug: slugify(draft.title),
    title: draft.title,
    body: draft.body,
    sources: [
      ...(instagramUrl ? [{ title: "Follow on Instagram", url: instagramUrl, source: "Instagram" }] : []),
      ...collabUrls.map((url) => ({ title: "Collaborate", url, source: "Collaborator" })),
    ],
    similarity_note: null,
    image_url: null,
    image_credit_name: null,
    image_credit_url: null,
    category: draft.category,
    status: "draft",
    author: "ThisIzATL Staff",
    // Lets "Email preview" reach the requester, and means they get the usual
    // "your feature is live" email when it's published, like /submit authors.
    submitter_email: request.requester_email,
  });

  // A double-click can start two drafts at once; only the first to link wins.
  if (!(await setCoverageRequestPost(id, postId))) {
    await deletePost(postId);
    const current = await getCoverageRequest(id);
    redirect(`/admin/${current?.post_id ?? ""}/edit`);
  }

  // The first photo is the article's main image, the rest its gallery -- one
  // at a time, to keep memory near a single photo's worth.
  const photos = await listCoverageRequestImages(id);
  for (let i = 0; i < photos.length; i++) {
    try {
      const { buffer, mime, width, height, focus } = await processImageUpload(photos[i].data, 1600, i === 0);
      if (i === 0) {
        await setPostImage(postId, buffer, mime, `/api/uploads/${postId}`, request.subject_name, { width, height }, focus);
      } else {
        await addPostImages(postId, [{ data: buffer, mime, credit: request.subject_name }]);
      }
    } catch (err) {
      console.error("Coverage request photo skipped while making a draft:", err);
    }
  }

  if (request.status === "new") await setCoverageRequestStatus(id, "accepted");
  revalidatePath("/admin/requests");
  revalidatePath("/admin");
  redirect(`/admin/${postId}/edit`);
}
