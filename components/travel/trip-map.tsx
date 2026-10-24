"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useRef, useState } from "react"
import type { LayerGroup, Map as LeafletMap, TileLayer } from "leaflet"
import {
  Banknote,
  BedDouble,
  Fuel,
  Landmark,
  Layers,
  Loader2,
  MapPinPlus,
  Maximize2,
  Minimize2,
  ParkingSquare,
  Pill,
  Search,
  ShoppingCart,
  TrainFront,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { TripStop } from "@/lib/travel/shared"
import { send } from "./context"

export interface MapPoint {
  id: string
  lat: number
  lng: number
  label: string
  color: string
  // Numéro affiché dans le repère (ordre de la journée)
  badge?: string
  faded?: boolean
}

/** Point choisi sur la carte (clic, recherche ou lieu utile) à enregistrer dans le voyage. */
export interface PickedPoint {
  lat: number
  lng: number
  name?: string | null
  address?: string | null
  kind?: string
  url?: string | null
}

export const KIND_COLORS: Record<string, string> = {
  lodging: "#8b5cf6",
  restaurant: "#f97316",
  visit: "#0ea5e9",
  activity: "#10b981",
  station: "#64748b",
  airport: "#475569",
  parking: "#a3a3a3",
  other: "#ec4899",
}

// Fonds de carte : plan détaillé (commerces, stations… visibles en zoomant), plan clair, satellite
const BASE_LAYERS = [
  { id: "osm", label: "Plan détaillé", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' },
  {
    id: "light",
    label: "Plan clair",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
  },
  {
    id: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution: "Imagerie &copy; Esri, Maxar, Earthstar Geographics",
  },
] as const

// Lieux utiles affichables autour de la zone (API /api/trips/poi)
const POI_KINDS: { id: string; label: string; icon: LucideIcon; color: string; placeKind: string }[] = [
  { id: "supermarket", label: "Courses", icon: ShoppingCart, color: "#16a34a", placeKind: "other" },
  { id: "food", label: "Restaurants", icon: UtensilsCrossed, color: "#f97316", placeKind: "restaurant" },
  { id: "fuel", label: "Stations", icon: Fuel, color: "#dc2626", placeKind: "other" },
  { id: "transport", label: "Transports", icon: TrainFront, color: "#475569", placeKind: "station" },
  { id: "parking", label: "Parkings", icon: ParkingSquare, color: "#2563eb", placeKind: "parking" },
  { id: "pharmacy", label: "Santé", icon: Pill, color: "#0d9488", placeKind: "other" },
  { id: "atm", label: "Argent", icon: Banknote, color: "#ca8a04", placeKind: "other" },
  { id: "sights", label: "À voir", icon: Landmark, color: "#0ea5e9", placeKind: "visit" },
  { id: "lodging", label: "Hébergements", icon: BedDouble, color: "#8b5cf6", placeKind: "lodging" },
]

interface Poi {
  id: string
  lat: number
  lng: number
  name: string | null
  type: string | null
  address: string | null
  hours: string | null
  website: string | null
  phone: string | null
}

// Repère rond ; `label` doit être déjà échappé
const pin = (color: string, size: number, label = "", opacity = 1) =>
  `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:#fff;font:600 11px/1 system-ui,sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);opacity:${opacity}">${label}</span>`
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)

/** Fenêtre d'information d'un point, construite sans HTML injecté (les textes viennent d'OpenStreetMap). */
function popupContent(lines: { text: string; bold?: boolean; muted?: boolean; href?: string }[], action?: { label: string; onClick: () => void }) {
  const root = document.createElement("div")
  root.style.minWidth = "180px"
  for (const line of lines) {
    const el = document.createElement(line.href ? "a" : "div")
    el.textContent = line.text
    if (line.bold) el.style.fontWeight = "600"
    if (line.muted) el.style.color = "#6b7280"
    el.style.fontSize = "12px"
    if (line.href && el instanceof HTMLAnchorElement) {
      el.href = line.href
      el.target = "_blank"
      el.rel = "noopener noreferrer"
      el.style.display = "block"
    }
    root.appendChild(el)
  }
  if (action) {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.textContent = action.label
    btn.style.cssText = "margin-top:6px;width:100%;padding:4px 8px;border-radius:6px;background:#111827;color:#fff;font-size:12px;font-weight:600;cursor:pointer"
    btn.addEventListener("click", action.onClick)
    root.appendChild(btn)
  }
  return root
}

/**
 * Carte du voyage (Leaflet + OpenStreetMap) : lieux enregistrés, destinations reliées (road trip),
 * recherche d'adresse, lieux utiles autour (courses, stations…), ajout d'un point par clic, plein écran.
 */
export function TripMap({
  points,
  stops = [],
  route = false,
  selectedId,
  onSelect,
  onAddPoint,
  className,
}: {
  points: MapPoint[]
  stops?: TripStop[]
  route?: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
  onAddPoint?: (point: PickedPoint) => void
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<LayerGroup | null>(null)
  const poiLayerRef = useRef<LayerGroup | null>(null)
  const searchLayerRef = useRef<LayerGroup | null>(null)
  const baseRef = useRef<TileLayer | null>(null)
  const leafletRef = useRef<typeof import("leaflet") | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onAddRef = useRef(onAddPoint)
  onAddRef.current = onAddPoint
  const fittedRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [full, setFull] = useState(false)
  const [base, setBase] = useState<(typeof BASE_LAYERS)[number]["id"]>("osm")
  const [layersOpen, setLayersOpen] = useState(false)
  const [addMode, setAddMode] = useState(false)
  const addModeRef = useRef(addMode)
  addModeRef.current = addMode
  const [poiKind, setPoiKind] = useState<string | null>(null)
  const [poiState, setPoiState] = useState<{ loading: boolean; message: string | null }>({ loading: false, message: null })
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{ name: string; lat: number; lng: number }[]>([])
  const [searching, setSearching] = useState(false)

  // Création de la carte
  useEffect(() => {
    let disposed = false
    let observer: ResizeObserver | null = null
    import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? mod
      if (disposed || !containerRef.current) return
      leafletRef.current = L
      const map = L.map(containerRef.current, { zoomControl: false, scrollWheelZoom: true, worldCopyJump: true })
      L.control.zoom({ position: "bottomright" }).addTo(map)
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map)
      map.setView([46.6, 2.4], 5)
      searchLayerRef.current = L.layerGroup().addTo(map)
      poiLayerRef.current = L.layerGroup().addTo(map)
      layerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      // Mode « ajouter un point » : un clic choisit l'emplacement
      map.on("click", (e) => {
        if (!addModeRef.current) return
        setAddMode(false)
        onAddRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng })
      })
      observer = new ResizeObserver(() => map.invalidateSize())
      observer.observe(containerRef.current)
      setReady(true)
    })
    return () => {
      disposed = true
      observer?.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Fond de carte
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!ready || !L || !map) return
    baseRef.current?.remove()
    const def = BASE_LAYERS.find((b) => b.id === base) ?? BASE_LAYERS[0]
    baseRef.current = L.tileLayer(def.url, { maxZoom: def.maxZoom, attribution: def.attribution, subdomains: "abcd" }).addTo(map)
    baseRef.current.bringToBack()
  }, [ready, base])

  // Curseur en croix en mode ajout
  useEffect(() => {
    if (containerRef.current) containerRef.current.style.cursor = addMode ? "crosshair" : ""
  }, [addMode])

  // Lieux enregistrés et destinations
  const signature = JSON.stringify([points.map((p) => [p.id, p.lat, p.lng, p.color, p.badge, p.faded, p.label]), stops.map((s) => [s.id, s.lat, s.lng, s.name]), route])
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const layer = layerRef.current
    if (!ready || !L || !map || !layer) return
    layer.clearLayers()

    // Destinations : grands repères numérotés, reliés dans l'ordre (road trip)
    if (stops.length > 1) {
      L.polyline(stops.map((s) => [s.lat, s.lng] as [number, number]), { color: "#6366f1", weight: 3, opacity: 0.6, dashArray: "2 8", lineCap: "round" }).addTo(layer)
    }
    stops.forEach((s, i) => {
      L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "", html: pin("#6366f1", 30, stops.length > 1 ? String(i + 1) : "★"), iconSize: [30, 30], iconAnchor: [15, 15] }), zIndexOffset: -100, title: s.name })
        .bindTooltip(escapeHtml(s.name), { direction: "top", offset: [0, -15] })
        .addTo(layer)
    })

    for (const p of points) {
      const size = p.badge ? 26 : 18
      L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: pin(p.color, size, p.badge ? escapeHtml(p.badge) : "", p.faded ? 0.45 : 1), iconSize: [size, size], iconAnchor: [size / 2, size / 2] }), keyboard: true, title: p.label })
        .on("click", () => onSelectRef.current?.(p.id))
        .bindTooltip(escapeHtml(p.label), { direction: "top", offset: [0, -size / 2] })
        .addTo(layer)
    }
    if (route && points.length > 1) {
      L.polyline(points.map((p) => [p.lat, p.lng] as [number, number]), { color: "#0ea5e9", weight: 3, opacity: 0.7, dashArray: "6 6" }).addTo(layer)
    }

    // Cadrage : sur les lieux affichés, sinon sur les destinations du voyage
    const target = points.length ? points : stops
    if (target.length === 1) map.setView([target[0].lat, target[0].lng], points.length ? 14 : 11)
    else if (target.length > 1) map.fitBounds(L.latLngBounds(target.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 })
    fittedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signature])

  // Lieu choisi dans la liste : la carte s'y centre
  useEffect(() => {
    const p = points.find((x) => x.id === selectedId)
    if (ready && p && mapRef.current) mapRef.current.setView([p.lat, p.lng], Math.max(mapRef.current.getZoom(), 15))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready])

  // Lieux utiles : rechargés quand la carte bouge
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const layer = poiLayerRef.current
    if (!ready || !L || !map || !layer) return
    layer.clearLayers()
    setPoiState({ loading: false, message: null })
    if (!poiKind) return
    const def = POI_KINDS.find((k) => k.id === poiKind)
    if (!def) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const load = async () => {
      if (map.getZoom() < 12) {
        layer.clearLayers()
        setPoiState({ loading: false, message: "Zoome sur la carte pour afficher ces lieux" })
        return
      }
      const b = map.getBounds()
      setPoiState({ loading: true, message: null })
      try {
        const q = new URLSearchParams({ kind: def.id, south: String(b.getSouth()), west: String(b.getWest()), north: String(b.getNorth()), east: String(b.getEast()) })
        const { results: list } = await send<{ results: Poi[] }>("GET", `/api/trips/poi?${q}`)
        if (cancelled) return
        layer.clearLayers()
        for (const p of list) {
          const title = p.name || def.label
          const marker = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: pin(def.color, 14, "", 0.9), iconSize: [14, 14], iconAnchor: [7, 7] }), title })
          marker.bindPopup(() =>
            popupContent(
              [
                { text: title, bold: true },
                ...(p.type ? [{ text: p.type.replace(/_/g, " "), muted: true }] : []),
                ...(p.address ? [{ text: p.address }] : []),
                ...(p.hours ? [{ text: `Horaires : ${p.hours}`, muted: true }] : []),
                ...(p.phone ? [{ text: p.phone, href: `tel:${p.phone.replace(/\s/g, "")}` }] : []),
                ...(p.website && /^https?:\/\//.test(p.website) ? [{ text: "Site web", href: p.website }] : []),
              ],
              onAddRef.current
                ? {
                    label: "Ajouter au voyage",
                    onClick: () => {
                      map.closePopup()
                      onAddRef.current?.({ lat: p.lat, lng: p.lng, name: p.name, address: p.address, kind: def.placeKind, url: p.website && /^https?:\/\//.test(p.website) ? p.website : null })
                    },
                  }
                : undefined
            )
          )
          marker.addTo(layer)
        }
        setPoiState({ loading: false, message: list.length ? null : "Aucun lieu de ce type dans la zone" })
      } catch (e) {
        if (!cancelled) setPoiState({ loading: false, message: e instanceof Error ? e.message : "Indisponible" })
      }
    }
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(load, 500)
    }
    load()
    map.on("moveend", schedule)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      map.off("moveend", schedule)
    }
  }, [ready, poiKind])

  const search = async () => {
    if (query.trim().length < 3) return
    setSearching(true)
    try {
      const data = await send<{ results: { name: string; lat: number; lng: number }[] }>("GET", `/api/trips/geocode?q=${encodeURIComponent(query.trim())}`)
      setResults(data.results)
      if (data.results.length === 1) showResult(data.results[0])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const showResult = (r: { name: string; lat: number; lng: number }) => {
    const L = leafletRef.current
    const map = mapRef.current
    const layer = searchLayerRef.current
    if (!L || !map || !layer) return
    setResults([])
    layer.clearLayers()
    const marker = L.marker([r.lat, r.lng], { icon: L.divIcon({ className: "", html: pin("#111827", 22, "?"), iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(layer)
    marker
      .bindPopup(
        popupContent(
          [{ text: r.name.split(",")[0], bold: true }, { text: r.name, muted: true }],
          onAddRef.current
            ? {
                label: "Ajouter au voyage",
                onClick: () => {
                  map.closePopup()
                  layer.clearLayers()
                  onAddRef.current?.({ lat: r.lat, lng: r.lng, name: r.name.split(",")[0], address: r.name })
                },
              }
            : undefined
        )
      )
      .openPopup()
    map.setView([r.lat, r.lng], Math.max(map.getZoom(), 15))
  }

  return (
    <div className={cn(full ? "fixed inset-0 z-50 bg-background p-2 sm:p-4" : "relative", !full && className)}>
      <div className={cn("relative isolate overflow-hidden rounded-xl border bg-muted", full ? "h-full" : "h-[60vh] min-h-80 @5xl/main:h-[calc(100vh-14rem)]")}>
        <div ref={containerRef} className="absolute inset-0 z-0" />

        {/* Recherche et outils */}
        <div className="pointer-events-none absolute inset-x-2 top-2 z-[500] flex flex-wrap items-start gap-2">
          <form
            className="pointer-events-auto relative min-w-0 flex-1 basis-56"
            onSubmit={(e) => {
              e.preventDefault()
              search()
            }}
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un lieu, une adresse…" className="h-9 bg-background/95 pl-8 pr-8 shadow-md" />
            {searching ? (
              <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : (
              query && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setQuery("")
                    setResults([])
                    searchLayerRef.current?.clearLayers()
                  }}
                  aria-label="Effacer"
                >
                  <X className="size-4" />
                </button>
              )
            )}
            {results.length > 1 && (
              <ul className="absolute inset-x-0 top-full mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover text-sm shadow-lg">
                {results.map((r) => (
                  <li key={`${r.lat},${r.lng}`}>
                    <button type="button" onClick={() => showResult(r)} className="w-full px-3 py-2 text-left hover:bg-muted">
                      {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
          <div className="pointer-events-auto flex gap-1.5">
            {onAddPoint && (
              <Button type="button" size="sm" variant={addMode ? "default" : "outline"} className="h-9 bg-background/95 shadow-md data-[on=true]:bg-primary" data-on={addMode} onClick={() => setAddMode((v) => !v)}>
                <MapPinPlus className="size-4" />
                <span className="hidden @2xl/main:inline">{addMode ? "Clique sur la carte" : "Ajouter un point"}</span>
              </Button>
            )}
            <div className="relative">
              <Button type="button" size="icon" variant="outline" className="size-9 bg-background/95 shadow-md" onClick={() => setLayersOpen((v) => !v)} aria-label="Fond de carte">
                <Layers className="size-4" />
              </Button>
              {layersOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-md border bg-popover p-1 shadow-lg">
                  {BASE_LAYERS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setBase(b.id)
                        setLayersOpen(false)
                      }}
                      className={cn("w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted", base === b.id && "font-semibold text-primary")}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button type="button" size="icon" variant="outline" className="size-9 bg-background/95 shadow-md" onClick={() => setFull((v) => !v)} aria-label={full ? "Réduire la carte" : "Carte en plein écran"}>
              {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
          </div>
        </div>

        {/* Lieux utiles autour */}
        <div className="absolute inset-x-2 bottom-8 z-[500] flex flex-col items-start gap-1.5">
          {(poiState.loading || poiState.message) && (
            <span className="rounded-full bg-background/95 px-2.5 py-1 text-xs shadow-md">
              {poiState.loading ? <Loader2 className="inline size-3.5 animate-spin" /> : poiState.message}
            </span>
          )}
          <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {POI_KINDS.map((k) => {
              const Icon = k.icon
              const on = poiKind === k.id
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setPoiKind(on ? null : k.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md transition-colors",
                    on ? "border-transparent text-white" : "bg-background/95 text-foreground hover:bg-background"
                  )}
                  style={on ? { background: k.color } : undefined}
                  aria-pressed={on}
                >
                  <Icon className="size-3.5" style={on ? undefined : { color: k.color }} />
                  {k.label}
                </button>
              )
            })}
          </div>
        </div>

        {addMode && (
          <div className="pointer-events-none absolute inset-x-0 top-14 z-[500] flex justify-center">
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-md">Clique sur la carte pour placer le point</span>
          </div>
        )}
      </div>
    </div>
  )
}
