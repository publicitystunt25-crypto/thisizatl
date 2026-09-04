import { cookies } from "next/headers";

export const ADMIN_COOKIE = "admin_session";

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The cookie value is a hash of the admin password -- provable only by
// whoever knows the password, without storing the password itself in the
// cookie.
export async function expectedSessionToken(): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error("ADMIN_PASSWORD is not set");
  }
  return sha256Hex(secret);
}

export async function checkPassword(candidate: string): Promise<boolean> {
  return candidate === process.env.ADMIN_PASSWORD;
}

// Defense in depth: server actions check auth themselves, not just middleware.
export async function requireAdmin(): Promise<void> {
  const store = await cookies();
  const cookie = store.get(ADMIN_COOKIE)?.value;
  const expected = await expectedSessionToken();
  if (cookie !== expected) {
    throw new Error("Unauthorized");
  }
}
