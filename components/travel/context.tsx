"use client"

import { createContext, useContext } from "react"
import type { Collection, Trip } from "@/lib/travel/shared"

export async function send<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Erreur")
  return data as T
}

export interface TravelContextValue {
  trips: Trip[]
  // Voyage affiché dans les onglets Itinéraire, Réservations, Budget, Préparatifs et Carnet
  trip: Trip | null
  today: string
  // Date de la copie affichée quand le réseau manque (lecture seule)
  offlineSince: string | null
  selectTrip: (id: string) => void
  openTab: (tab: TravelTab, tripId?: string) => void
  setTrip: (trip: Trip) => void
  removeTrip: (id: string) => void
  // Écritures : renvoient le voyage à jour, ou null après avoir affiché l'erreur
  saveTrip: (id: string, patch: Record<string, unknown>) => Promise<Trip | null>
  addItem: (collection: Collection, fields: Record<string, unknown>) => Promise<Trip | null>
  updateItem: (collection: Collection, id: string, fields: Record<string, unknown>) => Promise<Trip | null>
  removeItem: (collection: Collection, id: string) => Promise<Trip | null>
  reload: () => void
  fail: (error: unknown) => void
}

export type TravelTab = "overview" | "trips" | "itinerary" | "bookings" | "budget" | "prep" | "documents" | "journal"

export const TravelContext = createContext<TravelContextValue | null>(null)

export function useTravel() {
  const ctx = useContext(TravelContext)
  if (!ctx) throw new Error("useTravel hors de TravelPage")
  return ctx
}

/** Le voyage sélectionné (les onglets qui en dépendent ne s'affichent qu'avec un voyage). */
export function useTrip(): Trip {
  const { trip } = useTravel()
  if (!trip) throw new Error("Aucun voyage sélectionné")
  return trip
}
