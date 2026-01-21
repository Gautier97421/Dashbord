"use client"

import { useState, useEffect } from "react"
import { AppProviderWrapper as AppProvider } from "@/components/app-provider"
import { AppSidebar, type NavPage } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { OnboardingTutorial } from "@/components/onboarding-tutorial"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { DashboardPage } from "@/components/pages/dashboard-page"
import { CalendarPage } from "@/components/pages/calendar-page"
import { RoutinePage } from "@/components/pages/routine-page"
import { RoutineNightPage } from "@/components/pages/routine-night-page"
import { MissionsPage } from "@/components/pages/missions-page"
import { ProjectsPage } from "@/components/pages/projects-page"
import { SportPage } from "@/components/pages/sport-page"
import { SleepPage } from "@/components/pages/sleep-page"
import { StatisticsPage } from "@/components/pages/statistics-page"
import { SettingsPage } from "@/components/pages/settings-page"

function DashboardLayout() {
  const [currentPage, setCurrentPage] = useState<NavPage>("dashboard")
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    // Check if user has completed onboarding
    fetch('/api/user/onboarding')
      .then(res => res.json())
      .then(data => {
        if (!data.hasCompletedOnboarding) {
          setShowOnboarding(true)
        }
      })
      .catch(err => console.error('Failed to check onboarding status:', err))
  }, [])

  const handleCompleteOnboarding = async () => {
    try {
      await fetch('/api/user/onboarding', { method: 'POST' })
      setShowOnboarding(false)
    } catch (err) {
      console.error('Failed to complete onboarding:', err)
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage onNavigate={setCurrentPage} />
      case "calendar":
        return <CalendarPage />
      case "routine":
        return <RoutinePage />
      case "routine-night":
        return <RoutineNightPage />
      case "missions":
        return <MissionsPage />
      case "projects":
        return <ProjectsPage />
      case "sport":
        return <SportPage />
      case "sleep":
        return <SleepPage />
      case "statistics":
        return <StatisticsPage />
      case "settings":
        return <SettingsPage />
      default:
        return <DashboardPage onNavigate={setCurrentPage} />
    }
  }

  const getPageTitle = () => {
    const titles: Record<NavPage, string> = {
      dashboard: "Tableau de bord",
      calendar: "Calendrier",
      routine: "Routine matinale",
      "routine-night": "Routine du soir",
      missions: "Missions",
      projects: "Projets",
      sport: "Sport & Nutrition",
      sleep: "Sommeil",
      statistics: "Statistiques",
      settings: "Paramètres",
    }
    return titles[currentPage]
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <OnboardingTutorial open={showOnboarding} onComplete={handleCompleteOnboarding} />
      <AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <SidebarInset>
        <header className="flex h-12 sm:h-14 shrink-0 items-center gap-2 border-b px-2 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="font-semibold text-sm sm:text-base truncate">{getPageTitle()}</h1>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-2 sm:p-4 md:p-6">
          {renderPage()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function Page() {
  return (
    <AppProvider>
      <DashboardLayout />
    </AppProvider>
  )
}
