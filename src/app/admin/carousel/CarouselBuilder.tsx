"use client";

import { useEffect, useRef, useState } from "react";
import {
  getCarouselStatusAction,
  getCarouselUploadTicket,
  postCarouselAction,
  previewCarouselCoverAction,
  type CarouselStatus,
} from "./actions";
import { MAX_CLIP_BYTES } from "@/app/clip/limits";
import { MAX_HEADLINE_LENGTH } from "@/lib/coverLayout";

const inputClasses =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
const labelClasses = "block text-sm font-medium text-zinc-700";
const MAX_CLIPS = 19; // plus the cover = Instagram's 20-slide limit
const MAX_SLIDE_SECONDS = 60;

const DEFAULT_HEADLINE = "The Mia Snow Hologram Challenge Has the Internet in a Frenzy";
const DEFAULT_CAPTION =
  "The Mia Snow Hologram Challenge has the internet in a frenzy. Swipe through the clips and see what everybody is talking about.\n\nFollow @thisizatl for more.";

type Clip = {
  key: string;
  name: string;
  file: File;
  duration: number | null;
  state: "queued" | "uploading" | "done" | "error";
  progress: number;
  publicId?: string;
  error?: string;
};

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

function uploadToCloudinary(
  file: File,
  ticket: { cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string },
  onProgress: (percent: number) => void
): Promise<string> {
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
        if (xhr.status >= 200 && xhr.status < 300 && data.public_id) resolve(data.public_id as string);
        else reject(new Error(data?.error?.message || "The upload didn't go through."));
      } catch {
        reject(new Error("The upload didn't go through."));
      }
    };
    xhr.onerror = () => reject(new Error("The upload was interrupted."));
    xhr.send(body);
  });
}

