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
import { CustomPagesManager } from "@/components/settings/custom-pages-manager"
import { MenuOrderManager } from "@/components/settings/menu-order-manager"
import { FolderHandlerSetup } from "@/components/settings/folder-handler-setup"
import { ConnectionsManager } from "@/components/settings/connections-manager"
import { InstallAppCard } from "@/components/settings/install-app-card"
import { NotificationsCard } from "@/components/settings/notifications-card"
import { AdminFeaturesCard } from "@/components/settings/admin-features-card"
import { ProfileCard } from "@/components/settings/profile-card"
import type { PageKey } from "@/components/app-sidebar"

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString(),
  label: `${i.toString().padStart(2, "0")}:00`,
}))

export function SettingsPage({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
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
    <div className="space-y-6" style={{ fontFamily: 'cursive' }}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">Personnalisez votre expérience</p>
      </div>

      {/* Masonry: each card keeps its own height instead of stretching to its row */}
      <div className="columns-1 @4xl/main:columns-2 gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid">
      <ProfileCard />

      {/* Administration (visible uniquement pour l'admin) */}
      <AdminFeaturesCard />

      {/* Tutoriel */}
      <Card>
        <CardHeader>
          <CardTitle>Tutoriel</CardTitle>
          <CardDescription>Revois la visite guidée de l'app, outil par outil.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            data-tour="settings-tour"
            variant="outline"
            onClick={() => window.dispatchEvent(new Event("dashlife:start-tour"))}
          >
            <RefreshCw className="size-4 mr-2" />
            Revoir le tutoriel
          </Button>
        </CardContent>
      </Card>

      {/* Installation PWA */}
      <div data-tour="settings-install">
        <InstallAppCard />
      </div>

      {/* Notifications push et alertes des projets */}
      <NotificationsCard />

      {/* Connexions / applications */}
      <Card>
        <CardHeader>
          <CardTitle>Connexions</CardTitle>
          <CardDescription>Connecte tes applications (Gmail, GitHub, Notion…) à utiliser dans l'Agent IA</CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectionsManager />
        </CardContent>
      </Card>

      {/* Custom pages */}
      <CustomPagesManager onNavigate={onNavigate} />

      {/* Menu order */}
      <div data-tour="settings-menu-order">
        <MenuOrderManager />
      </div>

      <FolderHandlerSetup />

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
            <strong>DashLife</strong> - Votre assistant de productivité personnelle
          </p>
          <p>
            Conçu pour vous aider à construire de meilleures habitudes, gérer vos projets
            et atteindre vos objectifs.
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
