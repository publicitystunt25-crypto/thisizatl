"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { nominateAction } from "./nominate";

// Values ride along on an error so the form can repopulate: React clears an
// uncontrolled form after every action, error or not, which would otherwise
// wipe everything someone typed just because one field was wrong.
export type NominateValues = {
  nominatorName: string;
  nomineeName: string;
  nomineeEmail: string;
  nomineeInstagram: string;
};

export type NominateState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string; values: NominateValues };

const inputClasses =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
const labelClasses = "block text-sm font-medium text-zinc-700";

function NominateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-ink py-3 font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Sending…" : "Submit Nomination"}
    </button>
  );
}

// useActionState has no reset, so the form lives in an inner component that
// gets remounted (fresh state, empty fields) when someone nominates again.
export default function NominateForm() {
  const [round, setRound] = useState(0);
  return <NominateFormInner key={round} onNominateAgain={() => setRound((r) => r + 1)} />;
}

function NominateFormInner({ onNominateAgain }: { onNominateAgain: () => void }) {
  const [state, formAction] = useActionState(nominateAction, { status: "idle" } as NominateState);

  if (state.status === "success") {
    return (
      <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-5 text-sm text-green-800">
        <p className="font-medium">Thanks for the nomination!</p>
        <p className="mt-1">We&rsquo;ll take a look and reach out if we feature them.</p>
        <button
          type="button"
          onClick={onNominateAgain}
          className="mt-3 font-medium text-green-900 underline"
        >
          Nominate someone else
        </button>
      </div>
    );
  }

  const values = state.status === "error" ? state.values : null;

  return (
    <form action={formAction} className="mt-6 space-y-5">
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
          name="nominatorName"
          required
          maxLength={80}
          defaultValue={values?.nominatorName ?? ""}
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>Name of who you&rsquo;re nominating</label>
        <input
          type="text"
          name="nomineeName"
          required
          maxLength={120}
          defaultValue={values?.nomineeName ?? ""}
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>
          Their email (optional &mdash; we&rsquo;ll email them an invitation to be featured)
        </label>
        <input
          type="email"
          name="nomineeEmail"
          maxLength={200}
          defaultValue={values?.nomineeEmail ?? ""}
          placeholder="them@email.com"
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses}>Their Instagram (optional)</label>
        <input
          type="text"
          name="nomineeInstagram"
          maxLength={200}
          defaultValue={values?.nomineeInstagram ?? ""}
          placeholder="@handle or https://instagram.com/handle"
          className={inputClasses}
        />
      </div>

      {state.status === "error" && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <NominateButton />
    </form>
  );
}
