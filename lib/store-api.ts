import { useContext, createContext, useReducer, useEffect, useState, ReactNode } from 'react'
import {
  AppState,
  AppAction,
  RoutineAction,
  NightRoutineAction,
  Task,
  Mission,
  Project,
  SleepLog,
  WorkoutSession,
  WorkoutProgram,
  DashboardWidget,
  UserSettings,
} from './types'
import * as api from './api'

// Initial state
export const defaultState: AppState = {
  routineActions: [],
  routineLogs: [],
  nightRoutineActions: [],
  nightRoutineLogs: [],
  tasks: [],
  missions: [],
  projects: [],
  calendarEvents: [],
  dailyInsights: [],
  sleepLogs: [],
  workoutSessions: [],
  workoutPrograms: [],
  personalRecords: [],
  fitnessProfile: null,
  dailyNutrition: [],
  dashboardWidgets: [],
  settings: {
    theme: "system",
    dayStartHour: 6,
    dayEndHour: 22,
    showRoutines: true,
    showStats: true,
    showDailyInsight: true,
  },
}

// Context
const AppContext = createContext<{
  state: AppState
  dispatch: React.Dispatch<AppAction>
  loadData: () => Promise<void>
  isLoading: boolean
} | null>(null)

// Reducer (simplified for API-based operations)
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "LOAD_STATE":
      return { ...state, ...action.payload }

    // Optimistic updates - these will be handled by API calls
    case "ADD_ROUTINE_ACTION":
    case "UPDATE_ROUTINE_ACTION":
    case "DELETE_ROUTINE_ACTION":
    case "ADD_NIGHT_ROUTINE_ACTION":
    case "UPDATE_NIGHT_ROUTINE_ACTION":
    case "DELETE_NIGHT_ROUTINE_ACTION":
    case "ADD_TASK":
    case "UPDATE_TASK":
    case "DELETE_TASK":
    case "ADD_MISSION":
    case "UPDATE_MISSION":
    case "DELETE_MISSION":
    case "ADD_PROJECT":
    case "UPDATE_PROJECT":
    case "DELETE_PROJECT":
    case "ADD_SLEEP_LOG":
    case "UPDATE_SLEEP_LOG":
    case "DELETE_SLEEP_LOG":
    case "ADD_WORKOUT":
    case "UPDATE_WORKOUT":
    case "DELETE_WORKOUT":
    case "ADD_WORKOUT_PROGRAM":
    case "UPDATE_WORKOUT_PROGRAM":
    case "DELETE_WORKOUT_PROGRAM":
    case "UPDATE_DASHBOARD_WIDGETS":
      // For now, return state as-is. API calls will handle updates
      return state

    case "LOG_ROUTINE":
      return {
        ...state,
        routineLogs: state.routineLogs.some(log => log.actionId === action.payload.actionId && log.date === action.payload.date)
          ? state.routineLogs.map(log =>
              log.actionId === action.payload.actionId && log.date === action.payload.date
                ? action.payload
                : log
            )
          : [...state.routineLogs, action.payload],
      }

    case "LOG_NIGHT_ROUTINE":
      return {
        ...state,
        nightRoutineLogs: state.nightRoutineLogs.some(log => log.actionId === action.payload.actionId && log.date === action.payload.date)
          ? state.nightRoutineLogs.map(log =>
              log.actionId === action.payload.actionId && log.date === action.payload.date
                ? action.payload
                : log
            )
          : [...state.nightRoutineLogs, action.payload],
      }

    case "UPDATE_SETTINGS":
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      }

    default:
      return state
  }
}

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, defaultState)
  const [isLoading, setIsLoading] = useState(true)

  // Load all data from APIs
  const loadData = async () => {
    setIsLoading(true)
    try {
      const [
        routineActions,
        routineLogs,
        nightRoutineActions,
        nightRoutineLogs,
        tasks,
        missions,
        projects,
        sleepLogs,
        workoutSessions,
        workoutPrograms,
        dashboardWidgets,
      ] = await Promise.all([
        api.routinesApi.getActions(),
        api.routinesApi.getLogs(),
        api.nightRoutinesApi.getActions(),
        api.nightRoutinesApi.getLogs(),
        api.tasksApi.getAll(),
        api.missionsApi.getAll(),
        api.projectsApi.getAll(),
        api.sleepApi.getAll(),
        api.workoutsApi.getAll(),
        api.workoutProgramsApi.getAll(),
        api.dashboardApi.getWidgets(),
      ])

      // Transform Prisma data to match our types
      const transformedState: Partial<AppState> = {
        routineActions: routineActions.map((action: any) => ({
          id: action.id,
          name: action.name,
          category: action.category,
          importance: action.importance,
          createdAt: action.createdAt.toISOString(),
        })),
        routineLogs: routineLogs.map((log: any) => ({
          id: log.id,
          actionId: log.actionId,
          date: log.date,
          completed: log.completed,
        })),
        nightRoutineActions: nightRoutineActions.map((action: any) => ({
          id: action.id,
          name: action.name,
          importance: action.importance,
          createdAt: action.createdAt.toISOString(),
        })),
        nightRoutineLogs: nightRoutineLogs.map((log: any) => ({
          id: log.id,
          actionId: log.actionId,
          date: log.date,
          completed: log.completed,
        })),
        tasks: tasks.map((task: any) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          dueDate: task.dueDate,
          missionId: task.missionId,
          projectId: task.projectId,
          createdAt: task.createdAt.toISOString(),
          completedAt: task.completedAt,
        })),
        missions: missions.map((mission: any) => ({
          id: mission.id,
          title: mission.title,
          description: mission.description,
          timeFrame: mission.timeFrame,
          priority: mission.priority,
          status: mission.status,
          dueDate: mission.dueDate,
          createdAt: mission.createdAt.toISOString(),
          completedAt: mission.completedAt,
          tasks: mission.tasks || [],
        })),
        projects: projects.map((project: any) => ({
          id: project.id,
          title: project.title,
          description: project.description,
          objectives: project.objectives,
          deadline: project.deadline,
          createdAt: project.createdAt.toISOString(),
          completedAt: project.completedAt,
          tasks: project.tasks || [],
        })),
        sleepLogs: sleepLogs.map((log: any) => ({
          id: log.id,
          date: log.date,
          bedTime: log.bedTime,
          wakeTime: log.wakeTime,
          duration: log.duration,
          quality: log.quality,
          notes: log.notes,
        })),
        workoutSessions: workoutSessions.map((session: any) => ({
          id: session.id,
          date: session.date,
          type: session.type,
          customType: session.customType,
          duration: session.duration,
          notes: session.notes,
          intensity: session.intensity,
          completed: session.completed,
          programId: session.programId,
          missionId: session.missionId,
        })),
        workoutPrograms: workoutPrograms.map((program: any) => ({
          id: program.id,
          name: program.name,
          description: program.description,
          active: program.active,
          autoCreateMissions: program.autoCreateMissions,
          createdAt: program.createdAt.toISOString(),
          sessions: program.sessions?.map((session: any) => ({
            id: session.id,
            dayOfWeek: session.dayOfWeek,
            type: session.type,
            customType: session.customType,
            duration: session.duration,
            intensity: session.intensity,
            notes: session.notes,
          })) || [],
        })),
        dashboardWidgets: dashboardWidgets.map((widget: any) => ({
          id: widget.id,
          type: widget.type.replace(/_/g, '-'), // Convert enum back to kebab-case
          enabled: widget.enabled,
          order: widget.order,
          width: widget.width,
          height: widget.height,
        })),
      }

      dispatch({ type: "LOAD_STATE", payload: transformedState as AppState })
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  return (
    <AppContext.Provider value={{ state, dispatch, loadData, isLoading }}>
      {children}
    </AppContext.Provider>
  )
}

