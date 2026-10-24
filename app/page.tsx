"use client"

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import { AppProviderWrapper as AppProvider } from "@/components/app-provider"
import { AppSidebar, type NavPage, type PageKey } from "@/components/app-sidebar"
import { CustomPagesProvider, useCustomPages } from "@/lib/custom-pages-context"
import { NavPrefsProvider, useNavPrefs } from "@/lib/nav-prefs"
import { BUILTIN_KEYS } from "@/lib/nav-items"
import { FeaturesProvider, useFeatures } from "@/lib/features-context"

const LAST_PAGE_KEY = "dashlife:lastPage"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { OnboardingTutorial } from "@/components/onboarding-tutorial"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { NotificationsBell } from "@/components/notifications-bell"
import { SocialButton } from "@/components/social-button"
import { ConfirmProvider } from "@/components/confirm-provider"
import { onProjectsTarget } from "@/lib/projects/nav"
import { DashboardPage } from "@/components/pages/dashboard-page"

// Chaque page n'est téléchargée qu'à sa première ouverture (éditeurs, graphiques, carte… pèsent lourd) ;
// le tableau de bord, page d'accueil, reste dans le premier chargement
function PageLoading() {
  return (
    <div className="flex justify-center py-16 text-muted-foreground" role="status" aria-label="Chargement de la page">
      <Loader2 className="size-6 animate-spin" />
    </div>
  )
}
const lazyPage = <P,>(load: () => Promise<React.ComponentType<P>>) => dynamic(load, { loading: PageLoading })

const CustomPageView = lazyPage(() => import("@/components/pages/custom-page-view").then((m) => m.CustomPageView))
const ValidationPage = lazyPage(() => import("@/components/pages/validation-page").then((m) => m.ValidationPage))
const CalendarPage = lazyPage(() => import("@/components/pages/calendar-page").then((m) => m.CalendarPage))
const RoutinesPage = lazyPage(() => import("@/components/pages/routines-page").then((m) => m.RoutinesPage))
const MissionsPage = lazyPage(() => import("@/components/pages/missions-page").then((m) => m.MissionsPage))
const ProjectsPage = lazyPage(() => import("@/components/pages/projects-page").then((m) => m.ProjectsPage))
const SportPage = lazyPage(() => import("@/components/pages/sport-page").then((m) => m.SportPage))
const NutritionPage = lazyPage(() => import("@/components/pages/nutrition-page").then((m) => m.NutritionPage))
const SleepPage = lazyPage(() => import("@/components/pages/sleep-page").then((m) => m.SleepPage))
const StatisticsPage = lazyPage(() => import("@/components/pages/statistics-page").then((m) => m.StatisticsPage))
const SettingsPage = lazyPage(() => import("@/components/pages/settings-page").then((m) => m.SettingsPage))
const NotesPage = lazyPage(() => import("@/components/pages/notes-page").then((m) => m.NotesPage))
const CuisinePage = lazyPage(() => import("@/components/pages/cuisine-page").then((m) => m.CuisinePage))
const AIAgentPage = lazyPage(() => import("@/components/pages/ai-agent-page").then((m) => m.default))
const ApplicationsPage = lazyPage(() => import("@/components/pages/applications-page").then((m) => m.ApplicationsPage))
const BudgetPage = lazyPage(() => import("@/components/pages/budget-page").then((m) => m.BudgetPage))
const WishlistPage = lazyPage(() => import("@/components/pages/wishlist-page").then((m) => m.WishlistPage))
const TravelPage = lazyPage(() => import("@/components/travel/travel-page").then((m) => m.TravelPage))

