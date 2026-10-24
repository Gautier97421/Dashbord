"use client"

import { useState } from "react"
import { Sun, Moon } from "lucide-react"
import { RoutinePage } from "@/components/pages/routine-page"
import { RoutineNightPage } from "@/components/pages/routine-night-page"
import { SegmentedTabs, type SegmentedTab } from "@/components/segmented-tabs"

type RoutineKind = "morning" | "night"

// Sans choix explicite, on ouvre la routine du moment : le soir à partir de 17 h (et la nuit)
function routineForNow(): RoutineKind {
  const hour = new Date().getHours()
  return hour >= 17 || hour < 4 ? "night" : "morning"
}

// Page "Routine" du menu : regroupe la routine matinale et la routine du soir
export function RoutinesPage({ initial }: { initial?: RoutineKind }) {
  const [kind, setKind] = useState<RoutineKind>(() => initial ?? routineForNow())

  const options: SegmentedTab<RoutineKind>[] = [
    { value: "morning", label: "Matinale", icon: Sun },
    { value: "night", label: "Du soir", icon: Moon },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <SegmentedTabs
        data-tour="routine-switch"
        label="Choix de la routine"
        value={kind}
        onChange={setKind}
        stretch
        className="sm:w-fit"
        tabs={options}
      />

      {kind === "morning" ? <RoutinePage /> : <RoutineNightPage />}
    </div>
  )
}
