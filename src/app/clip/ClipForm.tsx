"use client";

import { useRef, useState } from "react";
import { getClipUploadTicket, submitClipAction } from "./actions";
import { MAX_CLIP_BYTES, MAX_CLIP_SECONDS } from "./limits";

const inputClasses =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
const labelClasses = "block text-sm font-medium text-zinc-700";

type Phase = "idle" | "uploading" | "saving" | "done";

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

const MAX_CLIP_MB = Math.round(MAX_CLIP_BYTES / (1024 * 1024));

// Reads the clip's length in the browser so a too-long video is rejected
// before a long upload, not after. Resolves null if the browser can't read
// it (the server checks the real duration with Cloudinary regardless).
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 4000);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      finish(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    video.src = url;
  });
}

type CloudinaryResult = { public_id: string };

function uploadToCloudinary(
  file: File,
  ticket: { cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string },
  onProgress: (percent: number) => void
): Promise<CloudinaryResult> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    body.append("api_key", ticket.apiKey);
    body.append("timestamp", String(ticket.timestamp));
    body.append("folder", ticket.folder);
    body.append("signature", ticket.signature);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${ticket.cloudName}/video/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.public_id) {
          resolve({ public_id: data.public_id });
        } else {
          reject(new Error(data?.error?.message || "The upload didn't go through."));
        }
      } catch {
        reject(new Error("The upload didn't go through."));
      }
    };
    xhr.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
    xhr.send(body);
  });
}

export default function ClipForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [caption, setCaption] = useState("");
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState("");

  const busy = phase === "uploading" || phase === "saving";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Please choose a video to upload.");
    if (!file.type.startsWith("video/")) return setError("That file isn't a video.");
    if (file.size > MAX_CLIP_BYTES) {
      return setError(
        `That video is ${formatMB(file.size)}MB -- please choose one under ${MAX_CLIP_MB}MB.`
      );
    }
    const duration = await readDuration(file);
    if (duration != null && duration > MAX_CLIP_SECONDS + 1) {
      return setError(
        `That clip is ${Math.round(duration)} seconds -- please trim it to ${MAX_CLIP_SECONDS} seconds or less.`
      );
    }

    try {
      setPhase("uploading");
      setProgress(0);
      const ticket = await getClipUploadTicket();
      if (!ticket.ok) throw new Error(ticket.error);
      const uploaded = await uploadToCloudinary(file, ticket, setProgress);

      setPhase("saving");
      const result = await submitClipAction({
        name,
        email,
        instagram,
        caption,
        consent,
        company,
        publicId: uploaded.public_id,
      });
      if (!result.ok) throw new Error(result.error);
      setPhase("done");
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (phase === "done") {
    return (
      <div className="mt-8 rounded-xl border border-green-300 bg-green-50 p-6 text-sm text-green-800">
        <p className="font-medium">Thanks &mdash; we got your clip!</p>
        <p className="mt-1">
          Our team will take a look. If we post it, we&rsquo;ll tag you
          {instagram ? "" : " (add your Instagram next time so we can)"}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      <div>
        <label className={labelClasses}>Your video clip</label>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          required
          disabled={busy}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-dark"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Up to {MAX_CLIP_SECONDS} seconds and {MAX_CLIP_MB}MB. Vertical videos work best.
          {fileName ? ` Selected: ${fileName}` : ""}
        </p>
      </div>

      <div>
        <label className={labelClasses}>Your name</label>
        <input
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>Your Instagram (so we can tag you)</label>
        <input
          type="text"
          maxLength={200}
          placeholder="@handle or https://instagram.com/handle"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          disabled={busy}
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>Your email (optional)</label>
        <input
          type="email"
          maxLength={200}
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>Caption</label>
        <textarea
          required
          rows={4}
          maxLength={2000}
          placeholder="Tell us about the clip -- what's happening, where, and who's in it."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={busy}
          className={inputClasses}
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={busy}
          className="mt-1"
        />
        <span>
          I confirm this video is mine (or I have permission to share it) and I&rsquo;m okay with
          ThisIzATL posting it on Instagram.
        </span>
      </label>

      {phase === "uploading" && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">Uploading… {progress}% (keep this page open)</p>
        </div>
      )}
      {phase === "saving" && <p className="text-xs text-zinc-500">Saving your submission…</p>}

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-brand py-3 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Uploading… please keep this page open" : "Submit Clip"}
      </button>
    </form>
  );
}
