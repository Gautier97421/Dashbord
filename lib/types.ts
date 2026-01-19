export type Priority = "low" | "medium" | "high"
export type TaskStatus = "todo" | "in-progress" | "done"
export type TimeFrame = "day" | "week" | "month" | "year"
export type RoutineCategory = "health" | "sport" | "mental" | "work" | "personal"

export interface RoutineAction {
  id: string
  name: string
  category: RoutineCategory
  importance: Priority
  createdAt: string
}

export interface RoutineLog {
  id: string
  actionId: string
  date: string
  completed: boolean
}

export interface Task {
  id: string
  title: string
  description?: string
  priority: Priority
  status: TaskStatus
  dueDate?: string
  missionId?: string
  projectId?: string
  createdAt: string
  completedAt?: string
}

export interface Mission {
  id: string
  title: string
  description?: string
  timeFrame: TimeFrame
  priority: Priority
  status: TaskStatus
  tasks: Task[]
  dueDate?: string
  createdAt: string
  completedAt?: string
}

export interface Project {
  id: string
  title: string
  description?: string
  objectives: string[]
  tasks: Task[]
  deadline?: string
  createdAt: string
  completedAt?: string
}

export interface CalendarEvent {
  id: string
  title: string
  date: string
  startTime?: string
  endTime?: string
  priority: Priority
  isRecurring: boolean
  recurrencePattern?: "daily" | "weekly" | "monthly"
  missionId?: string
  projectId?: string
  completed: boolean
}

export interface DailyInsight {
  id: string
  content: string
  category: "productivity" | "health" | "motivation" | "funfact"
  liked: boolean
  hidden: boolean
}

export interface UserSettings {
  theme: "light" | "dark" | "system"
  dayStartHour: number
  dayEndHour: number
  showRoutines: boolean
  showStats: boolean
  showDailyInsight: boolean
}

export interface AppState {
  routineActions: RoutineAction[]
  routineLogs: RoutineLog[]
  tasks: Task[]
  missions: Mission[]
  projects: Project[]
  calendarEvents: CalendarEvent[]
  dailyInsights: DailyInsight[]
  settings: UserSettings
}
