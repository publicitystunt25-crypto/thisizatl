import { cookies } from "next/headers";

export const ADMIN_COOKIE = "admin_session";
export const WRITER_COOKIE = "writer_session";

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

export interface WriterAccount {
  username: string;
  password: string;
  name: string;
}

// A short, hand-editable list rather than a full users table -- there's one
// writer today and this covers a handful more without new infrastructure.
// Format: WRITERS_JSON='[{"username":"...","password":"...","name":"..."}]'
function getWriters(): WriterAccount[] {
  try {
    const parsed = JSON.parse(process.env.WRITERS_JSON || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function checkWriterLogin(
  username: string,
  password: string
): Promise<WriterAccount | null> {
  const writers = getWriters();
  return writers.find((w) => w.username === username && w.password === password) ?? null;
}

// Same "cookie is a hash of a secret" pattern as the admin session, just
// bound to one writer's own username+password instead of the shared admin
// password, so writers can't see or forge each other's sessions.
export async function expectedWriterToken(username: string, password: string): Promise<string> {
  return sha256Hex(`writer:${username}:${password}`);
}

export async function getCurrentWriter(): Promise<{ username: string; name: string } | null> {
  const store = await cookies();
  const cookie = store.get(WRITER_COOKIE)?.value;
  if (!cookie) return null;

  for (const writer of getWriters()) {
    const expected = await expectedWriterToken(writer.username, writer.password);
    if (cookie === expected) {
      return { username: writer.username, name: writer.name };
    }
  }
  return null;
}

export async function requireWriter(): Promise<{ username: string; name: string }> {
  const writer = await getCurrentWriter();
  if (!writer) {
    throw new Error("Unauthorized");
  }
  return writer;
}