export default function CarouselBuilder() {
  const [headline, setHeadline] = useState(DEFAULT_HEADLINE);
  const [caption, setCaption] = useState(DEFAULT_CAPTION);
  const [collabs, setCollabs] = useState(["", "", ""]);
  const [coverSource, setCoverSource] = useState<"plain" | "photo" | "clip">("clip");
  const [coverClipKey, setCoverClipKey] = useState<string>("");
  const [coverTime, setCoverTime] = useState(1);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CarouselStatus>({ state: "idle", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const uploading = useRef(false);

  const patch = (key: string, changes: Partial<Clip>) =>
    setClips((list) => list.map((c) => (c.key === key ? { ...c, ...changes } : c)));

  // Uploads queued clips one at a time, straight from the browser to Cloudinary.
  useEffect(() => {
    if (uploading.current) return;
    const next = clips.find((c) => c.state === "queued");
    if (!next) return;
    uploading.current = true;
    (async () => {
      patch(next.key, { state: "uploading", progress: 0 });
      try {
        const ticket = await getCarouselUploadTicket();
        if (!ticket.ok) throw new Error(ticket.error);
        const publicId = await uploadToCloudinary(next.file, ticket, (p) => patch(next.key, { progress: p }));
        patch(next.key, { state: "done", progress: 100, publicId });
      } catch (err) {
        patch(next.key, { state: "error", error: err instanceof Error ? err.message : "Upload failed." });
      } finally {
        uploading.current = false;
        setClips((list) => [...list]); // wake the effect for the next one
      }
    })();
  }, [clips]);

  // While a post is running, check on it every few seconds.
  useEffect(() => {
    getCarouselStatusAction().then(setStatus).catch(() => {});
  }, []);
  useEffect(() => {
    if (status.state !== "posting") return;
    const t = setInterval(() => {
      getCarouselStatusAction().then(setStatus).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [status.state]);

  async function addClips(files: FileList | null) {
    if (!files) return;
    setError(null);
    const added: Clip[] = [];
    for (const file of Array.from(files)) {
      if (clips.length + added.length >= MAX_CLIPS) {
        setError(`That's the most clips Instagram allows (${MAX_CLIPS} plus the cover).`);
        break;
      }
      if (!file.type.startsWith("video/")) {
        setError(`${file.name} isn't a video.`);
        continue;
      }
      if (file.size > MAX_CLIP_BYTES) {
        setError(`${file.name} is over ${Math.round(MAX_CLIP_BYTES / 1024 / 1024)}MB.`);
        continue;
      }
      const duration = await readDuration(file);
      if (duration != null && duration > MAX_SLIDE_SECONDS + 0.5) {
        setError(`${file.name} is ${Math.round(duration)} seconds. Keep clips to ${MAX_SLIDE_SECONDS} seconds or less.`);
        continue;
      }
      added.push({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, file, duration, state: "queued", progress: 0 });
    }
    if (added.length) setClips((list) => [...list, ...added]);
  }

  function move(index: number, delta: number) {
    setClips((list) => {
      const to = index + delta;
      if (to < 0 || to >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[to]] = [copy[to], copy[index]];
      return copy;
    });
  }

  async function previewCover() {
    setError(null);
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("headline", headline);
      const problem = addCoverFields(fd);
      if (problem) {
        setError(problem);
        return;
      }
      const res = await previewCarouselCoverAction(fd);
      if (!res.ok) setError(res.error);
      else setCoverPreview(res.dataUrl);
    } catch {
      setError("Couldn't build the preview.");
    } finally {
      setPreviewing(false);
    }
  }

  const uploadedClips = clips.filter((c) => c.state === "done" && c.publicId);
  const coverClip = uploadedClips.find((c) => c.key === coverClipKey) ?? uploadedClips[0];

  function addCoverFields(fd: FormData): string | null {
    if (coverSource === "photo" && coverFile) fd.append("coverPhoto", coverFile);
    if (coverSource === "clip") {
      if (!coverClip) return "Upload a clip first, then pick the frame for the cover.";
      fd.append("coverClip", coverClip.publicId as string);
      fd.append("coverTime", String(coverTime));
    }
    return null;
  }

  const allUploaded = clips.length > 0 && clips.every((c) => c.state === "done");
  const posting = status.state === "posting";

  async function post() {
    setError(null);
    if (!coverPreview) return setError("Preview the cover first so you can approve how it looks.");
    if (!allUploaded) return setError("Wait for every clip to finish uploading.");
    if (!window.confirm(`Post this carousel (cover + ${clips.length} clips) to Instagram now?`)) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("headline", headline);
      fd.append("caption", caption);
      const problem = addCoverFields(fd);
      if (problem) {
        setError(problem);
        return;
      }
      for (const c of clips) fd.append("clip", c.publicId as string);
      for (const h of collabs) if (h.trim()) fd.append("collab", h);
      const res = await postCarouselAction(fd);
      if (!res.ok) setError(res.error);
      else setStatus({ state: "posting", message: "Starting" });
    } catch {
      setError("Something went wrong starting the post.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-ink">1. Cover slide</h2>
        <div>
          <label className={labelClasses}>Headline on the cover</label>
          <input
            type="text"
            maxLength={MAX_HEADLINE_LENGTH}
            value={headline}
            onChange={(e) => {
              setHeadline(e.target.value);
              setCoverPreview(null);
            }}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Cover picture</label>
          <select
            value={coverSource}
            onChange={(e) => {
              setCoverSource(e.target.value as "plain" | "photo" | "clip");
              setCoverPreview(null);
            }}
            className={inputClasses}
          >
            <option value="clip">A frame from one of my clips</option>
            <option value="photo">A photo I upload</option>
            <option value="plain">Plain ThisIzATL card (headline only)</option>
          </select>
        </div>
        {coverSource === "photo" && (
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setCoverFile(e.target.files?.[0] ?? null);
                setCoverPreview(null);
              }}
              className="block w-full text-sm text-zinc-600"
            />
          </div>
        )}
        {coverSource === "clip" && (
          <div className="space-y-3">
            {uploadedClips.length === 0 ? (
              <p className="text-sm text-zinc-500">Add your clips below first. Once one finishes uploading you can pick the frame here.</p>
            ) : (
              <>
                <div>
                  <label className={labelClasses}>Which clip</label>
                  <select
                    value={coverClip?.key ?? ""}
                    onChange={(e) => {
                      setCoverClipKey(e.target.value);
                      setCoverPreview(null);
                    }}
                    className={inputClasses}
                  >
                    {uploadedClips.map((c) => (
                      <option key={c.key} value={c.key}>
                        Clip {clips.indexOf(c) + 1}: {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClasses}>Moment in the clip (seconds)</label>
                  <input
                    type="number"
                    min={0}
                    max={coverClip?.duration ? Math.max(0, Math.floor(coverClip.duration * 10) / 10 - 0.2) : 600}
                    step={0.5}
                    value={coverTime}
                    onChange={(e) => {
                      setCoverTime(Number(e.target.value) || 0);
                      setCoverPreview(null);
                    }}
                    className={inputClasses}
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    {coverClip?.duration ? `That clip is ${Math.round(coverClip.duration * 10) / 10} seconds. ` : ""}
                    Change the time and press Preview until you like the frame.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={previewCover}
          disabled={previewing}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {previewing ? "Building preview…" : coverPreview ? "Refresh preview" : "Preview cover"}
        </button>
        {coverPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverPreview} alt="Cover preview" className="w-[320px] max-w-full rounded-xl ring-2 ring-zinc-300" />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-ink">2. Video clips (in order)</h2>
        <input
          type="file"
          accept="video/*"
          multiple
          onChange={(e) => {
            void addClips(e.target.files);
            e.target.value = "";
          }}
          className="block w-full text-sm text-zinc-600"
        />
        <p className="text-xs text-zinc-500">
          Up to {MAX_CLIPS} clips, {MAX_SLIDE_SECONDS} seconds each. Vertical clips get trimmed to Instagram&rsquo;s 4:5
          shape, so keep the action in the middle.
        </p>
        <ol className="space-y-2">
          {clips.map((c, i) => (
            <li key={c.key} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
              <span className="w-6 text-zinc-500">{i + 2}</span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="w-28 text-right text-xs text-zinc-500">
                {c.state === "done" && "Uploaded"}
                {c.state === "queued" && "Waiting"}
                {c.state === "uploading" && `Uploading ${c.progress}%`}
                {c.state === "error" && <span className="text-red-600">{c.error}</span>}
              </span>
              <button type="button" onClick={() => move(i, -1)} className="px-1 text-zinc-500 hover:text-ink" aria-label="Move up">
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} className="px-1 text-zinc-500 hover:text-ink" aria-label="Move down">
                ↓
              </button>
              <button
                type="button"
                onClick={() => setClips((list) => list.filter((x) => x.key !== c.key))}
                className="px-1 text-zinc-500 hover:text-red-600"
                aria-label="Remove"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
        <p className="text-xs text-zinc-500">Slide 1 is the cover, so your first clip is slide 2.</p>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-ink">3. Caption and collaborators</h2>
        <div>
          <label className={labelClasses}>Caption</label>
          <textarea
            rows={6}
            maxLength={2200}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Collaborators (up to 3 Instagram handles, optional)</label>
          {collabs.map((h, i) => (
            <input
              key={i}
              type="text"
              placeholder="@handle"
              value={h}
              onChange={(e) => setCollabs((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
              className={inputClasses}
            />
          ))}
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {status.state !== "idle" && (
        <div
          className={`rounded-lg p-3 text-sm ${
            status.state === "done"
              ? "bg-green-50 text-green-800"
              : status.state === "failed"
                ? "bg-red-50 text-red-700"
                : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {status.state === "posting" && `Posting… ${status.message}. This can take several minutes, and you can leave this page open.`}
          {status.state === "done" && "Posted to Instagram. The carousel is live."}
          {status.state === "failed" && `It didn't post: ${status.message}`}
        </div>
      )}

      <button
        type="button"
        onClick={post}
        disabled={submitting || posting || !allUploaded}
        className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"
      >
        {posting ? "Posting…" : "Post to Instagram"}
      </button>
    </div>
  );
}
