import Image from "next/image";
import { loginAction } from "../actions";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { error, from } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="ThisIzATL" width={36} height={36} />
          <span className="font-display text-lg font-bold">
            <span className="text-ink">ThisIz</span>
            <span className="text-brand">ATL</span>
          </span>
        </div>
        <h1 className="mt-6 text-lg font-semibold text-ink">
          This site is private
        </h1>

        <form action={loginAction} className="mt-4 space-y-3">
          {from && <input type="hidden" name="from" value={from} />}
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            autoFocus
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
          {error && (
            <p className="text-sm text-red-600">Incorrect password.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-brand py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
