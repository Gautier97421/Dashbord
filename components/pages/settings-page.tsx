"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
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
  Loader2,
} from "lucide-react"
import { useApp } from "@/lib/store-api"

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString(),
  label: `${i.toString().padStart(2, "0")}:00`,
}))

export function SettingsPage() {
  const { state, updateSettings } = useApp()
  const { toast } = useToast()
  const [isResetting, setIsResetting] = useState(false)

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    updateSettings({ theme })
  }

  const handleResetData = async () => {
    setIsResetting(true)
    try {
      const response = await fetch('/api/reset', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la réinitialisation')
      }

      toast({
        title: "Données réinitialisées",
        description: "Toutes vos données ont été supprimées avec succès.",
      })

      // Recharger la page après un court délai
      setTimeout(() => {
        window.location.href = '/'
      }, 1500)
    } catch (error) {
      console.error('Erreur:', error)
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la réinitialisation.",
        variant: "destructive",
      })
      setIsResetting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl" style={{ fontFamily: 'cursive' }}>
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
                updateSettings({ showRoutines: checked })
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
                updateSettings({ showStats: checked })
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
                updateSettings({ showDailyInsight: checked })
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
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-destructive">Zone de danger</h4>
              <p className="text-sm text-muted-foreground">
                Cette action est irréversible
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto" disabled={isResetting}>
                  {isResetting ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Réinitialisation...
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4 mr-2" />
                      Réinitialiser toutes les données
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Toutes vos routines, missions, projets,
                    entraînements et statistiques seront définitivement supprimés de la base de données.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetData}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Oui, tout supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
