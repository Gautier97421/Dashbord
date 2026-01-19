"use client"

import React, { useEffect, useReducer, ReactNode } from "react"
// import { useSession } from "next-auth/react"
import { AppContext, appReducer, defaultState } from "@/lib/store"
import type { AppAction } from "@/lib/types"

export function AppProvider({ children }: { children: ReactNode }) {
  // const { data: session, status } = useSession()
  // const [isLoading, setIsLoading] = useState(true)
  const [state, dispatch] = useReducer(appReducer, defaultState)

  // Charger les données depuis localStorage au montage
  useEffect(() => {
    const savedState = localStorage.getItem("app-state")
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        dispatch({ type: "LOAD_STATE", payload: parsed })
      } catch (error) {
        console.error("Error loading state:", error)
      }
    }
  }, [])

  // Sauvegarder dans localStorage à chaque changement
  useEffect(() => {
    localStorage.setItem("app-state", JSON.stringify(state))
  }, [state])

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

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}
