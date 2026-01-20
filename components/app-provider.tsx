"use client"

import React from "react"
import { AppProvider } from "@/lib/store-api"

export function AppProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div style={{ fontFamily: 'cursive' }} className="min-h-screen">
        {children}
      </div>
    </AppProvider>
  )
}
