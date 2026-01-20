"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle2,
  Calendar,
  Target,
  Dumbbell,
  Moon,
  Settings,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react"

interface TutorialStep {
  title: string
  description: string
  icon: React.ReactNode
  details: string[]
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "Bienvenue sur votre Dashboard !",
    description: "Gérez votre productivité et vos habitudes en un seul endroit",
    icon: <CheckCircle2 className="size-12 text-primary" />,
    details: [
      "✅ Suivez vos routines quotidiennes",
      "📊 Analysez vos statistiques",
      "🎯 Atteignez vos objectifs",
      "🔒 Vos données sont personnelles et sécurisées",
    ],
  },
  {
    title: "Missions & Projets",
    description: "Organisez vos objectifs à court et long terme",
    icon: <Target className="size-12 text-blue-500" />,
    details: [
      "🎯 Créez des missions (jour/semaine/mois/année)",
      "📁 Organisez vos projets",
      "✅ Gérez vos tâches quotidiennes",
      "📅 Suivez vos deadlines",
    ],
  },
  {
    title: "Routines Quotidiennes",
    description: "Construisez de bonnes habitudes jour après jour",
    icon: <Calendar className="size-12 text-green-500" />,
    details: [
      "🌅 Routine du matin (santé, sport, mental, travail)",
      "🌙 Routine du soir pour mieux dormir",
      "📈 Suivez vos séries (streaks)",
      "⏱️ Validez chaque action chaque jour",
    ],
  },
  {
    title: "Sport & Nutrition",
    description: "Suivez vos entraînements et votre progression",
    icon: <Dumbbell className="size-12 text-orange-500" />,
    details: [
      "💪 Créez des programmes d'entraînement",
      "📅 Planifiez vos séances dans le calendrier",
      "📊 Analysez vos statistiques (heures, calories)",
      "🍎 Suivez votre nutrition quotidienne",
    ],
  },
  {
    title: "Suivi du Sommeil",
    description: "Améliorez la qualité de votre repos",
    icon: <Moon className="size-12 text-purple-500" />,
    details: [
      "😴 Enregistrez vos heures de coucher/réveil",
      "⏱️ Calculez automatiquement votre durée de sommeil",
      "⭐ Évaluez la qualité de votre sommeil",
      "📈 Visualisez vos tendances",
    ],
  },
  {
    title: "Statistiques & Insights",
    description: "Visualisez votre progression",
    icon: <BarChart3 className="size-12 text-pink-500" />,
    details: [
      "📊 Tableaux de bord personnalisables",
      "📈 Graphiques de progression",
      "🔥 Séries et records personnels",
      "💡 Insights et conseils motivants",
    ],
  },
  {
    title: "Paramètres",
    description: "Personnalisez votre expérience",
    icon: <Settings className="size-12 text-gray-500" />,
    details: [
      "🎨 Choisissez votre thème (clair/sombre)",
      "👁️ Activez/désactivez des sections",
      "⚠️ Réinitialisez vos données si besoin",
      "🔐 Vos données restent privées",
    ],
  },
]

interface OnboardingTutorialProps {
  open: boolean
  onComplete: () => void
}

export function OnboardingTutorial({ open, onComplete }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    onComplete()
  }

  const step = tutorialSteps[currentStep]

  return (
    <Dialog open={open} onOpenChange={handleSkip}>
      <DialogContent className="max-w-2xl" style={{ fontFamily: 'cursive' }}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step.icon}
              <div>
                <DialogTitle className="text-2xl">{step.title}</DialogTitle>
                <DialogDescription className="text-base mt-1">
                  {step.description}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="rounded-full"
            >
              <X className="size-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <Progress value={progress} className="h-2" />
          
          <div className="space-y-3">
            {step.details.map((detail, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
              >
                <span className="text-lg">{detail}</span>
              </div>
            ))}
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Étape {currentStep + 1} sur {tutorialSteps.length}
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="size-4 mr-2" />
            Précédent
          </Button>

          <div className="flex gap-2">
            {currentStep < tutorialSteps.length - 1 && (
              <Button variant="ghost" onClick={handleSkip}>
                Passer
              </Button>
            )}
            <Button onClick={handleNext}>
              {currentStep === tutorialSteps.length - 1 ? (
                <>
                  <CheckCircle2 className="size-4 mr-2" />
                  C'est parti !
                </>
              ) : (
                <>
                  Suivant
                  <ChevronRight className="size-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
