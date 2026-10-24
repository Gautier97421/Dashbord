"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FolderLock,
  LayoutDashboard,
  Library,
  Loader2,
  Luggage,
  Map as MapIcon,
  MapPin,
  Navigation,
  Pencil,
  Plane,
  Plus,
  Ticket,
  Wallet,
  WifiOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SegmentedTabs } from "@/components/segmented-tabs"
import { useToast } from "@/hooks/use-toast"
import { useLiveRefresh } from "@/lib/live-sync"
import { loadSnapshot, saveSnapshot } from "@/lib/travel/offline"
import { countdown, formatRange, localDay, tripPhase, type Collection, type Trip } from "@/lib/travel/shared"
import { TravelContext, send, type TravelContextValue, type TravelTab } from "./context"
import { OverviewView } from "./overview"
import { SharedWith, TripsView, TripDialog } from "./trips"
import { ItineraryView } from "./itinerary"
import { BookingsView } from "./bookings"
import { BudgetView } from "./budget"
import { PrepView } from "./prep"
import { JournalView } from "./journal"
import { DocumentsView, LibrarySection } from "./documents"
import { TravelMode } from "./travel-mode"
import { PhaseBadge } from "./ui"

const PREFS_KEY = "dashlife:travel:prefs:v2"
const TRIP_TABS: TravelTab[] = ["itinerary", "bookings", "budget", "prep", "documents", "journal"]

// Haut de la page : vue d'ensemble, liste des voyages (dont la page d'un voyage ouvert) et bibliothèque
type Section = "overview" | "trips" | "library"

// Voyage proposé par défaut : en cours, sinon le prochain, sinon le plus récent
function defaultTrip(trips: Trip[], today: string) {
  const active = trips.filter((t) => !t.archived && !t.cancelled)
  return (
    active.find((t) => tripPhase(t, today) === "ongoing") ??
    active.filter((t) => tripPhase(t, today) === "upcoming").sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ??
    [...trips].sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ??
    null
  )
}

function readPrefs(): { section?: Section; tripId?: string | null; tripTab?: TravelTab } {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}")
  } catch {
    return {}
  }
}

