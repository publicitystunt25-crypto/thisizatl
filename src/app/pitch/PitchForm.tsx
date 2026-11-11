"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { requestCoverageAction } from "./actions";
import {
  REQUESTER_ROLES,
  REQUEST_TYPES,
  MAX_PITCH_PHOTOS,
  MAX_PITCH_PHOTO_BYTES,
  MAX_PITCH_DETAILS_CHARS,
  MAX_PITCH_COLLABS,
} from "@/lib/coverage";

// Values ride along on an error so the form can repopulate: React clears an
// uncontrolled form after every action, error or not, which would otherwise
// wipe everything someone typed just because one field was wrong.
export type PitchValues = {
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  organization: string;
  role: string;
  subjectName: string;
  subjectInstagram: string;
  requestType: string;
  details: string;
  eventDate: string;
  deadline: string;
  pressKitUrl: string;
  otherLinks: string;
  collabHandles: string[];
};

export type PitchState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string; values: PitchValues };

const inputClasses =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
const labelClasses = "block text-sm font-medium text-zinc-700";
const hintClasses = "mt-1 text-xs text-zinc-500";

// Same question as the /submit form: which Instagram pages we should invite to
// collaborate on the post.
function CollabFields({ initial }: { initial: string[] }) {
  const [count, setCount] = useState(Math.max(1, Math.min(initial.length, MAX_PITCH_COLLABS)));
  return (
    <div>
      <label className={labelClasses}>What additional pages should we collaborate with on the post? (optional)</label>
      <p className={hintClasses}>
        Instagram pages we should invite as collaborators, such as the artist, a label, or a venue.
      </p>
      <div className="mt-1 space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <input
            key={i}
            type="text"
            name="collabHandle"
            maxLength={200}
            defaultValue={initial[i] ?? ""}
            placeholder="@handle or https://instagram.com/handle"
            className={inputClasses}
          />
        ))}
      </div>
      {count < MAX_PITCH_COLLABS && (
        <button
          type="button"
          onClick={() => setCount((c) => Math.min(c + 1, MAX_PITCH_COLLABS))}
          className="mt-2 text-sm font-medium text-brand-dark hover:underline"
        >
          + Add another page
        </button>
      )}
      <p className={hintClasses}>
        For collab posts, please{" "}
        <a
          href="https://www.instagram.com/thisizatl"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-dark hover:underline"
        >
          follow ThisIzATL on Instagram
        </a>
        .
      </p>
    </div>
  );
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

// Checked in the browser before sending, so a too-big upload doesn't clear the
// rest of the form (a file picker can't be refilled after an error).
function photoProblem(entries: FormDataEntryValue[]): string | null {
  const photos = entries.filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > MAX_PITCH_PHOTOS) {
    return `You chose ${photos.length} photos -- please choose no more than ${MAX_PITCH_PHOTOS}.`;
  }
  if (photos.some((p) => !p.type.startsWith("image/"))) {
    return "Only image files can be attached.";
  }
  const total = photos.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_PITCH_PHOTO_BYTES) {
    return `Those photos total ${formatMB(total)}MB, which is too large -- please choose photos totaling under ${formatMB(MAX_PITCH_PHOTO_BYTES)}MB.`;
  }
  return null;
}

function PitchButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-ink py-3 font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send Request"}
    </button>
  );
}

// useActionState has no reset, so the form lives in an inner component that
// gets remounted (fresh state, empty fields) when someone sends another one.
export default function PitchForm() {
  const [round, setRound] = useState(0);
  return <PitchFormInner key={round} onSendAgain={() => setRound((r) => r + 1)} />;
}

