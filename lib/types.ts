export type Priority = "low" | "medium" | "high" | "urgent"
export type TaskStatus = "todo" | "in_progress" | "waiting" | "done"
export type Recurrence = "daily" | "weekly" | "monthly"
export type TimeFrame = "day" | "week" | "month" | "year"
export type RoutineCategory = "health" | "sport" | "mental" | "work" | "personal"
export type ActivityType = "gym" | "running" | "climbing" | "other"
export type FitnessGoal = "weight_loss" | "muscle_gain" | "maintenance"
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
  height: 1 | 2 | 3 | 4 | 5 | 6 // Desktop: max 2, Mobile: max 6
  // Position dans la grille (4x4 desktop, 2x6 mobile)
  row?: number // Desktop: 0-3, Mobile: 0-5
  col?: number // Desktop: 0-3, Mobile: 0-1
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
  updatedAt?: string
  startDate?: string
  notes?: string
  // Sous-tâches / checklist
  checklist?: ChecklistItem[]
  links?: ProjectLink[]
  // Tâches à terminer avant celle-ci
  dependsOn?: string[]
  // Terminer une tâche récurrente recrée la suivante
  recurrence?: Recurrence | null
  // Position dans sa colonne Kanban et dans la liste du projet
  order?: number
  // Affichée aussi dans le calendrier principal, à son échéance
  showInCalendar?: boolean
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
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
  // État choisi à la main (pas commencé, en cours, fini) ; absent ou null = aucun état affiché
  status?: ProjectStatus | null
  // Projet parent (absent ou null = projet racine)
  parentId?: string | null
  // Liens utiles : dossier local, app en ligne, documentation, dépôt…
  links?: ProjectLink[]
  updatedAt?: string
  notes?: string
  priority?: Priority | null
  startDate?: string
  // Catégorie libre (Perso, Travail, Client…)
  category?: string
  favorite?: boolean
  // Position parmi les projets du même parent
  order?: number
  // Échéance affichée aussi dans le calendrier principal
  showInCalendar?: boolean
}

export type ProjectStatus = "not_started" | "in_progress" | "done"

export interface ProjectLink {
  id: string
  label: string
  // URL web (https://…) ou chemin local (C:\…, \\serveur\…, /home/…)
  url: string
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

// Notes
export interface Note {
  id: string
  title: string
  content: string
  color?: string
  pinned: boolean
  createdAt: string
  updatedAt: string
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
  id?: string
  age: number
  weight: number
  height: number
  gender: "male" | "female" | "other"
  goal: FitnessGoal
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active"
  targetWeight?: number
  customCalories?: number | null
  customProtein?: number | null
  customCarbs?: number | null
  customFats?: number | null
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
  recipeId?: string | null
}

export interface MealPreset {
  id: string
  name: string
  category: "breakfast" | "lunch" | "snack" | "dinner"
  calories: number
  protein: number
  carbs: number
  fats: number
}

export interface RecipeIngredient {
  name: string
  quantity: string
  unit: string
}

export interface Recipe {
  id: string
  name: string
  description?: string
  ingredients: RecipeIngredient[]
  protein?: number
  carbs?: number
  fat?: number
  calories?: number
  prepTime?: number
  cookTime?: number
  servings?: number
  category?: string
  imageUrl?: string
  createdAt: string
  updatedAt: string
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
  notes: Note[]
  recipes: Recipe[]
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
  // Modifications partielles groupées (glisser-déposer : positions de plusieurs éléments)
  | { type: "PATCH_TASKS"; payload: { id: string; changes: Partial<Task> }[] }
  | { type: "PATCH_PROJECTS"; payload: { id: string; changes: Partial<Project> }[] }
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
  | { type: "ADD_NOTE"; payload: Note }
  | { type: "UPDATE_NOTE"; payload: Note }
  | { type: "DELETE_NOTE"; payload: string }
  | { type: "UPDATE_DASHBOARD_WIDGETS"; payload: DashboardWidget[] }
  | { type: "UPDATE_SETTINGS"; payload: Partial<UserSettings> }
  | { type: "LIKE_INSIGHT"; payload: string }
  | { type: "HIDE_INSIGHT"; payload: string }
