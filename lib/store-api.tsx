"use client"

import { useContext, createContext, useReducer, useEffect, useState, ReactNode, useCallback } from 'react'
import {
  AppState,
  AppAction,
  RoutineAction,
  RoutineLog,
  NightRoutineAction,
  NightRoutineLog,
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
    theme: "light",
    dayStartHour: 6,
    dayEndHour: 22,
    showRoutines: true,
    showStats: true,
    showDailyInsight: true,
  },
}

// Context with API actions
interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  loadData: () => Promise<void>
  isLoading: boolean
  // API actions for routines
  addRoutineAction: (action: Omit<RoutineAction, 'id' | 'createdAt'>) => Promise<void>
  updateRoutineAction: (action: RoutineAction) => Promise<void>
  deleteRoutineAction: (id: string) => Promise<void>
  logRoutine: (actionId: string, date: string, completed: boolean) => Promise<void>
  // API actions for night routines
  addNightRoutineAction: (action: Omit<NightRoutineAction, 'id' | 'createdAt'>) => Promise<void>
  updateNightRoutineAction: (action: NightRoutineAction) => Promise<void>
  deleteNightRoutineAction: (id: string) => Promise<void>
  logNightRoutine: (actionId: string, date: string, completed: boolean) => Promise<void>
  // API actions for tasks
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<void>
  updateTask: (task: Task) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  // API actions for missions
  addMission: (mission: Omit<Mission, 'id' | 'createdAt'>) => Promise<void>
  updateMission: (mission: Mission) => Promise<void>
  deleteMission: (id: string) => Promise<void>
  // API actions for projects
  addProject: (project: Omit<Project, 'id' | 'createdAt'>) => Promise<void>
  updateProject: (project: Project) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  // API actions for sleep
  addSleepLog: (sleepLog: Omit<SleepLog, 'id'>) => Promise<void>
  updateSleepLog: (sleepLog: SleepLog) => Promise<void>
  deleteSleepLog: (id: string) => Promise<void>
  // API actions for workouts
  addWorkout: (workout: Omit<WorkoutSession, 'id'>) => Promise<void>
  updateWorkout: (workout: WorkoutSession) => Promise<void>
  deleteWorkout: (id: string) => Promise<void>
  // API actions for workout programs
  addWorkoutProgram: (program: Omit<WorkoutProgram, 'id' | 'createdAt'>) => Promise<void>
  updateWorkoutProgram: (program: WorkoutProgram) => Promise<void>
  deleteWorkoutProgram: (id: string) => Promise<void>
  // API actions for dashboard widgets
  updateDashboardWidgets: (widgets: DashboardWidget[]) => Promise<void>
  // API actions for settings
  updateSettings: (settings: Partial<UserSettings>) => void
}

const AppContext = createContext<AppContextType | null>(null)

// Custom hook
export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

