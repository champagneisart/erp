import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST ?? "";
const ARTIST_HOST = process.env.NEXT_PUBLIC_ARTIST_HOST ?? "";
const STATUS_HOST = process.env.NEXT_PUBLIC_STATUS_HOST ?? "";

function getHostType(host: string): "app" | "artist" | "status" | "local" {
  const h = host.split(":")[0].toLowerCase();
  if (ARTIST_HOST && h === ARTIST_HOST.split(":")[0]) return "artist";
  if (STATUS_HOST && h === STATUS_HOST.split(":")[0]) return "status";
  if (APP_HOST && h === APP_HOST.split(":")[0]) return "app";
  if (h.startsWith("artist.")) return "artist";
  if (h.startsWith("status.")) return "status";
  if (h.startsWith("app.")) return "app";
  return "local";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "localhost";
  const hostType = getHostType(host);

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (hostType === "status") {
    if (!pathname.startsWith("/portal")) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.startsWith("/portal")
        ? pathname
        : `/portal${pathname === "/" ? "" : pathname}`;
      if (pathname === "/" || !pathname.startsWith("/portal")) {
        return NextResponse.rewrite(
          new URL(`/portal${pathname === "/" ? "" : pathname}`, request.url)
        );
      }
    }
    return NextResponse.next();
  }

  if (hostType === "artist") {
    if (!pathname.startsWith("/artist") && !pathname.startsWith("/login")) {
      return NextResponse.rewrite(new URL(`/artist${pathname}`, request.url));
    }
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });
  const session = token
    ? {
        user: {
          role: token.role as "admin" | "staff" | "artist",
        },
      }
    : null;
  const isLogin = pathname === "/login";
  const isPublicPortal = pathname.startsWith("/portal");

  if (isPublicPortal && hostType !== "app") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/artist")) {
    if (!session && !isLogin) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session?.user?.role !== "artist" && session?.user?.role !== "admin") {
      if (!isLogin) return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (isPublicPortal) return NextResponse.next();

  const staffRoutes = [
    "/",
    "/customers",
    "/leads",
    "/orders",
    "/inventory",
    "/planning",
    "/inbox",
    "/ai-studio",
    "/agent-chat",
    "/knowledge",
    "/settings",
    "/tasks",
  ];

  const isStaffRoute =
    staffRoutes.some(
      (r) => pathname === r || pathname.startsWith(`${r}/`)
    ) || pathname.startsWith("/dashboard");

  if (isStaffRoute || pathname === "/") {
    if (!session && !isLogin) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session?.user?.role === "artist" && !pathname.startsWith("/artist")) {
      return NextResponse.redirect(new URL("/artist", request.url));
    }
    if (
      session &&
      !isLogin &&
      session.user.role !== "admin" &&
      session.user.role !== "staff" &&
      pathname !== "/artist"
    ) {
      return NextResponse.redirect(new URL("/artist", request.url));
    }
  }

  if (session && isLogin) {
    const dest =
      session.user.role === "artist" ? "/artist" : "/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
