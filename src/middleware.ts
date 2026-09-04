import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, expectedSessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/admin/login", "/api/generate"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  const expected = await expectedSessionToken();

  if (cookie !== expected) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|logo\\.png|icon\\.png).*)",
  ],
};