// Reducer with full state updates
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "LOAD_STATE":
      return { ...state, ...action.payload }

    // Routine Actions
    case "ADD_ROUTINE_ACTION":
      return { ...state, routineActions: [...state.routineActions, action.payload] }
    case "UPDATE_ROUTINE_ACTION":
      return {
        ...state,
        routineActions: state.routineActions.map(a => a.id === action.payload.id ? action.payload : a)
      }
    case "DELETE_ROUTINE_ACTION":
      return {
        ...state,
        routineActions: state.routineActions.filter(a => a.id !== action.payload),
        routineLogs: state.routineLogs.filter(l => l.actionId !== action.payload)
      }
    case "LOG_ROUTINE":
      const existingLogIndex = state.routineLogs.findIndex(
        log => log.actionId === action.payload.actionId && log.date === action.payload.date
      )
      if (existingLogIndex >= 0) {
        const newLogs = [...state.routineLogs]
        newLogs[existingLogIndex] = action.payload
        return { ...state, routineLogs: newLogs }
      }
      return { ...state, routineLogs: [...state.routineLogs, action.payload] }

    // Night Routine Actions
    case "ADD_NIGHT_ROUTINE_ACTION":
      return { ...state, nightRoutineActions: [...state.nightRoutineActions, action.payload] }
    case "UPDATE_NIGHT_ROUTINE_ACTION":
      return {
        ...state,
        nightRoutineActions: state.nightRoutineActions.map(a => a.id === action.payload.id ? action.payload : a)
      }
    case "DELETE_NIGHT_ROUTINE_ACTION":
      return {
        ...state,
        nightRoutineActions: state.nightRoutineActions.filter(a => a.id !== action.payload),
        nightRoutineLogs: state.nightRoutineLogs.filter(l => l.actionId !== action.payload)
      }
    case "LOG_NIGHT_ROUTINE":
      const existingNightLogIndex = state.nightRoutineLogs.findIndex(
        log => log.actionId === action.payload.actionId && log.date === action.payload.date
      )
      if (existingNightLogIndex >= 0) {
        const newLogs = [...state.nightRoutineLogs]
        newLogs[existingNightLogIndex] = action.payload
        return { ...state, nightRoutineLogs: newLogs }
      }
      return { ...state, nightRoutineLogs: [...state.nightRoutineLogs, action.payload] }

    // Tasks
    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.payload] }
    case "UPDATE_TASK":
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) }
    case "DELETE_TASK":
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) }

    // Missions
    case "ADD_MISSION":
      return { ...state, missions: [...state.missions, action.payload] }
    case "UPDATE_MISSION":
      return { ...state, missions: state.missions.map(m => m.id === action.payload.id ? action.payload : m) }
    case "DELETE_MISSION":
      return { ...state, missions: state.missions.filter(m => m.id !== action.payload) }

    // Projects
    case "ADD_PROJECT":
      return { ...state, projects: [...state.projects, action.payload] }
    case "UPDATE_PROJECT":
      return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? action.payload : p) }
    case "DELETE_PROJECT":
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload) }

    // Sleep
    case "ADD_SLEEP_LOG":
      return { ...state, sleepLogs: [...state.sleepLogs, action.payload] }
    case "UPDATE_SLEEP_LOG":
      return { ...state, sleepLogs: state.sleepLogs.map(s => s.id === action.payload.id ? action.payload : s) }
    case "DELETE_SLEEP_LOG":
      return { ...state, sleepLogs: state.sleepLogs.filter(s => s.id !== action.payload) }

    // Workouts
    case "ADD_WORKOUT":
      return { ...state, workoutSessions: [...state.workoutSessions, action.payload] }
    case "UPDATE_WORKOUT":
      return { ...state, workoutSessions: state.workoutSessions.map(w => w.id === action.payload.id ? action.payload : w) }
    case "DELETE_WORKOUT":
      return { ...state, workoutSessions: state.workoutSessions.filter(w => w.id !== action.payload) }

    // Workout Programs
    case "ADD_WORKOUT_PROGRAM":
      return { ...state, workoutPrograms: [...state.workoutPrograms, action.payload] }
    case "UPDATE_WORKOUT_PROGRAM":
      return { ...state, workoutPrograms: state.workoutPrograms.map(p => p.id === action.payload.id ? action.payload : p) }
    case "DELETE_WORKOUT_PROGRAM":
      return { ...state, workoutPrograms: state.workoutPrograms.filter(p => p.id !== action.payload) }

    // Dashboard Widgets
    case "UPDATE_DASHBOARD_WIDGETS":
      return { ...state, dashboardWidgets: action.payload }

    // Settings
    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.payload } }

    // Insights
    case "LIKE_INSIGHT":
      return {
        ...state,
        dailyInsights: state.dailyInsights.map(i =>
          i.id === action.payload ? { ...i, liked: !i.liked } : i
        )
      }
    case "HIDE_INSIGHT":
      return {
        ...state,
        dailyInsights: state.dailyInsights.map(i =>
          i.id === action.payload ? { ...i, hidden: true } : i
        )
      }

    default:
      return state
  }
}

