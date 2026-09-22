"use client";

import { useEffect } from "react";
import { clearFormDraft, ARTIST_DRAFT_KEY, OTHER_DRAFT_KEY } from "./formDraft";

// Reaching this page means the submission actually succeeded server-side --
// clearing here (rather than optimistically on submit) guarantees the saved
// draft only disappears once it's genuinely no longer needed.
export default function ClearDraftOnMount() {
  useEffect(() => {
    clearFormDraft(ARTIST_DRAFT_KEY);
    clearFormDraft(OTHER_DRAFT_KEY);
  }, []);

  return null;
}
