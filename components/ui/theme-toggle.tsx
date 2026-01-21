"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import "./theme-toggle.css"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Éviter les problèmes d'hydratation
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const isDark = theme === "dark"

  return (
    <label className="theme-switch">
      <input
        type="checkbox"
        className="checkbox"
        checked={isDark}
        onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
      />
      <div className="container">
        <div className="circle-container">
          <div className="sun-moon-container">
            <div className="moon">
              <div className="spot"></div>
              <div className="spot"></div>
              <div className="spot"></div>
            </div>
          </div>
        </div>
      </div>
    </label>
  )
}
