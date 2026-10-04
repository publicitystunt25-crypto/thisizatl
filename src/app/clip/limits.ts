// Shared by the upload form (to reject early with a friendly message) and the
// server action (the real check) -- keep them in one place so they can't drift.
export const MAX_CLIP_BYTES = 100 * 1024 * 1024; // 100MB -- Cloudinary's free-plan video cap
export const MAX_CLIP_SECONDS = 90;
export const CLIP_FOLDER = "thisizatl/clip-submissions";
