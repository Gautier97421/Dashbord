// Politique de contenu : tout vient de l'app elle-même. Les images peuvent venir d'ailleurs
// (photo de recette par URL) ; 'unsafe-inline' reste nécessaire aux scripts d'amorçage de Next.js,
// 'unsafe-eval' uniquement en développement (rechargement à chaud).
const isDev = process.env.NODE_ENV !== 'production'
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  // Interdit d'afficher l'app dans un cadre d'un autre site (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // L'appareil photo sert au scan de plats ; le reste est désactivé
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Pris en compte uniquement quand l'app est servie en HTTPS
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // QuickJS sandbox (workflow "Code" node): load it from node_modules instead of bundling it
  // unpdf (lecture des factures PDF) embarque pdf.js : chargé depuis node_modules lui aussi
  serverExternalPackages: ['quickjs-emscripten-core', '@jitl/quickjs-singlefile-cjs-release-sync', 'unpdf'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Fichiers envoyés par les utilisateurs (pièces jointes des projets) : aucun script ne doit
        // pouvoir s'y exécuter. Placée après la règle générale, cette politique la remplace.
        source: '/api/attachments/:id',
        headers: [{ key: 'Content-Security-Policy', value: "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" }],
      },
      {
        // The service worker must never be cached, otherwise updates are not picked up
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
