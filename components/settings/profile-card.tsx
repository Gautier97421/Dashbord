"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

/** Nom affiché et pseudo unique (utilisé par les amis pour te trouver). */
export function ProfileCard() {
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [initial, setInitial] = useState({ name: "", username: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return
        setEmail(p.email)
        setName(p.name ?? "")
        setUsername(p.username ?? "")
        setInitial({ name: p.name ?? "", username: p.username ?? "" })
      })
      .catch(() => undefined)
  }, [])

  const changed = name !== initial.name || username !== initial.username

  const save = async () => {
    setSaving(true)
    try {
      const body: Record<string, string> = {}
      if (name !== initial.name) body.name = name
      if (username !== initial.username) body.username = username
      const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible")
      setInitial({ name: data.name ?? "", username: data.username ?? "" })
      setUsername(data.username ?? "")
      toast({ title: "Profil enregistré" })
    } catch (e) {
      toast({ title: "Profil non enregistré", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>Ton nom et ton pseudo, visibles par tes amis.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Nom</Label>
          <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-username">Pseudo</Label>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">@</span>
            <Input id="profile-username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="ton_pseudo" />
          </div>
          <p className="text-xs text-muted-foreground">Unique, 3 à 20 caractères (lettres, chiffres, . et _). Tes amis te trouvent avec dans Social.</p>
        </div>
        {email && <p className="text-xs text-muted-foreground">Compte : {email}</p>}
        <Button onClick={save} disabled={!changed || saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  )
}