// Helper to transform API data
function transformApiData(data: any): any {
  if (data?.createdAt) {
    return { ...data, createdAt: new Date(data.createdAt).toISOString() }
  }
  return data
}

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, defaultState)
  const [isLoading, setIsLoading] = useState(true)

  // Load all data from APIs
  const loadData = useCallback(async () => {
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
        api.routinesApi.getActions().catch(() => []) as Promise<any[]>,
        api.routinesApi.getLogs().catch(() => []) as Promise<any[]>,
        api.nightRoutinesApi.getActions().catch(() => []) as Promise<any[]>,
        api.nightRoutinesApi.getLogs().catch(() => []) as Promise<any[]>,
        api.tasksApi.getAll().catch(() => []) as Promise<any[]>,
        api.missionsApi.getAll().catch(() => []) as Promise<any[]>,
        api.projectsApi.getAll().catch(() => []) as Promise<any[]>,
        api.sleepApi.getAll().catch(() => []) as Promise<any[]>,
        api.workoutsApi.getAll().catch(() => []) as Promise<any[]>,
        api.workoutProgramsApi.getAll().catch(() => []) as Promise<any[]>,
        api.dashboardApi.getWidgets().catch(() => []) as Promise<any[]>,
      ])

      // Transform Prisma data to match our types
      const transformedState: Partial<AppState> = {
        routineActions: routineActions.map((action: any) => ({
          id: action.id,
          name: action.name,
          category: action.category,
          importance: action.importance,
          createdAt: new Date(action.createdAt).toISOString(),
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
          createdAt: new Date(action.createdAt).toISOString(),
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
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          projectId: task.projectId,
          createdAt: new Date(task.createdAt).toISOString(),
        })),
        missions: missions.map((mission: any) => ({
          id: mission.id,
          title: mission.title,
          description: mission.description,
          status: mission.status,
          priority: mission.priority,
          timeFrame: mission.timeFrame,
          dueDate: mission.dueDate,
          tasks: Array.isArray(mission.tasks) ? mission.tasks.map((task: any) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            missionId: task.missionId,
            projectId: task.projectId,
            createdAt: new Date(task.createdAt).toISOString(),
          })) : [],
          createdAt: new Date(mission.createdAt).toISOString(),
        })),
        projects: projects.map((project: any) => ({
          id: project.id,
          name: project.name,
          title: project.name,
          description: project.description,
          color: project.color,
          objectives: Array.isArray(project.objectives) ? project.objectives : [],
          completedAt: project.completedAt ? new Date(project.completedAt).toISOString() : undefined,
          tasks: Array.isArray(project.tasks) ? project.tasks.map((task: any) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            missionId: task.missionId,
            projectId: task.projectId,
            createdAt: new Date(task.createdAt).toISOString(),
          })) : [],
          createdAt: new Date(project.createdAt).toISOString(),
        })),
        sleepLogs: sleepLogs.map((log: any) => ({
          id: log.id,
          date: log.date,
          bedTime: log.bedtime || log.bedTime,
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
          intensity: session.intensity,
          notes: session.notes,
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
          createdAt: new Date(program.createdAt).toISOString(),
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
          type: widget.type.replace(/_/g, '-'),
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
  }, [])

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [loadData])

  // Apply theme effect
  useEffect(() => {
    const theme = state.settings.theme
    const root = document.documentElement

    if (theme === "dark") {
      root.classList.add("dark")
    } else if (theme === "light") {
      root.classList.remove("dark")
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      if (prefersDark) {
        root.classList.add("dark")
      } else {
        root.classList.remove("dark")
      }
    }
  }, [state.settings.theme])

  // ===== API ACTION FUNCTIONS =====

  // Routine Actions
  const addRoutineAction = useCallback(async (action: Omit<RoutineAction, 'id' | 'createdAt'>) => {
    try {
      const newAction = await api.routinesApi.createAction(action)
      dispatch({ type: "ADD_ROUTINE_ACTION", payload: transformApiData(newAction) })
    } catch (error) {
      console.error('Error adding routine action:', error)
      throw error
    }
  }, [])

  const updateRoutineAction = useCallback(async (action: RoutineAction) => {
    try {
      const updated = await api.routinesApi.updateAction(action)
      dispatch({ type: "UPDATE_ROUTINE_ACTION", payload: transformApiData(updated) })
    } catch (error) {
      console.error('Error updating routine action:', error)
      throw error
    }
  }, [])

  const deleteRoutineAction = useCallback(async (id: string) => {
    try {
      await api.routinesApi.deleteAction(id)
      dispatch({ type: "DELETE_ROUTINE_ACTION", payload: id })
    } catch (error) {
      console.error('Error deleting routine action:', error)
      throw error
    }
  }, [])

  const logRoutine = useCallback(async (actionId: string, date: string, completed: boolean) => {
    try {
      const log = await api.routinesApi.logAction({ actionId, date, completed })
      dispatch({ type: "LOG_ROUTINE", payload: log as RoutineLog })
    } catch (error) {
      console.error('Error logging routine:', error)
      throw error
    }
  }, [])

  // Night Routine Actions
  const addNightRoutineAction = useCallback(async (action: Omit<NightRoutineAction, 'id' | 'createdAt'>) => {
    try {
      const newAction = await api.nightRoutinesApi.createAction(action)
      dispatch({ type: "ADD_NIGHT_ROUTINE_ACTION", payload: transformApiData(newAction) })
    } catch (error) {
      console.error('Error adding night routine action:', error)
      throw error
    }
  }, [])

  const updateNightRoutineAction = useCallback(async (action: NightRoutineAction) => {
    try {
      const updated = await api.nightRoutinesApi.updateAction(action)
      dispatch({ type: "UPDATE_NIGHT_ROUTINE_ACTION", payload: transformApiData(updated) })
    } catch (error) {
      console.error('Error updating night routine action:', error)
      throw error
    }
  }, [])

  const deleteNightRoutineAction = useCallback(async (id: string) => {
    try {
      await api.nightRoutinesApi.deleteAction(id)
      dispatch({ type: "DELETE_NIGHT_ROUTINE_ACTION", payload: id })
    } catch (error) {
      console.error('Error deleting night routine action:', error)
      throw error
    }
  }, [])

  const logNightRoutine = useCallback(async (actionId: string, date: string, completed: boolean) => {
    try {
      const log = await api.nightRoutinesApi.logAction({ actionId, date, completed })
      dispatch({ type: "LOG_NIGHT_ROUTINE", payload: log as NightRoutineLog })
    } catch (error) {
      console.error('Error logging night routine:', error)
      throw error
    }
  }, [])

  // Tasks
  const addTask = useCallback(async (task: Omit<Task, 'id' | 'createdAt'>) => {
    try {
      const newTask = await api.tasksApi.create(task)
      dispatch({ type: "ADD_TASK", payload: transformApiData(newTask) })
    } catch (error) {
      console.error('Error adding task:', error)
      throw error
    }
  }, [])

  const updateTask = useCallback(async (task: Task) => {
    try {
      const updated = await api.tasksApi.update(task)
      dispatch({ type: "UPDATE_TASK", payload: transformApiData(updated) })
    } catch (error) {
      console.error('Error updating task:', error)
      throw error
    }
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    try {
      await api.tasksApi.delete(id)
      dispatch({ type: "DELETE_TASK", payload: id })
    } catch (error) {
      console.error('Error deleting task:', error)
      throw error
    }
  }, [])

  // Missions
  const addMission = useCallback(async (mission: Omit<Mission, 'id' | 'createdAt'>) => {
    try {
      const newMission = await api.missionsApi.create(mission)
      dispatch({ type: "ADD_MISSION", payload: transformApiData(newMission) })
    } catch (error) {
      console.error('Error adding mission:', error)
      throw error
    }
  }, [])

  const updateMission = useCallback(async (mission: Mission) => {
    try {
      const updated = await api.missionsApi.update(mission)
      dispatch({ type: "UPDATE_MISSION", payload: transformApiData(updated) })
    } catch (error) {
      console.error('Error updating mission:', error)
      throw error
    }
  }, [])

  const deleteMission = useCallback(async (id: string) => {
    try {
      await api.missionsApi.delete(id)
      dispatch({ type: "DELETE_MISSION", payload: id })
    } catch (error) {
      console.error('Error deleting mission:', error)
      throw error
    }
  }, [])

  // Projects
  const addProject = useCallback(async (project: Omit<Project, 'id' | 'createdAt'>) => {
    try {
      const newProject = await api.projectsApi.create(project)
      dispatch({ type: "ADD_PROJECT", payload: transformApiData(newProject) })
    } catch (error) {
      console.error('Error adding project:', error)
      throw error
    }
  }, [])

  const updateProject = useCallback(async (project: Project) => {
    try {
      const updated = await api.projectsApi.update(project)
      dispatch({ type: "UPDATE_PROJECT", payload: transformApiData(updated) })
    } catch (error) {
      console.error('Error updating project:', error)
      throw error
    }
  }, [])

  const deleteProject = useCallback(async (id: string) => {
    try {
      await api.projectsApi.delete(id)
      dispatch({ type: "DELETE_PROJECT", payload: id })
    } catch (error) {
      console.error('Error deleting project:', error)
      throw error
    }
  }, [])

  // Sleep
  const addSleepLog = useCallback(async (sleepLog: Omit<SleepLog, 'id'>) => {
    try {
      const newLog = await api.sleepApi.createOrUpdate(sleepLog)
      dispatch({ type: "ADD_SLEEP_LOG", payload: newLog as SleepLog })
    } catch (error) {
      console.error('Error adding sleep log:', error)
      throw error
    }
  }, [])

  const updateSleepLog = useCallback(async (sleepLog: SleepLog) => {
    try {
      const updated = await api.sleepApi.createOrUpdate(sleepLog)
      dispatch({ type: "UPDATE_SLEEP_LOG", payload: updated as SleepLog })
    } catch (error) {
      console.error('Error updating sleep log:', error)
      throw error
    }
  }, [])

  const deleteSleepLog = useCallback(async (id: string) => {
    try {
      await api.sleepApi.delete(id)
      dispatch({ type: "DELETE_SLEEP_LOG", payload: id })
    } catch (error) {
      console.error('Error deleting sleep log:', error)
      throw error
    }
  }, [])

  // Workouts
  const addWorkout = useCallback(async (workout: Omit<WorkoutSession, 'id'>) => {
    try {
      const newWorkout = await api.workoutsApi.create(workout)
      dispatch({ type: "ADD_WORKOUT", payload: newWorkout as WorkoutSession })
    } catch (error) {
      console.error('Error adding workout:', error)
      throw error
    }
  }, [])

  const updateWorkout = useCallback(async (workout: WorkoutSession) => {
    try {
      const updated = await api.workoutsApi.update(workout)
      dispatch({ type: "UPDATE_WORKOUT", payload: updated as WorkoutSession })
    } catch (error) {
      console.error('Error updating workout:', error)
      throw error
    }
  }, [])

  const deleteWorkout = useCallback(async (id: string) => {
    try {
      await api.workoutsApi.delete(id)
      dispatch({ type: "DELETE_WORKOUT", payload: id })
    } catch (error) {
      console.error('Error deleting workout:', error)
      throw error
    }
  }, [])

  // Workout Programs
  const addWorkoutProgram = useCallback(async (program: Omit<WorkoutProgram, 'id' | 'createdAt'>) => {
    try {
      const newProgram = await api.workoutProgramsApi.create(program)
      dispatch({ type: "ADD_WORKOUT_PROGRAM", payload: transformApiData(newProgram) })
    } catch (error) {
      console.error('Error adding workout program:', error)
      throw error
    }
  }, [])

  const updateWorkoutProgram = useCallback(async (program: WorkoutProgram) => {
    try {
      const updated = await api.workoutProgramsApi.update(program)
      dispatch({ type: "UPDATE_WORKOUT_PROGRAM", payload: transformApiData(updated) })
    } catch (error) {
      console.error('Error updating workout program:', error)
      throw error
    }
  }, [])

  const deleteWorkoutProgram = useCallback(async (id: string) => {
    try {
      await api.workoutProgramsApi.delete(id)
      dispatch({ type: "DELETE_WORKOUT_PROGRAM", payload: id })
    } catch (error) {
      console.error('Error deleting workout program:', error)
      throw error
    }
  }, [])

  // Dashboard Widgets
  const updateDashboardWidgets = useCallback(async (widgets: DashboardWidget[]) => {
    try {
      await api.dashboardApi.updateWidgets(widgets)
      dispatch({ type: "UPDATE_DASHBOARD_WIDGETS", payload: widgets })
    } catch (error) {
      console.error('Error updating dashboard widgets:', error)
      throw error
    }
  }, [])

  // Settings (local only)
  const updateSettings = useCallback((settings: Partial<UserSettings>) => {
    dispatch({ type: "UPDATE_SETTINGS", payload: settings })
  }, [])

  const contextValue: AppContextType = {
    state,
    dispatch,
    loadData,
    isLoading,
    // Routine actions
    addRoutineAction,
    updateRoutineAction,
    deleteRoutineAction,
    logRoutine,
    // Night routine actions
    addNightRoutineAction,
    updateNightRoutineAction,
    deleteNightRoutineAction,
    logNightRoutine,
    // Task actions
    addTask,
    updateTask,
    deleteTask,
    // Mission actions
    addMission,
    updateMission,
    deleteMission,
    // Project actions
    addProject,
    updateProject,
    deleteProject,
    // Sleep actions
    addSleepLog,
    updateSleepLog,
    deleteSleepLog,
    // Workout actions
    addWorkout,
    updateWorkout,
    deleteWorkout,
    // Workout program actions
    addWorkoutProgram,
    updateWorkoutProgram,
    deleteWorkoutProgram,
    // Dashboard widgets
    updateDashboardWidgets,
    // Settings
    updateSettings,
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

export { AppContext }
