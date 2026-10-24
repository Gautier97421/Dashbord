"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Loader2, UserPlus, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useConfirm } from "@/components/confirm-provider"
import { useToast } from "@/hooks/use-toast"
import { useLiveRefresh } from "@/lib/live-sync"
import { cn } from "@/lib/utils"

export const OPEN_SOCIAL_EVENT = "dashlife:open-social"

export interface Friend {
  id: string
  name: string
  email: string
  username: string | null
  friendshipId: string
}

interface Pending {
  id: string
  user: { id: string; name: string; email: string; username: string | null }
}

interface Profile {
  name: string | null
  email: string
  username: string | null
}

interface FriendsData {
  friends: Friend[]
  incoming: Pending[]
  outgoing: Pending[]
}

async function send<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Erreur")
  return data as T
}

/** Liste d'amis (pour partager un voyage) ; rechargée à chaque ouverture du formulaire. */
export function useFriends() {
  const [friends, setFriends] = useState<Friend[] | null>(null)
  useEffect(() => {
    send<FriendsData>("GET", "/api/friends")
      .then((d) => setFriends(d.friends))
      .catch(() => setFriends([]))
  }, [])
  return friends
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary", className)} title={name}>
      {initials(name)}
    </span>
  )
}

/** Bouton Social (à gauche de la cloche) : amis, demandes reçues et envoyées, ajout par e-mail. */
export function SocialButton() {
  const { toast } = useToast()
  const askConfirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<FriendsData>({ friends: [], incoming: [], outgoing: [] })
  const [query, setQuery] = useState("")
  const [sending, setSending] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pseudo, setPseudo] = useState("")

  const load = useCallback(() => {
    send<FriendsData>("GET", "/api/friends")
      .then(setData)
      .catch(() => undefined)
    send<Profile>("GET", "/api/profile")
      .then(setProfile)
      .catch(() => undefined)
  }, [])
  useEffect(load, [load])
  useLiveRefresh(load, 60_000)

  // Ouverture depuis une notification ou un raccourci (?social=1)
  useEffect(() => {
    const show = () => {
      setOpen(true)
      load()
    }
    window.addEventListener(OPEN_SOCIAL_EVENT, show)
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get("social") === "1") {
        show()
        params.delete("social")
        const query = params.toString()
        window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
      }
    } catch {
      // ignore
    }
    return () => window.removeEventListener(OPEN_SOCIAL_EVENT, show)
  }, [load])

  const fail = (e: unknown) => toast({ title: "Action impossible", description: e instanceof Error ? e.message : undefined, variant: "destructive" })

  const savePseudo = async () => {
    try {
      setProfile(await send<Profile>("PUT", "/api/profile", { username: pseudo }))
      toast({ title: "Pseudo enregistré" })
    } catch (e) {
      fail(e)
    }
  }

  const request = async () => {
    if (!query.trim()) return
    setSending(true)
    try {
      const res = await send<{ message: string }>("POST", "/api/friends", { query: query.trim() })
      toast({ title: "Demande d'ami", description: res.message })
      setQuery("")
      load()
    } catch (e) {
      fail(e)
    } finally {
      setSending(false)
    }
  }

  const respond = async (id: string, action: "accept" | "decline") => {
    try {
      await send("PUT", "/api/friends", { id, action })
      load()
    } catch (e) {
      fail(e)
    }
  }

  const remove = async (id: string, title: string) => {
    if (!(await askConfirm({ title, confirmLabel: "Retirer", destructive: true }))) return
    try {
      await send("DELETE", `/api/friends?id=${id}`)
      load()
    } catch (e) {
      fail(e)
    }
  }

  const badge = data.incoming.length

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) load()
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-transparent dark:hover:bg-transparent" aria-label={badge ? `Social : ${badge} demande${badge > 1 ? "s" : ""} d'ami` : "Social"}>
          <Users className="size-5" />
          {badge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{badge}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1rem))] p-0">
        <div className="border-b p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold">Social</p>
            {profile?.username && <span className="truncate text-xs text-muted-foreground">Toi : @{profile.username}</span>}
          </div>
          {profile && !profile.username ? (
            <form
              className="mt-2 space-y-1.5 rounded-lg bg-muted/60 p-2"
              onSubmit={(e) => {
                e.preventDefault()
                savePseudo()
              }}
            >
              <p className="text-xs">Choisis ton pseudo : tes amis pourront te trouver avec.</p>
              <div className="flex gap-2">
                <Input value={pseudo} onChange={(e) => setPseudo(e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="ton_pseudo" className="h-8" />
                <Button type="submit" size="sm" disabled={pseudo.length < 3}>
                  OK
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">Ajoute des amis pour partager et préparer vos voyages ensemble.</p>
          )}
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              request()
            }}
          >
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="@pseudo ou e-mail" className="h-8" autoCapitalize="none" autoCorrect="off" />
            <Button type="submit" size="sm" disabled={sending || !query.trim()}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Ajouter
            </Button>
          </form>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-3">
          {data.incoming.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Demandes reçues</p>
              {data.incoming.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <Avatar name={r.user.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.user.username ? `@${r.user.username}` : r.user.email}</p>
                  </div>
                  <Button size="icon" className="size-8" onClick={() => respond(r.id, "accept")} aria-label={`Accepter ${r.user.name}`}>
                    <Check className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="size-8" onClick={() => respond(r.id, "decline")} aria-label={`Refuser ${r.user.name}`}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mes amis {data.friends.length ? `(${data.friends.length})` : ""}</p>
            {data.friends.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pas encore d&apos;amis : envoie une demande avec son pseudo ou son e-mail.</p>
            ) : (
              data.friends.map((f) => (
                <div key={f.id} className="group flex items-center gap-2">
                  <Avatar name={f.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{f.username ? `@${f.username}` : f.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(f.friendshipId, `Retirer ${f.name} de tes amis ?`)}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    aria-label={`Retirer ${f.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {data.outgoing.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En attente de réponse</p>
              {data.outgoing.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <Avatar name={r.user.name} className="opacity-60" />
                  <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{r.user.username ? `@${r.user.username}` : r.user.email}</p>
                  <Button variant="outline" size="sm" className="h-7" onClick={() => remove(r.id, "Annuler cette demande ?")}>
                    Annuler
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
