"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
} from "recharts"
import {
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle2,
  Flame,
  Calendar,
  Award,
  AlertTriangle,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { getToday, calculateStreak } from "@/lib/store"
import { cn } from "@/lib/utils"

export function StatisticsPage() {
  const { state } = useApp()
  const today = getToday()

  // Calculate routine statistics
  const routineStats = useMemo(() => {
    const last30Days: string[] = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      last30Days.push(date.toISOString().split("T")[0])
    }

    const dailyCompletion = last30Days.map((date) => {
      const logs = state.routineLogs.filter((l) => l.date === date && l.completed)
      const total = state.routineActions.length
      const completed = logs.length
      return {
        date,
        shortDate: new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
        completed,
        total,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      }
    })

    const totalCompleted = state.routineLogs.filter((l) => l.completed).length
    const totalPossible = last30Days.length * state.routineActions.length
    const overallRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0

    // Current month vs previous month
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
    const prevMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0)

    const currentMonthLogs = state.routineLogs.filter((l) => {
      const d = new Date(l.date)
      return d >= currentMonthStart && l.completed
    }).length

    const prevMonthLogs = state.routineLogs.filter((l) => {
      const d = new Date(l.date)
      return d >= prevMonthStart && d <= prevMonthEnd && l.completed
    }).length

    const monthChange = prevMonthLogs > 0
      ? Math.round(((currentMonthLogs - prevMonthLogs) / prevMonthLogs) * 100)
      : 0

    return {
      dailyCompletion,
      overallRate,
      totalCompleted,
      monthChange,
      currentMonthLogs,
      prevMonthLogs,
    }
  }, [state.routineLogs, state.routineActions.length])

  // Calculate mission statistics
  const missionStats = useMemo(() => {
    const total = state.missions.length
    const completed = state.missions.filter((m) => m.status === "done").length
    const inProgress = state.missions.filter((m) => m.status === "in-progress").length
    const todo = state.missions.filter((m) => m.status === "todo").length

    const byTimeFrame = {
      day: state.missions.filter((m) => m.timeFrame === "day"),
      week: state.missions.filter((m) => m.timeFrame === "week"),
      month: state.missions.filter((m) => m.timeFrame === "month"),
      year: state.missions.filter((m) => m.timeFrame === "year"),
    }

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      total,
      completed,
      inProgress,
      todo,
      byTimeFrame,
      completionRate,
    }
  }, [state.missions])

  // Calculate project statistics
  const projectStats = useMemo(() => {
    const total = state.projects.length
    const active = state.projects.filter((p) => !p.completedAt).length
    const completed = state.projects.filter((p) => p.completedAt).length

    const projectProgress = state.projects.map((p) => {
      const taskCount = p.tasks.length
      const completedTasks = p.tasks.filter((t) => t.status === "done").length
      return {
        name: p.title.length > 15 ? p.title.substring(0, 15) + "..." : p.title,
        progress: taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0,
        tasks: taskCount,
        completed: completedTasks,
      }
    })

    return {
      total,
      active,
      completed,
      projectProgress,
    }
  }, [state.projects])

  // Routine streaks and weak points
  const routineInsights = useMemo(() => {
    const actionStats = state.routineActions.map((action) => {
      const streak = calculateStreak(state.routineLogs, action.id)
      const last7Days: string[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        last7Days.push(date.toISOString().split("T")[0])
      }

      const completedLast7 = state.routineLogs.filter(
        (l) => l.actionId === action.id && last7Days.includes(l.date) && l.completed
      ).length

      return {
        ...action,
        streak,
        last7DaysRate: Math.round((completedLast7 / 7) * 100),
      }
    })

    const strongHabits = actionStats.filter((a) => a.last7DaysRate >= 70).sort((a, b) => b.last7DaysRate - a.last7DaysRate)
    const weakHabits = actionStats.filter((a) => a.last7DaysRate < 50).sort((a, b) => a.last7DaysRate - b.last7DaysRate)
    const bestStreak = actionStats.reduce((max, a) => a.streak.current > max.streak.current ? a : max, actionStats[0])

    return {
      actionStats,
      strongHabits,
      weakHabits,
      bestStreak,
    }
  }, [state.routineActions, state.routineLogs])

  // Productivity by day of week
  const weekdayStats = useMemo(() => {
    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
    const stats = days.map((day, index) => {
      const logsForDay = state.routineLogs.filter((l) => {
        const d = new Date(l.date)
        return d.getDay() === index && l.completed
      })
      return {
        day,
        count: logsForDay.length,
      }
    })

    // Reorder to start from Monday
    return [...stats.slice(1), stats[0]]
  }, [state.routineLogs])

  const chartConfig = {
    rate: {
      label: "Taux",
      color: "hsl(var(--primary))",
    },
    completed: {
      label: "Complétées",
      color: "hsl(var(--success))",
    },
    count: {
      label: "Actions",
      color: "hsl(var(--chart-1))",
    },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Statistiques</h1>
        <p className="text-muted-foreground">Analysez vos performances et identifiez vos points forts</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taux routine (30j)</p>
                <p className="text-2xl font-bold">{routineStats.overallRate}%</p>
              </div>
              <div className={cn(
                "flex items-center gap-1 text-sm",
                routineStats.monthChange >= 0 ? "text-success" : "text-destructive"
              )}>
                {routineStats.monthChange >= 0 ? (
                  <TrendingUp className="size-4" />
                ) : (
                  <TrendingDown className="size-4" />
                )}
                {Math.abs(routineStats.monthChange)}%
              </div>
            </div>
            <Progress value={routineStats.overallRate} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missions complétées</p>
                <p className="text-2xl font-bold">{missionStats.completed}/{missionStats.total}</p>
              </div>
              <div className="rounded-full bg-primary/10 p-2">
                <Target className="size-5 text-primary" />
              </div>
            </div>
            <Progress value={missionStats.completionRate} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projets actifs</p>
                <p className="text-2xl font-bold">{projectStats.active}</p>
              </div>
              <div className="rounded-full bg-accent/10 p-2">
                <CheckCircle2 className="size-5 text-accent" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {projectStats.completed} projets terminés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Meilleure série</p>
                <p className="text-2xl font-bold">
                  {routineInsights.bestStreak?.streak.current || 0}j
                </p>
              </div>
              <div className="rounded-full bg-orange-500/10 p-2">
                <Flame className="size-5 text-orange-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 truncate">
              {routineInsights.bestStreak?.name || "Aucune série"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Routine Completion Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-5" />
              Progression routine (30 jours)
            </CardTitle>
            <CardDescription>Taux de complétion quotidien</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <AreaChart
                data={routineStats.dailyCompletion.slice(-14)}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="shortDate"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorRate)"
                  name="Taux"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Productivity by Day of Week */}
        <Card>
          <CardHeader>
            <CardTitle>Productivité par jour</CardTitle>
            <CardDescription>Vos jours les plus productifs</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={weekdayStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-1))"
                  radius={[4, 4, 0, 0]}
                  name="Actions"
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Mission Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition des missions</CardTitle>
            <CardDescription>Par statut et période</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {/* By Status */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Par statut</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded-full bg-muted-foreground" />
                      <span className="text-sm">À faire</span>
                    </div>
                    <span className="text-sm font-medium">{missionStats.todo}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded-full bg-primary" />
                      <span className="text-sm">En cours</span>
                    </div>
                    <span className="text-sm font-medium">{missionStats.inProgress}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded-full bg-success" />
                      <span className="text-sm">Terminé</span>
                    </div>
                    <span className="text-sm font-medium">{missionStats.completed}</span>
                  </div>
                </div>
              </div>

              {/* By Time Frame */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Par période</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Jour</span>
                    <Badge variant="secondary">{missionStats.byTimeFrame.day.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Semaine</span>
                    <Badge variant="secondary">{missionStats.byTimeFrame.week.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Mois</span>
                    <Badge variant="secondary">{missionStats.byTimeFrame.month.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Année</span>
                    <Badge variant="secondary">{missionStats.byTimeFrame.year.length}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Avancement des projets</CardTitle>
            <CardDescription>Progression de chaque projet actif</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projectStats.projectProgress.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Aucun projet en cours
                </p>
              ) : (
                projectStats.projectProgress.slice(0, 5).map((project, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{project.name}</span>
                      <span className="text-muted-foreground">
                        {project.completed}/{project.tasks} tâches
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={project.progress} className="h-2 flex-1" />
                      <span className="text-sm font-medium w-12 text-right">{project.progress}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Strong Habits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-5 text-yellow-500" />
              Habitudes fortes
            </CardTitle>
            <CardDescription>Vos routines les plus constantes (7 derniers jours)</CardDescription>
          </CardHeader>
          <CardContent>
            {routineInsights.strongHabits.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Continuez vos efforts pour développer des habitudes fortes !
              </p>
            ) : (
              <div className="space-y-3">
                {routineInsights.strongHabits.slice(0, 5).map((habit) => (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between rounded-lg border border-success/30 bg-success/5 p-3"
                  >
                    <div>
                      <p className="font-medium">{habit.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {habit.category}
                        </Badge>
                        {habit.streak.current > 0 && (
                          <div className="flex items-center gap-1 text-orange-500">
                            <Flame className="size-3" />
                            <span className="text-xs">{habit.streak.current}j</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-success">{habit.last7DaysRate}%</p>
                      <p className="text-xs text-muted-foreground">cette semaine</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weak Habits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" />
              Points d&apos;amélioration
            </CardTitle>
            <CardDescription>Routines nécessitant plus d&apos;attention</CardDescription>
          </CardHeader>
          <CardContent>
            {routineInsights.weakHabits.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Excellent ! Toutes vos habitudes sont bien maintenues.
              </p>
            ) : (
              <div className="space-y-3">
                {routineInsights.weakHabits.slice(0, 5).map((habit) => (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-3"
                  >
                    <div>
                      <p className="font-medium">{habit.name}</p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {habit.category}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-warning">{habit.last7DaysRate}%</p>
                      <p className="text-xs text-muted-foreground">cette semaine</p>
                    </div>
                  </div>
                ))}

                <p className="text-sm text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
                  Conseil : Commencez petit. Même 5 minutes par jour peuvent créer une habitude durable.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