function PitchFormInner({ onSendAgain }: { onSendAgain: () => void }) {
  const [state, formAction] = useActionState(requestCoverageAction, { status: "idle" } as PitchState);
  const [photoError, setPhotoError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const problem = photoProblem(new FormData(e.currentTarget).getAll("photos"));
    if (problem) {
      e.preventDefault();
      setPhotoError(problem);
      return;
    }
    setPhotoError(null);
  }

  if (state.status === "success") {
    return (
      <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-5 text-sm text-green-800">
        <p className="font-medium">Thanks &mdash; we got your request!</p>
        <p className="mt-1">
          Our team reads every request and will reach out if we can cover it. We can&rsquo;t promise
          coverage or a timeline, but we look at everything that comes in.
        </p>
        <button type="button" onClick={onSendAgain} className="mt-3 font-medium text-green-900 underline">
          Send another request
        </button>
      </div>
    );
  }

  const v = state.status === "error" ? state.values : null;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="mt-6 space-y-5">
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      <div>
        <label className={labelClasses}>Your name</label>
        <input
          type="text"
          name="requesterName"
          required
          maxLength={80}
          defaultValue={v?.requesterName ?? ""}
          className={inputClasses}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Email</label>
          <input
            type="email"
            name="requesterEmail"
            required
            maxLength={200}
            defaultValue={v?.requesterEmail ?? ""}
            placeholder="you@email.com"
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Phone (optional)</label>
          <input
            type="tel"
            name="requesterPhone"
            maxLength={40}
            defaultValue={v?.requesterPhone ?? ""}
            className={inputClasses}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>I am a&hellip;</label>
          <select name="role" defaultValue={v?.role ?? REQUESTER_ROLES[0]} className={inputClasses}>
            {REQUESTER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClasses}>Company / label / PR firm (optional)</label>
          <input
            type="text"
            name="organization"
            maxLength={120}
            defaultValue={v?.organization ?? ""}
            className={inputClasses}
          />
        </div>
      </div>

      <div>
        <label className={labelClasses}>Who or what is the coverage about?</label>
        <input
          type="text"
          name="subjectName"
          required
          maxLength={160}
          defaultValue={v?.subjectName ?? ""}
          placeholder="Artist, group, project, brand or event name"
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>Their Instagram (optional)</label>
        <input
          type="text"
          name="subjectInstagram"
          maxLength={200}
          defaultValue={v?.subjectInstagram ?? ""}
          placeholder="@handle or https://instagram.com/handle"
          className={inputClasses}
        />
      </div>

      <CollabFields initial={v?.collabHandles ?? []} />

      <div>
        <label className={labelClasses}>What type of coverage are you looking for?</label>
        <select name="requestType" defaultValue={v?.requestType ?? REQUEST_TYPES[0]} className={inputClasses}>
          {REQUEST_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClasses}>Tell us about it</label>
        <textarea
          name="details"
          required
          rows={6}
          maxLength={MAX_PITCH_DETAILS_CHARS}
          defaultValue={v?.details ?? ""}
          placeholder="Who they are, what's new (release, project or event), and why Atlanta would care."
          className={inputClasses}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Release or event date (optional)</label>
          <input type="date" name="eventDate" defaultValue={v?.eventDate ?? ""} className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>Need coverage by (optional)</label>
          <input type="date" name="deadline" defaultValue={v?.deadline ?? ""} className={inputClasses} />
        </div>
      </div>

      <div>
        <label className={labelClasses}>Press kit or media folder link (optional)</label>
        <input
          type="url"
          name="pressKitUrl"
          maxLength={500}
          defaultValue={v?.pressKitUrl ?? ""}
          placeholder="https://drive.google.com/…"
          className={inputClasses}
        />
        <p className={hintClasses}>Photos, one-sheets, bios &mdash; a Google Drive or Dropbox folder works great.</p>
      </div>

      <div>
        <label className={labelClasses}>Music, video or other links (optional)</label>
        <textarea
          name="otherLinks"
          rows={3}
          maxLength={1000}
          defaultValue={v?.otherLinks ?? ""}
          placeholder="One link per line"
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>Photos (optional)</label>
        <input
          type="file"
          name="photos"
          accept="image/*"
          multiple
          className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-dark"
        />
        <p className={hintClasses}>
          Up to {MAX_PITCH_PHOTOS} photos &mdash; press shots, cover art or flyers. If something goes wrong when you
          send, you&rsquo;ll need to choose the photos again.
        </p>
      </div>

      {photoError && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{photoError}</p>
      )}

      {state.status === "error" && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{state.message}</p>
      )}

      <PitchButton />
    </form>
  );
}
