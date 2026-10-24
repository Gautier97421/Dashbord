"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Loader2, MapPin, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { newId, parseCoordinates, type TripStop } from "@/lib/travel/shared"
import { send } from "./context"

/** Nom court d'un résultat de recherche (« Lisbonne, Portugal » → « Lisbonne »). */
export const shortName = (name: string) => name.split(",")[0].trim()

/**
 * Destinations du voyage, dans l'ordre : une seule ville, ou plusieurs villes et pays pour un road trip.
 * Chaque destination est localisée (recherche OpenStreetMap) pour que la carte s'y place.
 */
export function StopsEditor({ stops, onChange, minDate, maxDate }: { stops: TripStop[]; onChange: (stops: TripStop[]) => void; minDate: string; maxDate: string }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{ name: string; lat: number; lng: number }[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = (r: { name: string; lat: number; lng: number }) => {
    onChange([...stops, { id: newId(), name: shortName(r.name), lat: r.lat, lng: r.lng, startDate: null, endDate: null }])
    setQuery("")
    setResults([])
  }

  const search = async () => {
    const q = query.trim()
    const direct = parseCoordinates(q)
    if (direct) return add({ name: q, ...direct })
    if (q.length < 2) return
    setSearching(true)
    setError(null)
    try {
      const data = await send<{ results: { name: string; lat: number; lng: number }[] }>("GET", `/api/trips/geocode?q=${encodeURIComponent(q)}`)
      if (data.results.length === 1) add(data.results[0])
      else setResults(data.results)
      if (!data.results.length) setError("Aucun lieu trouvé")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recherche impossible")
    } finally {
      setSearching(false)
    }
  }

  const move = (i: number, delta: number) => {
    const next = [...stops]
    const [item] = next.splice(i, 1)
    next.splice(i + delta, 0, item)
    onChange(next)
  }
  const patch = (id: string, values: Partial<TripStop>) => onChange(stops.map((s) => (s.id === id ? { ...s, ...values } : s)))

  return (
    <div className="space-y-2">
      {stops.length > 0 && (
        <ol className="space-y-1.5">
          {stops.map((s, i) => (
            <li key={s.id} className="space-y-1.5 rounded-lg border p-2">
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-semibold text-white">{stops.length > 1 ? i + 1 : <MapPin className="size-3.5" />}</span>
                <Input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} className="h-8 min-w-0 flex-1" aria-label="Nom de la destination" />
                <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Monter">
                  <ArrowUp className="size-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" onClick={() => move(i, 1)} disabled={i === stops.length - 1} aria-label="Descendre">
                  <ArrowDown className="size-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" onClick={() => onChange(stops.filter((x) => x.id !== s.id))} aria-label={`Retirer ${s.name}`}>
                  <X className="size-4" />
                </Button>
              </div>
              {stops.length > 1 && (
                <div className="grid grid-cols-2 gap-2 pl-8 text-xs text-muted-foreground">
                  <label className="min-w-0 space-y-1">
                    Du
                    <Input type="date" value={s.startDate ?? ""} min={minDate} max={maxDate} onChange={(e) => patch(s.id, { startDate: e.target.value || null })} className="h-8 w-full text-xs" />
                  </label>
                  <label className="min-w-0 space-y-1">
                    Au
                    <Input type="date" value={s.endDate ?? ""} min={s.startDate || minDate} max={maxDate} onChange={(e) => patch(s.id, { endDate: e.target.value || null })} className="h-8 w-full text-xs" />
                  </label>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <form
        className="relative flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
      >
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={stops.length ? "Ajouter une étape (ville, région, pays…)" : "Ville, région ou pays"} />
        <Button type="button" variant="outline" onClick={search} disabled={searching || query.trim().length < 2} className="shrink-0">
          {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Ajouter
        </Button>
        {results.length > 1 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover text-sm shadow-lg">
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" onClick={() => add(r)} className="w-full px-3 py-2 text-left hover:bg-muted">
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
      {error && <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>}
      <p className="text-xs text-muted-foreground">Un road trip ? Ajoute chaque ville ou pays dans l&apos;ordre : la carte les relie.</p>
    </div>
  )
}
