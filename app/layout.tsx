import React from "react"
import type { Metadata, Viewport } from 'next'
import { AuthProvider } from "@/components/auth-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { PwaRegister } from "@/components/pwa-register"
import { Toaster } from "@/components/ui/toaster"
import { Patrick_Hand } from 'next/font/google'
import './globals.css'

const patrickHand = Patrick_Hand({ 
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-patrick-hand',
})

export const metadata: Metadata = {
  title: 'DashLife - Dashboard de productivité personnelle',
  description: 'Organisez vos journée, suivez vos habitudes et atteignez vos objectifs.',
  applicationName: 'DashLife',
  appleWebApp: {
    capable: true,
    title: 'DashLife',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon/favicon.ico', sizes: 'any' },
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/favicon/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f1e5' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0e11' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${patrickHand.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
        >
          <AuthProvider>
            {children}
          </AuthProvider>
          {/* Messages des pages (erreurs, confirmations, « Annuler ») */}
          <Toaster />
        </ThemeProvider>
        <PwaRegister />
      </body>
    </html>
  )
}