/** Page Voyages : vue d'ensemble, voyages, itinéraire et carte, réservations, budget, préparatifs, carnet et mode voyage. */
export function TravelPage() {
  const { toast } = useToast()
  const today = localDay()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loaded, setLoaded] = useState(false)
  const [offlineSince, setOfflineSince] = useState<string | null>(null)
  const [section, setSection] = useState<Section>("overview")
  // Voyage ouvert (page du voyage) et son onglet
  const [tripId, setTripId] = useState<string | null>(null)
  const [tripTab, setTripTab] = useState<TravelTab>("itinerary")
  const [editingTrip, setEditingTrip] = useState(false)
  const [travelMode, setTravelMode] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      try {
        const data = await send<{ trips: Trip[] }>("GET", "/api/trips")
        setTrips(data.trips)
        setOfflineSince(null)
        saveSnapshot(data.trips)
      } catch {
        // Sans réseau : dernière copie enregistrée sur l'appareil
        const snapshot = loadSnapshot()
        if (snapshot) {
          setTrips(snapshot.trips)
          setOfflineSince(snapshot.savedAt)
        } else if (!silent) {
          toast({ title: "Voyages indisponibles", description: "Réessaie dans un instant.", variant: "destructive" })
        }
      } finally {
        setLoaded(true)
      }
    },
    [toast]
  )

  useEffect(() => {
    const prefs = readPrefs()
    if (prefs.section) setSection(prefs.section)
    if (prefs.tripId) setTripId(prefs.tripId)
    if (prefs.tripTab && TRIP_TABS.includes(prefs.tripTab)) setTripTab(prefs.tripTab)
    load()
  }, [load])
  useLiveRefresh(() => load(true))

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ section, tripId, tripTab }))
    } catch {
      // préférence non gardée
    }
  }, [section, tripId, tripTab])

  // Voyage ouvert ; s'il a disparu (supprimé, quitté), retour à la liste
  const openTrip = useMemo(() => (tripId ? trips.find((t) => t.id === tripId) ?? null : null), [trips, tripId])
  const trip = openTrip ?? defaultTrip(trips, today)

  const fail = useCallback(
    (error: unknown) =>
      toast({
        title: offlineSince ? "Hors connexion" : "Action impossible",
        description: offlineSince ? "Les modifications seront possibles au retour du réseau." : error instanceof Error ? error.message : undefined,
        variant: "destructive",
      }),
    [toast, offlineSince]
  )

  const setTrip = useCallback((next: Trip) => {
    setTrips((prev) => {
      const list = prev.some((t) => t.id === next.id) ? prev.map((t) => (t.id === next.id ? next : t)) : [...prev, next]
      saveSnapshot(list)
      return list
    })
  }, [])

  const write = useCallback(
    async (method: string, url: string, body?: unknown) => {
      try {
        const { trip: next } = await send<{ trip: Trip | null }>(method, url, body)
        if (next) setTrip(next)
        return next
      } catch (error) {
        fail(error)
        return null
      }
    },
    [fail, setTrip]
  )

  const ctx: TravelContextValue = {
    trips,
    trip,
    today,
    offlineSince,
    selectTrip: setTripId,
    // Les onglets d'un voyage agissent sur le voyage ouvert
    openTab: (next, id) => {
      if (next === "overview") return setSection("overview")
      setSection("trips")
      if (next === "trips") return setTripId(null)
      if (id) setTripId(id)
      else if (!tripId && trip) setTripId(trip.id)
      setTripTab(next)
    },
    setTrip,
    removeTrip: (id) =>
      setTrips((prev) => {
        const list = prev.filter((t) => t.id !== id)
        saveSnapshot(list)
        return list
      }),
    saveTrip: (id, patch) => write("PUT", "/api/trips", { id, ...patch }),
    addItem: (collection: Collection, fields) => (trip ? write("POST", "/api/trips/items", { tripId: trip.id, collection, ...fields }) : Promise.resolve(null)),
    updateItem: (collection, id, fields) => write("PUT", "/api/trips/items", { collection, id, ...fields }),
    removeItem: (collection, id) => write("DELETE", `/api/trips/items?collection=${collection}&id=${id}`),
    reload: () => load(true),
    fail,
  }

  const ongoing = trips.find((t) => !t.archived && tripPhase(t, today) === "ongoing")
  const modeTrip = trip && tripPhase(trip, today) === "ongoing" ? trip : ongoing

  if (travelMode && modeTrip) {
    return (
      <TravelContext.Provider value={{ ...ctx, trip: modeTrip }}>
        <TravelMode onExit={() => setTravelMode(false)} />
      </TravelContext.Provider>
    )
  }

  const showTrip = section === "trips" && openTrip

  return (
    <TravelContext.Provider value={ctx}>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Voyages</h1>
            <p className="text-sm text-muted-foreground">Préparer, organiser et vivre tes voyages au même endroit</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {modeTrip && (
              <Button variant="outline" size="sm" onClick={() => setTravelMode(true)}>
                <Navigation className="size-4" />
                Mode voyage
              </Button>
            )}
            <Button size="sm" onClick={() => setCreating(true)} disabled={!!offlineSince}>
              <Plus className="size-4" />
              Nouveau voyage
            </Button>
          </div>
        </div>

        {offlineSince && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            <WifiOff className="size-4 shrink-0" />
            <span>
              Hors connexion : données enregistrées le{" "}
              {new Date(offlineSince).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}, en lecture seule.
            </span>
          </div>
        )}

        <SegmentedTabs
          label="Sections des voyages"
          value={section}
          onChange={(next) => {
            setSection(next)
            // « Mes voyages » ramène à la liste
            if (next === "trips" && section === "trips") setTripId(null)
          }}
          tabs={[
            { value: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
            { value: "trips", label: "Mes voyages", icon: Plane },
            { value: "library", label: "Mes documents", icon: Library },
          ]}
        />

        {!loaded ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : !trips.length && section !== "library" ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-14 text-center">
            <Luggage className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Aucun voyage pour l&apos;instant</p>
              <p className="text-sm text-muted-foreground">Crée ton premier voyage : la checklist de départ peut être ajoutée automatiquement.</p>
            </div>
            <Button size="sm" onClick={() => setCreating(true)} disabled={!!offlineSince}>
              <Plus className="size-4" />
              Nouveau voyage
            </Button>
          </div>
        ) : section === "overview" ? (
          <OverviewView
            onTravelMode={(id) => {
              setTripId(id)
              setTravelMode(true)
            }}
          />
        ) : section === "library" ? (
          <LibrarySection trip={null} />
        ) : !showTrip ? (
          <TripsView onCreate={() => setCreating(true)} />
        ) : (
          <div className="space-y-4">
            {/* En-tête du voyage ouvert */}
            <div className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
              <div className="flex flex-wrap items-start gap-2">
                <Button variant="outline" size="sm" onClick={() => setTripId(null)}>
                  <ArrowLeft className="size-4" />
                  Mes voyages
                </Button>
                <div className="ml-auto flex flex-wrap gap-2">
                  {tripPhase(openTrip, today) === "ongoing" && (
                    <Button variant="outline" size="sm" onClick={() => setTravelMode(true)}>
                      <Navigation className="size-4" />
                      Mode voyage
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setEditingTrip(true)} disabled={!!offlineSince}>
                    <Pencil className="size-4" />
                    Réglages du voyage
                  </Button>
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 truncate text-lg font-semibold sm:text-xl">{openTrip.title}</h2>
                  <PhaseBadge phase={tripPhase(openTrip, today)} />
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{openTrip.destination}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    {formatRange(openTrip.startDate, openTrip.endDate)}
                  </span>
                  <span className="font-medium text-foreground">{countdown(openTrip, today)}</span>
                </p>
              </div>
              {openTrip.members.length > 0 && <SharedWith trip={openTrip} />}
            </div>

            <SegmentedTabs
              label="Sections du voyage"
              value={tripTab}
              onChange={setTripTab}
              tabs={[
                { value: "itinerary", label: "Itinéraire", icon: MapIcon },
                { value: "bookings", label: "Réservations", icon: Ticket },
                { value: "budget", label: "Budget", icon: Wallet },
                { value: "prep", label: "Préparatifs", icon: ClipboardCheck },
                { value: "documents", label: "Documents", icon: FolderLock },
                { value: "journal", label: "Carnet", icon: BookOpen },
              ]}
            />

            {tripTab === "itinerary" ? (
              <ItineraryView key={openTrip.id} />
            ) : tripTab === "bookings" ? (
              <BookingsView key={openTrip.id} />
            ) : tripTab === "budget" ? (
              <BudgetView key={openTrip.id} />
            ) : tripTab === "prep" ? (
              <PrepView key={openTrip.id} />
            ) : tripTab === "documents" ? (
              <DocumentsView key={openTrip.id} />
            ) : (
              <JournalView key={openTrip.id} />
            )}

            {editingTrip && <TripDialog trip={openTrip} onClose={() => setEditingTrip(false)} onSaved={() => setEditingTrip(false)} />}
          </div>
        )}

        {creating && (
          <TripDialog
            trip={null}
            onClose={() => setCreating(false)}
            onSaved={(created) => {
              setTrip(created)
              // Le nouveau voyage s'ouvre directement sur son itinéraire
              setTripId(created.id)
              setTripTab("itinerary")
              setSection("trips")
              setCreating(false)
            }}
          />
        )}
      </div>
    </TravelContext.Provider>
  )
}
