"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  CheckCircle2,
  Circle,
  Clock,
  Target,
  TrendingUp,
  Lightbulb,
  Heart,
  X,
  ChevronRight,
  Flame,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { getToday, formatDateFr, calculateStreak, generateId } from "@/lib/store"
import type { NavPage } from "@/components/app-sidebar"

interface DashboardPageProps {
  onNavigate: (page: NavPage) => void
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { state, dispatch } = useApp()
  const today = getToday()

  const todayLogs = useMemo(() => {
    return state.routineLogs.filter((l) => l.date === today)
  }, [state.routineLogs, today])

  const routineProgress = useMemo(() => {
    const total = state.routineActions.length
    if (total === 0) return 0
    const completed = todayLogs.filter((l) => l.completed).length
    return Math.round((completed / total) * 100)
  }, [state.routineActions.length, todayLogs])

  const todayMissions = useMemo(() => {
    return state.missions.filter((m) => m.timeFrame === "day" && m.status !== "done").slice(0, 3)
  }, [state.missions])

  const weekMissions = useMemo(() => {
    return state.missions.filter((m) => m.timeFrame === "week" && m.status !== "done").slice(0, 3)
  }, [state.missions])

  const activeProjects = useMemo(() => {
    return state.projects.filter((p) => !p.completedAt).slice(0, 3)
  }, [state.projects])

  const visibleInsight = useMemo(() => {
    return state.dailyInsights.find((i) => !i.hidden)
  }, [state.dailyInsights])

  const stats = useMemo(() => {
    const completedMissions = state.missions.filter((m) => m.status === "done").length
    const totalMissions = state.missions.length
    const completedTasks = state.tasks.filter((t) => t.status === "done").length
    const totalTasks = state.tasks.length

    return {
      missionsCompleted: completedMissions,
      missionsTotal: totalMissions,
      tasksCompleted: completedTasks,
      tasksTotal: totalTasks,
      projectsActive: state.projects.filter((p) => !p.completedAt).length,
    }
  }, [state.missions, state.tasks, state.projects])

  const toggleRoutine = (actionId: string) => {
    const existingLog = todayLogs.find((l) => l.actionId === actionId)
    dispatch({
      type: "LOG_ROUTINE",
      payload: {
        id: existingLog?.id || generateId(),
        actionId,
        date: today,
        completed: !existingLog?.completed,
      },
    })
  }

  const getProjectProgress = (projectId: string) => {
    const projectTasks = state.tasks.filter((t) => t.projectId === projectId)
    if (projectTasks.length === 0) return 0
    const completed = projectTasks.filter((t) => t.status === "done").length
    return Math.round((completed / projectTasks.length) * 100)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bonjour !</h1>
        <p className="text-muted-foreground">
          {formatDateFr(new Date(), "full")} - Prêt pour une journée productive ?
        </p>
      </div>

      {/* Daily Insight */}
      {state.settings.showDailyInsight && visibleInsight && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-4 p-4">
            <div className="rounded-full bg-primary/10 p-2">
              <Lightbulb className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{visibleInsight.content}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {visibleInsight.category === "productivity"
                    ? "Productivité"
                    : visibleInsight.category === "health"
                      ? "Santé"
                      : visibleInsight.category === "motivation"
                        ? "Motivation"
                        : "Fun fact"}
                </Badge>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => dispatch({ type: "LIKE_INSIGHT", payload: visibleInsight.id })}
              >
                <Heart className={`size-4 ${visibleInsight.liked ? "fill-red-500 text-red-500" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => dispatch({ type: "HIDE_INSIGHT", payload: visibleInsight.id })}
              >
                <X className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Routine du jour</p>
                <p className="text-2xl font-bold">{routineProgress}%</p>
              </div>
              <div className="rounded-full bg-success/10 p-2">
                <CheckCircle2 className="size-5 text-success" />
              </div>
            </div>
            <Progress value={routineProgress} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missions</p>
                <p className="text-2xl font-bold">
                  {stats.missionsCompleted}/{stats.missionsTotal}
                </p>
              </div>
              <div className="rounded-full bg-primary/10 p-2">
                <Target className="size-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tâches</p>
                <p className="text-2xl font-bold">
                  {stats.tasksCompleted}/{stats.tasksTotal}
                </p>
              </div>
              <div className="rounded-full bg-accent/10 p-2">
                <CheckCircle2 className="size-5 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projets actifs</p>
                <p className="text-2xl font-bold">{stats.projectsActive}</p>
              </div>
              <div className="rounded-full bg-warning/10 p-2">
                <TrendingUp className="size-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Morning Routine */}
        {state.settings.showRoutines && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Routine matinale</CardTitle>
                <CardDescription>
                  {todayLogs.filter((l) => l.completed).length}/{state.routineActions.length} complétées
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("routine")}>
                Voir tout
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {state.routineActions.slice(0, 5).map((action) => {
                const log = todayLogs.find((l) => l.actionId === action.id)
                const isCompleted = log?.completed || false
                const streak = calculateStreak(state.routineLogs, action.id)

                return (
                  <div
                    key={action.id}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isCompleted}
                        onCheckedChange={() => toggleRoutine(action.id)}
                      />
                      <div>
                        <p className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                          {action.name}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">{action.category}</p>
                      </div>
                    </div>
                    {streak.current > 0 && (
                      <div className="flex items-center gap-1 text-orange-500">
                        <Flame className="size-4" />
                        <span className="text-xs font-medium">{streak.current}j</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Today's Missions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Missions du jour</CardTitle>
              <CardDescription>{todayMissions.length} missions en attente</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("missions")}>
              Voir tout
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayMissions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucune mission pour aujourd&apos;hui. Ajoutez-en une !
              </p>
            ) : (
              todayMissions.map((mission) => (
                <div
                  key={mission.id}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {mission.status === "done" ? (
                      <CheckCircle2 className="size-5 text-success" />
                    ) : mission.status === "in-progress" ? (
                      <Clock className="size-5 text-primary" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{mission.title}</p>
                      {mission.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{mission.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      mission.priority === "high"
                        ? "destructive"
                        : mission.priority === "medium"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {mission.priority === "high" ? "Haute" : mission.priority === "medium" ? "Moyenne" : "Basse"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Week Missions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Missions de la semaine</CardTitle>
              <CardDescription>{weekMissions.length} missions cette semaine</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("missions")}>
              Voir tout
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {weekMissions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucune mission pour cette semaine.
              </p>
            ) : (
              weekMissions.map((mission) => (
                <div
                  key={mission.id}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {mission.status === "done" ? (
                      <CheckCircle2 className="size-5 text-success" />
                    ) : mission.status === "in-progress" ? (
                      <Clock className="size-5 text-primary" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground" />
                    )}
                    <p className="text-sm font-medium">{mission.title}</p>
                  </div>
                  <Badge variant="outline">{mission.tasks.length} tâches</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Active Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Projets en cours</CardTitle>
              <CardDescription>{activeProjects.length} projets actifs</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("projects")}>
              Voir tout
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucun projet en cours. Créez votre premier projet !
              </p>
            ) : (
              activeProjects.map((project) => {
                const progress = getProjectProgress(project.id)
                return (
                  <div key={project.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{project.title}</p>
                      <span className="text-xs text-muted-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                    {project.deadline && (
                      <p className="text-xs text-muted-foreground">
                        Échéance : {formatDateFr(project.deadline, "short")}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
