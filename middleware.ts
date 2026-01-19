import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Get the pathname of the request (e.g. /, /login)
  const path = request.nextUrl.pathname

  // Define public paths that don't require authentication
  const isPublicPath = path === "/login" || path === "/register"

  // Get the token from the cookies
  const token = request.cookies.get("next-auth.session-token") || request.cookies.get("__Secure-next-auth.session-token")

  // Redirect to login if accessing a private route without a token
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Redirect to home if accessing login/register with a token
  if (isPublicPath && token) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icon files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon).*)",
  ],
}
