"use client"

import React, { useEffect, useReducer, ReactNode } from "react"
import { AppContext, appReducer, defaultState, loadState, saveState } from "@/lib/store"
import type { AppState } from "@/lib/types"

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, defaultState, () => {
    const loaded = loadState()
    return loaded || defaultState
  })

  // Apply theme effect
  useEffect(() => {
    const theme = state.settings.theme
    const root = document.documentElement

    if (theme === "dark") {
      root.classList.add("dark")
    } else if (theme === "light") {
      root.classList.remove("dark")
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      if (prefersDark) {
        root.classList.add("dark")
      } else {
        root.classList.remove("dark")
      }
    }
  }, [state.settings.theme])

  // Save state to localStorage on changes
  useEffect(() => {
    saveState(state)
  }, [state])

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}
