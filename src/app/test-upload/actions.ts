"use server";

import { redirect } from "next/navigation";

// Deliberately does nothing but measure the file -- no Claude calls, no DB
// writes, no image processing. The point is to isolate whether the upload
// itself reaches the app at all (vs. getting blocked before it does), with
// no other moving parts that could also fail.
export async function testUploadAction(formData: FormData): Promise<void> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A file is required");
  }

  redirect(
    `/test-upload/result?size=${file.size}&name=${encodeURIComponent(file.name)}&type=${encodeURIComponent(file.type)}`
  );
}
