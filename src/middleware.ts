import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, WRITER_COOKIE, expectedSessionToken, getCurrentWriter } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/writer")) {
    if (pathname === "/writer/login") {
      return NextResponse.next();
    }
    // getCurrentWriter reads from next/headers' cookies(), which isn't
    // available in middleware -- check the raw cookie against every known
    // writer's token directly instead of reusing that helper.
    const cookie = request.cookies.get(WRITER_COOKIE)?.value;
    const writer = cookie ? await findWriterByToken(cookie) : null;
    if (!writer) {
      return NextResponse.redirect(new URL("/writer/login", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  const expected = await expectedSessionToken();

  if (cookie !== expected) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

async function findWriterByToken(token: string) {
  // Mirrors getCurrentWriter's lookup without depending on next/headers.
  const { expectedWriterToken } = await import("@/lib/auth");
  let writers: { username: string; password: string; name: string }[] = [];
  try {
    const parsed = JSON.parse(process.env.WRITERS_JSON || "[]");
    if (Array.isArray(parsed)) writers = parsed;
  } catch {
    // ignore
  }
  for (const w of writers) {
    if ((await expectedWriterToken(w.username, w.password)) === token) return w;
  }
  return null;
}

export const config = {
  matcher: ["/admin/:path*", "/writer/:path*"],
};
