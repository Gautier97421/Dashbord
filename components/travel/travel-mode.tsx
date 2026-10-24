"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ChevronLeft, ChevronRight, CloudDownload, FileText, Loader2, MapPin, Navigation, Phone, Ticket, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { keepDocsOffline, offlineDocIds } from "@/lib/travel/offline"
import {
  countdown,
  directionsUrl,
  formatDateTime,
  formatDay,
  sortActivities,
  toMinutes,
  tripDays,
  type TripBooking,
} from "@/lib/travel/shared"
import { useTravel, useTrip } from "./context"
import { BOOKING_ICONS } from "./bookings"
import { ACTIVITY_ICONS } from "./itinerary"
import { TripFiles, invalidateOfflineDocs } from "./files"
import { ContactsSection } from "./prep"
import { CopyText, Section } from "./ui"

/** Vue simplifiée pendant le voyage : programme du jour, prochaine étape, billets, contacts et documents. */
export function TravelMode({ onExit }: { onExit: () => void }) {
  const trip = useTrip()
  const { today, offlineSince, updateItem } = useTravel()
  const { toast } = useToast()
  const days = tripDays(trip)
  const [day, setDay] = useState(days.includes(today) ? today : days[0])
  const [savingOffline, setSavingOffline] = useState(false)
  const [offlineCount, setOfflineCount] = useState(0)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    offlineDocIds().then((ids) => setOfflineCount([...trip.attachments, ...trip.documents.flatMap((d) => d.files)].filter((a) => ids.has(a.id)).length))
  }, [trip.attachments, trip.documents, savingOffline])

  // Fichiers du voyage et ceux des documents de la bibliothèque utilisés pour ce voyage
  const allFiles = [...trip.attachments, ...trip.documents.flatMap((d) => d.files)]
  const index = days.indexOf(day)
  const list = sortActivities(trip.activities.filter((a) => a.day === day))
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const next = day === today ? list.find((a) => !a.done && (toMinutes(a.endTime) ?? toMinutes(a.startTime) ?? 24 * 60) >= nowMin) : list.find((a) => !a.done)
  const nextPlace = trip.places.find((p) => p.id === next?.placeId)
  const nextAddress = next?.address || nextPlace?.address
  const nextBooking = trip.bookings.find((b) => b.id === next?.bookingId)

  // Réservations du jour : départs, arrivées et hébergements qui couvrent la journée
  const bookings = trip.bookings
    .filter((b) => b.status !== "cancelled")
    .filter((b) => {
      const start = b.startAt?.slice(0, 10)
      const end = b.endAt?.slice(0, 10)
      if (!start) return false
      return start === day || end === day || (start < day && !!end && end > day)
    })
    .sort((a, b) => (a.startAt || "").localeCompare(b.startAt || ""))

  const prepareOffline = async () => {
    setSavingOffline(true)
    const saved = await keepDocsOffline(allFiles.map((a) => a.id))
    invalidateOfflineDocs()
    setSavingOffline(false)
    toast({
      title: "Prêt pour le hors connexion",
      description: `${saved} document${saved > 1 ? "s" : ""} gardé${saved > 1 ? "s" : ""} sur cet appareil. Le programme, les réservations et les contacts restent consultables sans réseau.`,
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onExit}>
          <ArrowLeft className="size-4" />
          Quitter
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{trip.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {trip.destination} · {countdown(trip, today)}
          </p>
        </div>
        {offlineSince ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-800 dark:text-amber-300">
            <WifiOff className="size-3.5" />
            Hors connexion
          </span>
        ) : (
          <Button variant="outline" size="sm" onClick={prepareOffline} disabled={savingOffline || !allFiles.length} title="Garder les documents sur cet appareil">
            {savingOffline ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />}
            Hors connexion{allFiles.length ? ` (${offlineCount}/${allFiles.length})` : ""}
          </Button>
        )}
      </div>

      {/* Journée affichée */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setDay(days[index - 1])} disabled={index <= 0} aria-label="Jour précédent">
          <ChevronLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-semibold">{formatDay(day, true)}</p>
          <p className="text-xs text-muted-foreground">
            Jour {index + 1} sur {days.length}
            {day === today ? " · aujourd'hui" : ""}
          </p>
        </div>
        <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={() => setDay(days[index + 1])} disabled={index >= days.length - 1} aria-label="Jour suivant">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Prochaine étape */}
      {next ? (
        <div className="space-y-2 rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">{day === today ? "Prochaine étape" : "Première étape"}</p>
          <p className="text-lg font-semibold">
            {next.startTime && <span className="tabular-nums">{next.startTime} · </span>}
            {next.title}
          </p>
          {(nextPlace || nextAddress) && (
            <p className="flex items-start gap-1 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              {[nextPlace?.name, nextAddress].filter(Boolean).join(" · ")}
            </p>
          )}
          {nextBooking?.reference && (
            <p className="flex items-center gap-2 text-sm">
              <Ticket className="size-4 text-muted-foreground" />
              <CopyText text={nextBooking.reference} />
            </p>
          )}
          {(nextPlace?.lat != null || nextAddress) && (
            <Button size="lg" className="w-full" asChild>
              <a href={directionsUrl({ lat: nextPlace?.lat ?? null, lng: nextPlace?.lng ?? null, address: nextAddress, name: nextPlace?.name })} target="_blank" rel="noopener noreferrer">
                <Navigation className="size-5" />Y aller
              </a>
            </Button>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">{list.length ? "Programme terminé pour ce jour 🎉" : "Rien de prévu ce jour-là."}</p>
      )}

      {/* Programme */}
      {list.length > 0 && (
        <Section title="Programme">
          <ul className="space-y-1">
            {list.map((a) => {
              const Icon = ACTIVITY_ICONS[a.kind] ?? MapPin
              const place = trip.places.find((p) => p.id === a.placeId)
              const address = a.address || place?.address
              return (
                <li key={a.id} className={cn("flex items-center gap-3 rounded-lg px-1 py-2", a.id === next?.id && "bg-primary/5")}>
                  <Checkbox checked={a.done} onCheckedChange={(v) => updateItem("activities", a.id, { done: v === true })} disabled={!!offlineSince} className="size-5" aria-label="Fait" />
                  <span className="w-11 shrink-0 text-sm font-semibold tabular-nums">{a.startTime ?? ""}</span>
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className={cn("min-w-0 flex-1 text-sm", a.done && "text-muted-foreground line-through")}>
                    {a.title}
                    {a.rainPlan && <span className="block text-xs text-sky-700 dark:text-sky-300">Si pluie : {a.rainPlan}</span>}
                  </span>
                  {(place?.lat != null || address) && (
                    <Button variant="outline" size="icon" className="size-9 shrink-0" asChild>
                      <a href={directionsUrl({ lat: place?.lat ?? null, lng: place?.lng ?? null, address, name: place?.name })} target="_blank" rel="noopener noreferrer" aria-label={`Itinéraire vers ${a.title}`}>
                        <Navigation className="size-4" />
                      </a>
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {/* Billets et réservations */}
      <Section title="Billets et réservations du jour" icon={<Ticket className="size-4" />}>
        {bookings.length === 0 ? <p className="text-sm text-muted-foreground">Aucune réservation ce jour-là.</p> : bookings.map((b) => <BookingTicket key={b.id} booking={b} day={day} />)}
      </Section>

      <ContactsSection readOnly />

      {(trip.notes || trip.documents.length > 0 || trip.attachments.some((a) => !a.tripItemId)) && (
        <Section title="Infos et documents" icon={<FileText className="size-4" />}>
          {trip.notes && <p className="whitespace-pre-line text-sm">{trip.notes}</p>}
          {trip.documents.map((d) => (
            <div key={`${d.ownerId}:${d.documentId}`} className="space-y-1 rounded-lg border p-2.5">
              <p className="text-sm font-medium">
                {d.title}
                {!d.mine && <span className="font-normal text-muted-foreground"> · {d.ownerName}</span>}
              </p>
              {d.number && <CopyText text={d.number} />}
              {d.files.map((f) => (
                <a key={f.id} href={`/api/attachments/${f.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <FileText className="size-3.5 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </a>
              ))}
            </div>
          ))}
          <TripFiles />
        </Section>
      )}
    </div>
  )
}

function BookingTicket({ booking: b, day }: { booking: TripBooking; day: string }) {
  const Icon = BOOKING_ICONS[b.type] ?? FileText
  const starts = b.startAt?.slice(0, 10) === day
  const ends = b.endAt?.slice(0, 10) === day
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{b.title}</p>
          <p className="text-sm text-muted-foreground">
            {starts ? formatDateTime(b.startAt) : ends ? `Jusqu'à ${formatDateTime(b.endAt)}` : `Jusqu'au ${formatDateTime(b.endAt)}`}
            {b.fromPlace ? ` · ${b.fromPlace}` : ""}
            {b.toPlace ? ` → ${b.toPlace}` : ""}
          </p>
        </div>
      </div>
      {b.reference && <CopyText text={b.reference} className="text-sm" />}
      <div className="flex flex-wrap gap-2">
        {b.address && (
          <Button variant="outline" size="sm" asChild>
            <a href={directionsUrl({ lat: null, lng: null, address: b.address })} target="_blank" rel="noopener noreferrer">
              <Navigation className="size-4" />
              Itinéraire
            </a>
          </Button>
        )}
        {b.phone && (
          <Button variant="outline" size="sm" asChild>
            <a href={`tel:${b.phone.replace(/\s/g, "")}`}>
              <Phone className="size-4" />
              Appeler
            </a>
          </Button>
        )}
      </div>
      <TripFiles itemId={b.id} compact />
    </div>
  )
}