// Hook to use the app context
export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

// Action creators that make API calls
export const actions = {
  // Routine Actions
  async addRoutineAction(dispatch: React.Dispatch<AppAction>, action: Omit<RoutineAction, 'id' | 'createdAt'>) {
    try {
      const newAction = await api.routinesApi.createAction(action)
      // Optionally dispatch optimistic update or reload data
      return newAction
    } catch (error) {
      console.error('Error adding routine action:', error)
      throw error
    }
  },

  async updateRoutineAction(dispatch: React.Dispatch<AppAction>, action: RoutineAction) {
    try {
      const updatedAction = await api.routinesApi.updateAction(action)
      return updatedAction
    } catch (error) {
      console.error('Error updating routine action:', error)
      throw error
    }
  },

  async deleteRoutineAction(dispatch: React.Dispatch<AppAction>, id: string) {
    try {
      await api.routinesApi.deleteAction(id)
      return true
    } catch (error) {
      console.error('Error deleting routine action:', error)
      throw error
    }
  },

  async logRoutineAction(dispatch: React.Dispatch<AppAction>, actionId: string, date: string, completed: boolean) {
    try {
      const log = await api.routinesApi.logAction({ actionId, date, completed })
      dispatch({ type: "LOG_ROUTINE", payload: log })
      return log
    } catch (error) {
      console.error('Error logging routine action:', error)
      throw error
    }
  },

  // Similar patterns for other entities...
}

// Utility functions
export function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

export function formatDateFr(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function calculateStreak(logs: { date: string; completed: boolean }[]): { current: number; longest: number } {
  if (logs.length === 0) return { current: 0, longest: 0 }

  // Sort by date descending
  const sortedLogs = logs
    .filter(log => log.completed)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  let current = 0
  let longest = 0
  let tempStreak = 0

  // Calculate current streak from today backwards
  const today = getToday()
  let currentDate = new Date(today)
  
  for (let i = 0; i < sortedLogs.length; i++) {
    const logDate = sortedLogs[i].date
    const expectedDate = currentDate.toISOString().split('T')[0]
    
    if (logDate === expectedDate) {
      current++
      currentDate.setDate(currentDate.getDate() - 1)
    } else {
      break
    }
  }

  // Calculate longest streak
  for (let i = 0; i < sortedLogs.length; i++) {
    tempStreak = 1
    const baseDate = new Date(sortedLogs[i].date)
    
    for (let j = i + 1; j < sortedLogs.length; j++) {
      baseDate.setDate(baseDate.getDate() - 1)
      const expectedDate = baseDate.toISOString().split('T')[0]
      
      if (sortedLogs[j].date === expectedDate) {
        tempStreak++
      } else {
        break
      }
    }
    
    longest = Math.max(longest, tempStreak)
  }

  return { current, longest }
}