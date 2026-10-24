import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// Next 16 : « proxy » remplace l'ancien « middleware » (même rôle : redirection vers /login sans session)
export async function proxy(request: NextRequest) {
  // Get the pathname of the request (e.g. /, /login)
  const path = request.nextUrl.pathname

  // Define public paths that don't require authentication
  const isPublicPath = path === "/login" || path === "/register"

  // Session vérifiée (signature et expiration), pas seulement la présence du cookie : un cookie
  // devenu invalide (NEXTAUTH_SECRET changé, session expirée) renverrait sinon /login vers / en boucle
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  // Redirect to login if accessing a private route without a valid session
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Redirect to home if accessing login/register with a valid session
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
     * - PWA files (manifest, service worker, offline page) and static images
     * - Lottie animations of public/ (.json), also shown on the login page
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|offline.html|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|json)$).*)",
  ],
}