function DashboardLayout() {
  const [currentPage, setCurrentPageState] = useState<PageKey>("dashboard")
  const [showOnboarding, setShowOnboarding] = useState(false)
  const { pages: customPages } = useCustomPages()
  const { loaded: featuresLoaded, canNav } = useFeatures()
  const { isHidden } = useNavPrefs()
  // Le tutoriel saute les pages masquées du menu ("routine-morning" / "routine-night" = entrée "Routine")
  const tourCanNav = useCallback(
    (page: string) => canNav(page) && !isHidden(page.startsWith("routine-") ? "routine" : page),
    [canNav, isHidden]
  )

  // Persist the active page so a reload returns to it
  const setCurrentPage: typeof setCurrentPageState = (value) => {
    setCurrentPageState((prev) => {
      const next = typeof value === "function" ? (value as (p: PageKey) => PageKey)(prev) : value
      try { localStorage.setItem(LAST_PAGE_KEY, next) } catch { /* ignore */ }
      return next
    })
  }

  // Restore last page on mount (after hydration to avoid mismatch). Un raccourci de l'app installée
  // ("?page=nutrition") est prioritaire ; seules les pages intégrées connues sont acceptées.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const requested = params.get("page")
      if (requested && (BUILTIN_KEYS.includes(requested) || ["routine-morning", "routine-night", "settings"].includes(requested))) {
        setCurrentPage(requested)
        params.delete("page")
        const query = params.toString()
        window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
        return
      }
      const saved = localStorage.getItem(LAST_PAGE_KEY)
      if (saved) setCurrentPageState(saved)
    } catch { /* ignore */ }
  }, [])
  // Key passed to AIAgentPage to force re-mount when a service connects
  const [agentKey, setAgentKey] = useState(0)

  // Ouverture d'une tâche / d'un projet demandée ailleurs (ajout rapide, notification, calendrier)
  useEffect(() => onProjectsTarget(() => setCurrentPage("projects")), [])

  useEffect(() => {
    fetch('/api/user/onboarding')
      .then(res => res.json())
      .then(data => { if (!data.hasCompletedOnboarding) setShowOnboarding(true) })
      .catch(() => {})
  }, [])

  // "Revoir le tutoriel" button in Settings
  useEffect(() => {
    const start = () => setShowOnboarding(true)
    window.addEventListener("dashlife:start-tour", start)
    return () => window.removeEventListener("dashlife:start-tour", start)
  }, [])

  // If the active custom page is deleted, fall back to the dashboard
  useEffect(() => {
    if (typeof currentPage === "string" && currentPage.startsWith("custom:")) {
      const id = currentPage.slice("custom:".length)
      if (customPages.length > 0 && !customPages.some((p) => p.id === id)) {
        setCurrentPage("dashboard")
      }
    }
  }, [customPages, currentPage])

  // Page d'une fonctionnalité désactivée par l'admin : retour au tableau de bord
  useEffect(() => {
    if (featuresLoaded && !canNav(currentPage)) setCurrentPage("dashboard")
  }, [featuresLoaded, canNav, currentPage])

  // Detect OAuth redirects coming back to the app (gmail_connected, spotify_connected, etc.)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)

    const connected = ['gmail', 'outlook', 'spotify', 'youtube', 'linkedin', 'github', 'notion', 'discord', 'trello'].find(s => params.get(`${s}_connected`) === 'true')
    const error = params.get('service_error')

    if (connected || error) {
      // Clean URL without navigation
      window.history.replaceState({}, '', '/')
    }

    if (connected) {
      // Connections now live in Settings — land there after OAuth
      setCurrentPage('settings')
      setAgentKey(k => k + 1)
    }
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
    if (!canNav(currentPage)) return null
    if (typeof currentPage === "string" && currentPage.startsWith("custom:")) {
      return <CustomPageView pageId={currentPage.slice("custom:".length)} />
    }
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage onNavigate={setCurrentPage} />
      case "calendar":
        return <CalendarPage />
      // Une seule entrée "Routine" dans le menu ; "routine-night" ouvre directement l'onglet du soir
      case "routine":
        return <RoutinesPage key="routine" />
      case "routine-morning":
        return <RoutinesPage key="routine-morning" initial="morning" />
      case "routine-night":
        return <RoutinesPage key="routine-night" initial="night" />
      case "missions":
        return <MissionsPage />
      case "projects":
        return <ProjectsPage />
      case "sport":
        return <SportPage />
      case "nutrition":
        return <NutritionPage />
      case "sleep":
        return <SleepPage />
      case "statistics":
        return <StatisticsPage />
      case "notes":
        return <NotesPage />
      case "cuisine":
        return <CuisinePage />
      case "ai-agent":
        return <AIAgentPage key={agentKey} />
      case "validation":
        return <ValidationPage />
      case "applications":
        return <ApplicationsPage />
      case "budget":
        return <BudgetPage key="budget" />
      // Ancienne page (liens des notifications, tutoriel) : ouvre Budgets sur l'onglet Abonnements
      case "subscriptions":
        return <BudgetPage key="subscriptions" initialTab="subscriptions" />
      case "wishlist":
        return <WishlistPage />
      case "travel":
        return <TravelPage />
      case "settings":
        return <SettingsPage onNavigate={setCurrentPage} />
      default:
        return <DashboardPage onNavigate={setCurrentPage} />
    }
  }

  const getPageTitle = () => {
    if (typeof currentPage === "string" && currentPage.startsWith("custom:")) {
      const id = currentPage.slice("custom:".length)
      return customPages.find((p) => p.id === id)?.name || "Ma page"
    }
    const titles: Record<NavPage, string> = {
      dashboard: "Tableau de bord",
      calendar: "Calendrier",
      routine: "Routine",
      "routine-morning": "Routine",
      "routine-night": "Routine",
      missions: "Objectif",
      projects: "Projets",
      sport: "Sport",
      nutrition: "Nutrition",
      sleep: "Sommeil",
      statistics: "Statistiques",
      notes: "Bloc-notes",
      cuisine: "Cuisine",
      "ai-agent": "Agent IA",
      validation: "À valider",
      applications: "Suivi de demande",
      subscriptions: "Budgets",
      budget: "Budgets",
      wishlist: "Wishlist",
      travel: "Voyages",
      settings: "Paramètres",
    }
    return titles[currentPage as NavPage]
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <OnboardingTutorial
        open={showOnboarding}
        onComplete={handleCompleteOnboarding}
        onNavigate={setCurrentPage}
        canNav={tourCanNav}
      />
      <AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <SidebarInset>
        <header className="flex h-12 sm:h-14 shrink-0 items-center gap-2 border-b px-2 sm:px-4">
          <SidebarTrigger className="-ml-1" data-tour="sidebar-trigger" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="font-semibold text-sm sm:text-base truncate">{getPageTitle()}</h1>
          <div className="ml-auto flex items-center gap-1">
            <span data-tour="social" className="inline-flex">
              <SocialButton />
            </span>
            <span data-tour="notifications" className="inline-flex">
              <NotificationsBell onNavigate={setCurrentPage} />
            </span>
            <span data-tour="theme-toggle" className="inline-flex">
              <ThemeToggle />
            </span>
          </div>
        </header>
        {/* Conteneur CSS : les pages s'adaptent à la largeur réelle du contenu (menu latéral ouvert ou non) */}
        <main className="@container/main flex-1 overflow-auto p-2 sm:p-4 md:p-6">
          {renderPage()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function Page() {
  return (
    <AppProvider>
      <CustomPagesProvider>
        <FeaturesProvider>
          <NavPrefsProvider>
            <ConfirmProvider>
              <DashboardLayout />
            </ConfirmProvider>
          </NavPrefsProvider>
        </FeaturesProvider>
      </CustomPagesProvider>
    </AppProvider>
  )
}
