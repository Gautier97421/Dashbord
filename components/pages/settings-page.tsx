"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Sun,
  Moon,
  Monitor,
  Clock,
  Trash2,
  Download,
  Upload,
  RefreshCw,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { defaultState } from "@/lib/store"

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString(),
  label: `${i.toString().padStart(2, "0")}:00`,
}))

export function SettingsPage() {
  const { state, dispatch } = useApp()

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    dispatch({ type: "UPDATE_SETTINGS", payload: { theme } })
  }

  const handleResetData = () => {
    // Reset to default state by clearing localStorage and reloading
    localStorage.removeItem("productivity-dashboard-v1")
    window.location.reload()
  }

  const handleExportData = () => {
    const dataStr = JSON.stringify(state, null, 2)
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `productivity-data-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImportData = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string)
            localStorage.setItem("productivity-dashboard-v1", JSON.stringify(data))
            window.location.reload()
          } catch (error) {
            alert("Fichier invalide. Veuillez sélectionner un fichier JSON valide.")
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">Personnalisez votre expérience</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Apparence</CardTitle>
          <CardDescription>Personnalisez l&apos;apparence de l&apos;application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Thème</Label>
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant={state.settings.theme === "light" ? "default" : "outline"}
                className="flex flex-col gap-2 h-auto py-4"
                onClick={() => handleThemeChange("light")}
              >
                <Sun className="size-5" />
                <span>Clair</span>
              </Button>
              <Button
                variant={state.settings.theme === "dark" ? "default" : "outline"}
                className="flex flex-col gap-2 h-auto py-4"
                onClick={() => handleThemeChange("dark")}
              >
                <Moon className="size-5" />
                <span>Sombre</span>
              </Button>
              <Button
                variant={state.settings.theme === "system" ? "default" : "outline"}
                className="flex flex-col gap-2 h-auto py-4"
                onClick={() => handleThemeChange("system")}
              >
                <Monitor className="size-5" />
                <span>Système</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" />
            Heures de la journée
          </CardTitle>
          <CardDescription>Définissez vos heures de travail</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Début de journée</Label>
              <Select
                value={state.settings.dayStartHour.toString()}
                onValueChange={(value) =>
                  dispatch({
                    type: "UPDATE_SETTINGS",
                    payload: { dayStartHour: parseInt(value) },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.slice(0, 12).map((hour) => (
                    <SelectItem key={hour.value} value={hour.value}>
                      {hour.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fin de journée</Label>
              <Select
                value={state.settings.dayEndHour.toString()}
                onValueChange={(value) =>
                  dispatch({
                    type: "UPDATE_SETTINGS",
                    payload: { dayEndHour: parseInt(value) },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.slice(12).map((hour) => (
                    <SelectItem key={hour.value} value={hour.value}>
                      {hour.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Affichage</CardTitle>
          <CardDescription>Choisissez ce qui s&apos;affiche sur le tableau de bord</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showRoutines">Afficher les routines</Label>
              <p className="text-sm text-muted-foreground">
                Affiche la section routine sur le tableau de bord
              </p>
            </div>
            <Switch
              id="showRoutines"
              checked={state.settings.showRoutines}
              onCheckedChange={(checked) =>
                dispatch({ type: "UPDATE_SETTINGS", payload: { showRoutines: checked } })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showStats">Afficher les statistiques</Label>
              <p className="text-sm text-muted-foreground">
                Affiche les statistiques rapides sur le tableau de bord
              </p>
            </div>
            <Switch
              id="showStats"
              checked={state.settings.showStats}
              onCheckedChange={(checked) =>
                dispatch({ type: "UPDATE_SETTINGS", payload: { showStats: checked } })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showDailyInsight">Afficher l&apos;info du jour</Label>
              <p className="text-sm text-muted-foreground">
                Affiche une citation ou conseil motivant
              </p>
            </div>
            <Switch
              id="showDailyInsight"
              checked={state.settings.showDailyInsight}
              onCheckedChange={(checked) =>
                dispatch({ type: "UPDATE_SETTINGS", payload: { showDailyInsight: checked } })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Données</CardTitle>
          <CardDescription>Gérez vos données personnelles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="flex-1 bg-transparent" onClick={handleExportData}>
              <Download className="size-4 mr-2" />
              Exporter les données
            </Button>
            <Button variant="outline" className="flex-1 bg-transparent" onClick={handleImportData}>
              <Upload className="size-4 mr-2" />
              Importer les données
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-destructive">Zone de danger</h4>
              <p className="text-sm text-muted-foreground">
                Ces actions sont irréversibles
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  <Trash2 className="size-4 mr-2" />
                  Réinitialiser toutes les données
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Toutes vos routines, missions, projets
                    et statistiques seront définitivement supprimés.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetData}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Réinitialiser
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Profil de santé */}
      <Card>
        <CardHeader>
          <CardTitle>Profil de santé</CardTitle>
          <CardDescription>Recommandations pour une vie équilibrée</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-3">Hydratation et sommeil</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted border">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">💧</div>
                    <div>
                      <p className="font-semibold">Hydratation</p>
                      <p className="text-2xl font-bold">2–2,5 L</p>
                      <p className="text-sm text-muted-foreground">par jour</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted border">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">😴</div>
                    <div>
                      <p className="font-semibold">Sommeil</p>
                      <p className="text-2xl font-bold">7–9 h</p>
                      <p className="text-sm text-muted-foreground">Essentiel pour la récupération</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>À propos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>SoloLeveling</strong> - Votre assistant de productivité personnelle
          </p>
          <p>
            Conçu pour vous aider à construire de meilleures habitudes, gérer vos projets
            et atteindre vos objectifs.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
