"use client"

import { useState } from "react"
import { useApp } from "@/lib/store-api"
import { generateId, getToday } from "@/lib/helpers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MonthCalendar, MonthNav, monthLabel, shiftMonth } from "@/components/month-calendar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Clock, Moon, TrendingUp, Calendar as CalendarIcon, Plus, Trash2 } from "lucide-react"
import type { SleepLog } from "@/lib/types"

export function SleepPage() {
  const { state, addSleepLog: addSleepLogApi, deleteSleepLog: deleteSleepLogApi } = useApp()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLog, setNewLog] = useState<Partial<SleepLog>>({
    date: getToday(),
    bedTime: "23:00",
    wakeTime: "07:00",
    quality: 3,
  })

  const SLEEP_CYCLE_MINUTES = 90
  const [currentTime, setCurrentTime] = useState(new Date())
  const [customWakeTimes, setCustomWakeTimes] = useState(["06:00", "07:00", "08:00"])
  const [selectedDate, setSelectedDate] = useState(getToday())

  // Calculer les cycles de sommeil à partir de maintenant
  const calculateSleepCycles = () => {
    const now = new Date()
    const cycles = []
    
    for (let i = 1; i <= 8; i++) {
      const wakeTime = new Date(now.getTime() + i * SLEEP_CYCLE_MINUTES * 60 * 1000 + 15 * 60 * 1000) // +15min pour s'endormir
      cycles.push({
        cycles: i,
        sleepTime: now,
        wakeTime: wakeTime,
        duration: i * SLEEP_CYCLE_MINUTES + 15,
      })
    }
    
    return cycles
  }

  // Calculer l'heure de coucher pour se réveiller à une heure spécifique
  const calculateBedtimeForWakeup = (wakeTimeStr: string, cycles: number) => {
    const [hours, minutes] = wakeTimeStr.split(":").map(Number)
    const wakeTime = new Date()
    wakeTime.setHours(hours, minutes, 0, 0)
    
    const totalMinutes = cycles * SLEEP_CYCLE_MINUTES + 15 // +15min pour s'endormir
    const bedtime = new Date(wakeTime.getTime() - totalMinutes * 60 * 1000)
    
    return bedtime
  }

  const sleepCycles = calculateSleepCycles()

  // Obtenir les logs du mois sélectionné pour le calendrier
  const getMonthLogs = () => {
    // Comparaison sur "AAAA-MM" : new Date("AAAA-MM-JJ") serait lu en UTC
    const month = selectedDate.slice(0, 7)
    return state.sleepLogs.filter((log) => log.date.slice(0, 7) === month)
  }


  const monthLogs = getMonthLogs()

  const getSleepLogForDate = (dateStr: string) => {
    return state.sleepLogs.find((log) => log.date === dateStr)
  }



  const addSleepLog = async () => {
    if (!newLog.bedTime || !newLog.wakeTime) return

    const [bedHours, bedMinutes] = newLog.bedTime.split(":").map(Number)
    const [wakeHours, wakeMinutes] = newLog.wakeTime.split(":").map(Number)
    
    const bedTime = new Date()
    bedTime.setHours(bedHours, bedMinutes, 0, 0)
    
    const wakeTime = new Date()
    wakeTime.setHours(wakeHours, wakeMinutes, 0, 0)
    
    // Si l'heure de réveil est avant le coucher, c'est le lendemain
    if (wakeTime < bedTime) {
      wakeTime.setDate(wakeTime.getDate() + 1)
    }
    
    const duration = Math.round((wakeTime.getTime() - bedTime.getTime()) / (1000 * 60))

    await addSleepLogApi({
      date: newLog.date || getToday(),
      bedTime: newLog.bedTime,
      wakeTime: newLog.wakeTime,
      duration,
      quality: newLog.quality || 3,
      notes: newLog.notes,
    })
    setShowAddForm(false)
    setNewLog({ date: getToday(), bedTime: "23:00", wakeTime: "07:00", quality: 3 })
  }

  const deleteSleepLog = async (id: string) => {
    await deleteSleepLogApi(id)
  }

  // Calcul des statistiques
  const last7DaysLogs = state.sleepLogs
    .filter((log) => {
      const logDate = new Date(log.date)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return logDate >= weekAgo
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const avgSleepDuration = last7DaysLogs.length > 0
    ? Math.round(last7DaysLogs.reduce((acc, log) => acc + log.duration, 0) / last7DaysLogs.length)
    : 0

  const avgQuality = last7DaysLogs.length > 0
    ? (last7DaysLogs.reduce((acc, log) => acc + log.quality, 0) / last7DaysLogs.length).toFixed(1)
    : 0

  const sleepDebt = Math.max(0, (7 * 8 * 60) - last7DaysLogs.reduce((acc, log) => acc + log.duration, 0))

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Sommeil</h1>
        <p className="text-sm text-muted-foreground">Trackez votre sommeil et optimisez vos cycles</p>
      </div>

      <Tabs defaultValue="tracking" className="space-y-4 sm:space-y-6">
        <TabsList data-tour="sleep-tabs" className="grid w-full grid-cols-3">
          <TabsTrigger value="tracking" className="text-xs sm:text-sm">
            <Moon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Suivi
          </TabsTrigger>
          <TabsTrigger value="calculator" className="text-xs sm:text-sm">
            <Clock className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Calculateur</span>
            <span className="sm:hidden">Cycles</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-xs sm:text-sm">
            <TrendingUp className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Stats
          </TabsTrigger>
        </TabsList>

        {/* Calculateur de cycles */}
        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quand me coucher ?</CardTitle>
              <CardDescription>
                Il est actuellement <strong>{formatTime(new Date())}</strong>. Voici à quelle heure vous réveiller selon le nombre de cycles :
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {sleepCycles.map((cycle) => (
                  <div
                    key={cycle.cycles}
                    className="flex items-center justify-between p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-sm sm:text-base">{cycle.cycles} cycles</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        = {Math.floor(cycle.duration / 60)}h{cycle.duration % 60 > 0 ? ` ${cycle.duration % 60}min` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl sm:text-2xl font-bold">{formatTime(cycle.wakeTime)}</p>
                      <p className="text-xs text-muted-foreground">Réveil</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>À quelle heure me coucher pour me réveiller à...</CardTitle>
              <CardDescription>Choisissez votre heure de réveil souhaitée</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {customWakeTimes.map((wakeTime, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Label htmlFor={`wakeTime${index}`} className="whitespace-nowrap min-w-32">
                      Heure de réveil {index + 1} :
                    </Label>
                    <Input
                      id={`wakeTime${index}`}
                      type="time"
                      value={wakeTime}
                      onChange={(e) => {
                        const newTimes = [...customWakeTimes]
                        newTimes[index] = e.target.value
                        setCustomWakeTimes(newTimes)
                      }}
                      className="w-32"
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {[4, 5, 6].map((cycles) => {
                      const bedtime = calculateBedtimeForWakeup(wakeTime, cycles)
                      const durationHours = (cycles * 90 + 15) / 60
                      return (
                        <div
                          key={cycles}
                          className="p-3 rounded-lg border bg-card text-center hover:bg-accent transition-colors"
                        >
                          <p className="text-lg font-bold">{formatTime(bedtime)}</p>
                          <p className="text-xs text-muted-foreground">{cycles} cycles</p>
                          <p className="text-xs text-muted-foreground mt-1">{durationHours.toFixed(1)}h</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suivi du sommeil */}
        <TabsContent value="tracking" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle>Calendrier de sommeil</CardTitle>
                </div>
                <MonthNav
                  label={monthLabel(selectedDate)}
                  onPrev={() => setSelectedDate(shiftMonth(selectedDate, -1))}
                  onNext={() => setSelectedDate(shiftMonth(selectedDate, 1))}
                  onToday={() => setSelectedDate(getToday())}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <MonthCalendar
                day={selectedDate}
                dayClassName={(day) => !!getSleepLogForDate(day.key) && "bg-blue-50 dark:bg-blue-950/20"}
                onDayClick={(day) => {
                  setNewLog({
                    ...newLog,
                    date: day.key,
                  })
                  setShowAddForm(true)
                }}
                renderDay={(day) => {
                  const log = getSleepLogForDate(day.key)
                  if (!log) return null
                  return (
                    <div className="min-w-0 space-y-1">
                      <div className="truncate rounded bg-blue-500/10 px-0.5 py-0.5 text-center text-[0.625rem] text-blue-600 dark:text-blue-400 sm:text-xs">
                        {log.bedTime} → {log.wakeTime}
                      </div>
                      <div className="text-xs font-semibold">
                        {Math.floor(log.duration / 60)}h{log.duration % 60 > 0 ? `${log.duration % 60}` : ""}
                      </div>
                      <div className="hidden gap-0.5 @min-[5.5rem]:flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={i}
                            className={`text-xs ${i < log.quality ? "text-yellow-500" : "text-muted-foreground/40"}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                }}
              />

              {/* Dialog pour ajout/édition */}
              <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
                <DialogContent className="max-w-[90vw] sm:max-w-2xl max-h-[90vh] overflow-y-hidden">
                  <DialogHeader>
                    <DialogTitle>Enregistrer le sommeil</DialogTitle>
                    <DialogDescription>
                      {new Date(newLog.date || getToday()).toLocaleDateString("fr-FR", { dateStyle: "full" })}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col items-start">
                        <Label>Heure de coucher</Label>
                        <Input
                          type="time"
                          className="w-[120px] sm:w-full"
                          value={newLog.bedTime}
                          onChange={(e) => setNewLog({ ...newLog, bedTime: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col items-start">
                        <Label>Heure de réveil</Label>
                        <Input
                          type="time"
                          className="w-[120px] sm:w-full"
                          value={newLog.wakeTime}
                          onChange={(e) => setNewLog({ ...newLog, wakeTime: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label>Qualité du sommeil</Label>
                      <div className="flex gap-2 mt-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Button
                            key={value}
                            type="button"
                            variant={newLog.quality === value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setNewLog({ ...newLog, quality: value as 1 | 2 | 3 | 4 | 5 })}
                          >
                            {Array.from({ length: value }).map((_, i) => (
                              <span key={i}>★</span>
                            ))}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label>Notes (optionnel)</Label>
                      <Input
                        placeholder="Ex: Réveils nocturnes, rêves..."
                        value={newLog.notes || ""}
                        onChange={(e) => setNewLog({ ...newLog, notes: e.target.value })}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    {getSleepLogForDate(newLog.date || getToday()) && (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          const log = getSleepLogForDate(newLog.date || getToday())
                          if (log) deleteSleepLog(log.id)
                          setShowAddForm(false)
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setShowAddForm(false)}>
                      Annuler
                    </Button>
                    <Button onClick={addSleepLog}>Enregistrer</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistiques */}
        <TabsContent value="stats" className="space-y-6">
          <div className="grid gap-4 grid-cols-3" >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Sommeil moyen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-3xl font-bold">
                  {Math.floor(avgSleepDuration / 60)}h{avgSleepDuration % 60 > 0 ? ` ${avgSleepDuration % 60}min` : ""}
                </div>
                <p className="text-[0.625rem] sm:text-xs text-muted-foreground">7 derniers jours</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Qualité moyenne</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-3xl font-bold">{avgQuality}/5</div>
                <div className="flex gap-1 mt-2 justify-center sm:justify-start">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={i < Math.round(Number(avgQuality)) ? "text-yellow-500" : "text-gray-300"}>
                      ★
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Dette de sommeil</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-3xl font-bold">
                  {Math.floor(sleepDebt / 60)}h{sleepDebt % 60 > 0 ? ` ${sleepDebt % 60}min` : ""}
                </div>
                <p className="text-[0.625rem] sm:text-xs text-muted-foreground">
                  {sleepDebt === 0 ? "Excellent !" : "À récupérer"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Conseils pour un meilleur sommeil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold">🎯 Objectif recommandé</h4>
                <p className="text-sm text-muted-foreground">
                  Les adultes ont besoin de <strong>7 à 9 heures</strong> de sommeil par nuit.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">💡 Bonnes pratiques</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Gardez un horaire de coucher régulier</li>
                  <li>Évitez les écrans 1h avant de dormir</li>
                  <li>Maintenez votre chambre fraîche (18-20°C)</li>
                  <li>Évitez la caféine après 15h</li>
                  <li>Faites de l'exercice, mais pas juste avant de dormir</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
