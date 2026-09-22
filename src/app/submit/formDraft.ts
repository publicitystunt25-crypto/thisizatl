"use client";

import { useEffect, useRef } from "react";

// After everything that's gone wrong today (WAF blocks, payload-too-large
// crashes, stale caches), the one thing that should never happen again is
// someone losing five paragraphs of typed answers to a crash or an
// accidental refresh. Saves every text field to localStorage as they type
// and restores it on mount -- skips the photo (can't usefully persist a
// File across a reload) and the honeypot field.
const SKIP_FIELDS = new Set(["photo", "company"]);
const DEBOUNCE_MS = 400;

function isPersistableField(
  el: Element
): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (
    !(el instanceof HTMLInputElement) &&
    !(el instanceof HTMLTextAreaElement) &&
    !(el instanceof HTMLSelectElement)
  ) {
    return false;
  }
  if (!el.name || SKIP_FIELDS.has(el.name)) return false;
  if (el instanceof HTMLInputElement && (el.type === "file" || el.type === "radio")) return false;
  return true;
}

export function useFormDraft(storageKey: string) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved) as Record<string, string>;
        for (const el of Array.from(form.elements)) {
          if (isPersistableField(el) && data[el.name] !== undefined) {
            el.value = data[el.name];
          }
        }
      }
    } catch {
      // localStorage can throw (private browsing, disabled storage) --
      // drafts are a convenience, never worth breaking the form over.
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;
    function handleInput() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        try {
          const data: Record<string, string> = {};
          for (const el of Array.from(form!.elements)) {
            if (isPersistableField(el)) data[el.name] = el.value;
          }
          localStorage.setItem(storageKey, JSON.stringify(data));
        } catch {
          // ignore -- same reasoning as above
        }
      }, DEBOUNCE_MS);
    }

    form.addEventListener("input", handleInput);
    return () => {
      form.removeEventListener("input", handleInput);
      if (timeout) clearTimeout(timeout);
    };
  }, [storageKey]);

  return formRef;
}

export function clearFormDraft(storageKey: string) {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

export const ARTIST_DRAFT_KEY = "thisizatl_submission_draft_artist";
export const OTHER_DRAFT_KEY = "thisizatl_submission_draft_other";
