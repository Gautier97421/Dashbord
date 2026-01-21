export type Priority = "low" | "medium" | "high"
export type TaskStatus = "todo" | "in-progress" | "done"
export type TimeFrame = "day" | "week" | "month" | "year"
export type RoutineCategory = "health" | "sport" | "mental" | "work" | "personal"
export type ActivityType = "gym" | "running" | "climbing" | "other"
export type FitnessGoal = "weight-loss" | "muscle-gain" | "maintenance"
export type WidgetType =
  | "routine-progress"
  | "missions-stats"
  | "tasks-stats"
  | "projects-stats"
  | "routine-list"
  | "today-missions"
  | "week-missions"
  | "active-projects"
  | "sleep-summary"
  | "sleep-bedtime-cycles"
  | "sleep-quality-avg"
  | "sleep-duration-avg"
  | "sleep-last-night"
  | "night-routine-progress"
  | "night-routine-list"
  | "workout-summary"
  | "workout-week-count"
  | "workout-last-session"
  | "workout-calories"
  | "nutrition-daily"
  | "nutrition-macros"
  | "routine-streak"
  | "mission-priority-high"
  | "tasks-today"
  | "tasks-urgent"
  | "project-progress"

export interface DashboardWidget {
  id: string
  type: WidgetType
  enabled: boolean
  order: number
  width: 1 | 2 | 3 | 4
  height: 1 | 2
}

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

// Sleep Tracking
export interface SleepLog {
  id: string
  date: string
  bedTime: string
  wakeTime: string
  duration: number // minutes
  quality: 1 | 2 | 3 | 4 | 5
  notes?: string
}

// Sport & Fitness
export interface WorkoutSession {
  id: string
  date: string
  type: ActivityType
  customType?: string // Sport personnalisé si type === "other"
  duration: number // minutes
  notes?: string
  intensity: "light" | "moderate" | "intense"
  completed?: boolean // Pour valider la séance
  programId?: string // Lié à un programme
  missionId?: string // Lié à une mission
}

export interface WorkoutProgramSession {
  id: string
  dayOfWeek: number // 0=Dimanche, 1=Lundi, etc.
  type: ActivityType
  customType?: string
  duration: number
  intensity: "light" | "moderate" | "intense"
  time?: string // Heure facultative (format HH:mm)
  notes?: string
}

export interface WorkoutProgram {
  id: string
  name: string
  description?: string
  sessions: WorkoutProgramSession[]
  active: boolean
  autoCreateMissions: boolean // Créer automatiquement les missions
  createdAt: string
}

export interface PersonalRecord {
  id: string
  exercise: string
  value: number
  reps?: number // Nombre de répétitions
  unit: string // kg, reps, km, etc.
  date: string
}

export interface FitnessProfile {
  age: number
  weight: number
  height: number
  gender: "male" | "female" | "other"
  goal: FitnessGoal
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very-active"
  targetWeight?: number
}

export interface DailyNutrition {
  id: string
  date: string
  calories: number
  protein: number
  carbs: number
  fats: number
  meals: Meal[]
}

export interface Meal {
  id: string
  name: string
  time: string
  calories: number
  protein: number
  carbs: number
  fats: number
}

// Night Routine
export interface NightRoutineAction {
  id: string
  name: string
  importance: Priority
  createdAt: string
}

export interface NightRoutineLog {
  id: string
  actionId: string
  date: string
  completed: boolean
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
  nightRoutineActions: NightRoutineAction[]
  nightRoutineLogs: NightRoutineLog[]
  tasks: Task[]
  missions: Mission[]
  projects: Project[]
  calendarEvents: CalendarEvent[]
  dailyInsights: DailyInsight[]
  sleepLogs: SleepLog[]
  workoutSessions: WorkoutSession[]
  workoutPrograms: WorkoutProgram[]
  personalRecords: PersonalRecord[]
  fitnessProfile: FitnessProfile | null
  dailyNutrition: DailyNutrition[]
  dashboardWidgets: DashboardWidget[]
  settings: UserSettings
}

export type AppAction =
  | { type: "LOAD_STATE"; payload: AppState }
  | { type: "ADD_ROUTINE_ACTION"; payload: RoutineAction }
  | { type: "UPDATE_ROUTINE_ACTION"; payload: RoutineAction }
  | { type: "DELETE_ROUTINE_ACTION"; payload: string }
  | { type: "REORDER_ROUTINE_ACTIONS"; payload: RoutineAction[] }
  | { type: "LOG_ROUTINE"; payload: RoutineLog }
  | { type: "ADD_NIGHT_ROUTINE_ACTION"; payload: NightRoutineAction }
  | { type: "UPDATE_NIGHT_ROUTINE_ACTION"; payload: NightRoutineAction }
  | { type: "DELETE_NIGHT_ROUTINE_ACTION"; payload: string }
  | { type: "REORDER_NIGHT_ROUTINE_ACTIONS"; payload: NightRoutineAction[] }
  | { type: "LOG_NIGHT_ROUTINE"; payload: NightRoutineLog }
  | { type: "ADD_TASK"; payload: Task }
  | { type: "UPDATE_TASK"; payload: Task }
  | { type: "DELETE_TASK"; payload: string }
  | { type: "ADD_MISSION"; payload: Mission }
  | { type: "UPDATE_MISSION"; payload: Mission }
  | { type: "DELETE_MISSION"; payload: string }
  | { type: "ADD_PROJECT"; payload: Project }
  | { type: "UPDATE_PROJECT"; payload: Project }
  | { type: "DELETE_PROJECT"; payload: string }
  | { type: "ADD_EVENT"; payload: CalendarEvent }
  | { type: "UPDATE_EVENT"; payload: CalendarEvent }
  | { type: "DELETE_EVENT"; payload: string }
  | { type: "ADD_SLEEP_LOG"; payload: SleepLog }
  | { type: "UPDATE_SLEEP_LOG"; payload: SleepLog }
  | { type: "DELETE_SLEEP_LOG"; payload: string }
  | { type: "ADD_WORKOUT"; payload: WorkoutSession }
  | { type: "UPDATE_WORKOUT"; payload: WorkoutSession }
  | { type: "DELETE_WORKOUT"; payload: string }
  | { type: "ADD_WORKOUT_PROGRAM"; payload: WorkoutProgram }
  | { type: "UPDATE_WORKOUT_PROGRAM"; payload: WorkoutProgram }
  | { type: "DELETE_WORKOUT_PROGRAM"; payload: string }
  | { type: "ADD_PERSONAL_RECORD"; payload: PersonalRecord }
  | { type: "UPDATE_PERSONAL_RECORD"; payload: PersonalRecord }
  | { type: "DELETE_PERSONAL_RECORD"; payload: string }
  | { type: "UPDATE_FITNESS_PROFILE"; payload: FitnessProfile }
  | { type: "ADD_DAILY_NUTRITION"; payload: DailyNutrition }
  | { type: "UPDATE_DAILY_NUTRITION"; payload: DailyNutrition }
  | { type: "DELETE_DAILY_NUTRITION"; payload: string }
  | { type: "UPDATE_DASHBOARD_WIDGETS"; payload: DashboardWidget[] }
  | { type: "UPDATE_SETTINGS"; payload: Partial<UserSettings> }
  | { type: "LIKE_INSIGHT"; payload: string }
  | { type: "HIDE_INSIGHT"; payload: string }
