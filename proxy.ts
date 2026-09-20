import { NextResponse, type NextRequest } from "next/server";
import { getAccountFromRequest } from "@/lib/appwrite/server";

export async function proxy(request: NextRequest) {
  const user = await getAccountFromRequest(request);
  const path = request.nextUrl.pathname;
  const protectedRoute = path.startsWith("/dashboard") || path.startsWith("/app");
  const authRoute = path.startsWith("/login") || path.startsWith("/signup");

  if (protectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (authRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
