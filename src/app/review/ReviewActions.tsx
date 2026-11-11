"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

function SubmitButton({
  children,
  pendingLabel,
  className,
  confirmMessage,
}: {
  children: ReactNode;
  pendingLabel: string;
  className: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
        {children}
      </div>
    </div>
  );
}

const inputClasses =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

const fileClasses =
  "mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-zinc-300 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-50";

function CollabField({ defaultHandles }: { defaultHandles: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700">Instagram collaborations</label>
      <input
        type="text"
        name="collabs"
        defaultValue={defaultHandles}
        placeholder="@handle, @another"
        autoCapitalize="none"
        autoCorrect="off"
        className={inputClasses}
      />
      <p className="mt-1 text-xs text-zinc-500">
        Which Instagram pages should we invite to collaborate on the post? Add up to 3, separated by commas, or
        clear this to skip collaborations.
      </p>
    </div>
  );
}

// The three choices on the emailed review page. The popups are where they pick
// a time or type the changes they want; nothing is sent until they confirm.
export default function ReviewActions({
  minValue,
  defaultHandles,
  goLive,
  schedule,
  requestChanges,
}: {
  minValue: string;
  // Instagram accounts we'd planned to collaborate with, prefilled for them to confirm.
  defaultHandles: string;
  goLive: (formData: FormData) => Promise<void>;
  schedule: (formData: FormData) => Promise<void>;
  requestChanges: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState<"live" | "schedule" | "changes" | null>(null);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setOpen("live")}
          className="rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
        >
          Approve &amp; Go Live Now
        </button>
        <button
          type="button"
          onClick={() => setOpen("schedule")}
          className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Approve &amp; Schedule
        </button>
        <button
          type="button"
          onClick={() => setOpen("changes")}
          className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
        >
          Request Changes
        </button>
      </div>

      {open === "live" && (
        <Modal title="Go live now" onClose={() => setOpen(null)}>
          <form action={goLive} className="mt-4 space-y-4">
            <CollabField defaultHandles={defaultHandles} />
            <p className="text-xs text-zinc-500">
              This publishes your article on ThisIzATL and our Facebook and Instagram right away.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(null)} className="text-sm text-zinc-500 hover:text-zinc-800">
                Cancel
              </button>
              <SubmitButton
                pendingLabel="Publishing…"
                className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Go Live Now
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}

      {open === "schedule" && (
        <Modal title="When should it go live?" onClose={() => setOpen(null)}>
          <form action={schedule} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Date and time (Eastern)</label>
              <input type="datetime-local" name="scheduledFor" required min={minValue} className={inputClasses} />
              <p className="mt-2 text-xs text-zinc-500">
                We publish scheduled articles a few times a day, so it goes live at the first run after your
                time &mdash; it can be a few hours later.
              </p>
            </div>
            <CollabField defaultHandles={defaultHandles} />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(null)} className="text-sm text-zinc-500 hover:text-zinc-800">
                Cancel
              </button>
              <SubmitButton
                pendingLabel="Scheduling…"
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Approve &amp; Schedule
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}

      {open === "changes" && (
        <Modal title="What would you like changed?" onClose={() => setOpen(null)}>
          <form action={requestChanges} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Your changes</label>
              <textarea
                name="note"
                required
                rows={6}
                maxLength={2000}
                placeholder="Write out what needs to be fixed or changed -- a name, a date, a detail, a link, a photo..."
                className={inputClasses}
              />
              <p className="mt-2 text-xs text-zinc-500">
                We&rsquo;ll make the edits and email you a new link to review. Nothing goes live until you approve.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-700">
                Photos <span className="font-normal text-zinc-400">(optional)</span>
              </p>
              <div>
                <label className="block text-xs text-zinc-500">Change main photo</label>
                <input type="file" name="mainPhoto" accept="image/*" className={fileClasses} />
              </div>
              <div>
                <label className="block text-xs text-zinc-500">Add photos (up to 5)</label>
                <input type="file" name="photos" accept="image/*" multiple className={fileClasses} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(null)} className="text-sm text-zinc-500 hover:text-zinc-800">
                Cancel
              </button>
              <SubmitButton
                pendingLabel="Sending…"
                className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Send Changes
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
