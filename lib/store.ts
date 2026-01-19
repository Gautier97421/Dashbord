"use client"

import React from "react"

import { createContext, useContext } from "react"
import type {
  AppState,
  AppAction,
  RoutineAction,
  RoutineLog,
  Task,
  Mission,
  Project,
  CalendarEvent,
  UserSettings,
} from "./types"

const STORAGE_KEY = "productivity-dashboard-v1"

export const defaultSettings: UserSettings = {
  theme: "system",
  dayStartHour: 6,
  dayEndHour: 22,
  showRoutines: true,
  showStats: true,
  showDailyInsight: true,
}

export function loadState(): AppState | null {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved) as AppState
    }
  } catch (e) {
    console.error("Failed to load state:", e)
  }
  return null
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error("Failed to save state:", e)
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function getToday(): string {
  return new Date().toISOString().split("T")[0]
}

export function formatDateFr(date: string | Date, format: "short" | "long" | "full" = "short"): string {
  const d = new Date(date)
  const options: Intl.DateTimeFormatOptions =
    format === "short"
      ? { day: "numeric", month: "short" }
      : format === "long"
        ? { day: "numeric", month: "long", year: "numeric" }
        : { weekday: "long", day: "numeric", month: "long", year: "numeric" }

  return d.toLocaleDateString("fr-FR", options)
}

export function calculateStreak(logs: RoutineLog[], actionId: string): { current: number; longest: number } {
  const actionLogs = logs
    .filter((l) => l.actionId === actionId && l.completed)
    .map((l) => l.date)
    .sort()
    .reverse()

  if (actionLogs.length === 0) return { current: 0, longest: 0 }

  let current = 0
  let longest = 0
  let streak = 0
  const today = getToday()

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split("T")[0]

  if (actionLogs[0] === today || actionLogs[0] === yesterdayStr) {
    let checkDate = new Date(actionLogs[0])
    for (const log of actionLogs) {
      const logDate = new Date(log)
      const diff = Math.round((checkDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24))

      if (diff <= 1) {
        streak++
        checkDate = logDate
      } else {
        break
      }
    }
    current = streak
  }

  streak = 1
  longest = 1
  for (let i = 1; i < actionLogs.length; i++) {
    const prev = new Date(actionLogs[i - 1])
    const curr = new Date(actionLogs[i])
    const diff = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24))

    if (diff === 1) {
      streak++
      longest = Math.max(longest, streak)
    } else {
      streak = 1
    }
  }

  return { current, longest: Math.max(longest, current) }
}

export const defaultState: AppState = {
  routineActions: [
    { id: "1", name: "Meditation", category: "mental", importance: "high", createdAt: new Date().toISOString() },
    { id: "2", name: "Exercise", category: "sport", importance: "high", createdAt: new Date().toISOString() },
    { id: "3", name: "Reading", category: "personal", importance: "medium", createdAt: new Date().toISOString() },
    { id: "4", name: "Journaling", category: "mental", importance: "medium", createdAt: new Date().toISOString() },
    { id: "5", name: "Healthy Breakfast", category: "health", importance: "high", createdAt: new Date().toISOString() },
  ],
  routineLogs: [],
  nightRoutineActions: [
    { id: "n1", name: "Lecture", importance: "medium", createdAt: new Date().toISOString() },
    { id: "n2", name: "Préparation du lendemain", importance: "high", createdAt: new Date().toISOString() },
    { id: "n3", name: "Étirements", importance: "medium", createdAt: new Date().toISOString() },
  ],
  nightRoutineLogs: [],
  tasks: [],
  missions: [
    {
      id: "1",
      title: "Complete project proposal",
      description: "Finish the Q1 project proposal",
      timeFrame: "week",
      priority: "high",
      status: "in-progress",
      tasks: [],
      createdAt: new Date().toISOString(),
    },
  ],
  projects: [
    {
      id: "1",
      title: "Personal Dashboard",
      description: "Build a productivity dashboard app",
      objectives: ["Design UI", "Implement features", "Test and deploy"],
      tasks: [],
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ],
  calendarEvents: [],
  dailyInsights: [
    {
      id: "1",
      content: "The most effective way to do it is to do it. - Amelia Earhart",
      category: "motivation",
      liked: false,
      hidden: false,
    },
    {
      id: "2",
      content: "Taking regular breaks improves productivity by up to 30%.",
      category: "productivity",
      liked: false,
      hidden: false,
    },
    {
      id: "3",
      content: "Drinking water first thing in the morning helps activate your internal organs.",
      category: "health",
      liked: false,
      hidden: false,
    },
  ],
  sleepLogs: [],
  workoutSessions: [],
  workoutPrograms: [],
  personalRecords: [],
  fitnessProfile: null,
  dailyNutrition: [],
  dashboardWidgets: [
    { id: "1", type: "routine-progress", enabled: true, order: 0, width: 1, height: 1 },
    { id: "2", type: "missions-stats", enabled: true, order: 1, width: 1, height: 1 },
    { id: "3", type: "tasks-stats", enabled: true, order: 2, width: 1, height: 1 },
    { id: "4", type: "projects-stats", enabled: true, order: 3, width: 1, height: 1 },
    { id: "5", type: "routine-list", enabled: true, order: 4, width: 2, height: 1 },
    { id: "6", type: "today-missions", enabled: true, order: 5, width: 2, height: 1 },
    { id: "7", type: "week-missions", enabled: true, order: 6, width: 2, height: 1 },
    { id: "8", type: "active-projects", enabled: true, order: 7, width: 2, height: 1 },
  ],
  settings: defaultSettings,
}

export type AppAction =
  | { type: "LOAD_STATE"; payload: AppState }
  | { type: "ADD_ROUTINE_ACTION"; payload: RoutineAction }
  | { type: "UPDATE_ROUTINE_ACTION"; payload: RoutineAction }
  | { type: "DELETE_ROUTINE_ACTION"; payload: string }
  | { type: "LOG_ROUTINE"; payload: RoutineLog }
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
  | { type: "UPDATE_SETTINGS"; payload: Partial<UserSettings> }
  | { type: "LIKE_INSIGHT"; payload: string }
  | { type: "HIDE_INSIGHT"; payload: string }

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "LOAD_STATE":
      return { ...state, ...action.payload }
    case "ADD_ROUTINE_ACTION":
      return { ...state, routineActions: [...state.routineActions, action.payload] }
    case "UPDATE_ROUTINE_ACTION":
      return {
        ...state,
        routineActions: state.routineActions.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      }
    case "DELETE_ROUTINE_ACTION":
      return {
        ...state,
        routineActions: state.routineActions.filter((a) => a.id !== action.payload),
      }
    case "REORDER_ROUTINE_ACTIONS":
      return {
        ...state,
        routineActions: action.payload,
      }
    case "LOG_ROUTINE":
      const existingLogIndex = state.routineLogs.findIndex(
        (l) => l.actionId === action.payload.actionId && l.date === action.payload.date
      )
      if (existingLogIndex >= 0) {
        const newLogs = [...state.routineLogs]
        newLogs[existingLogIndex] = action.payload
        return { ...state, routineLogs: newLogs }
      }
      return { ...state, routineLogs: [...state.routineLogs, action.payload] }
    
    case "ADD_NIGHT_ROUTINE_ACTION":
      return { ...state, nightRoutineActions: [...state.nightRoutineActions, action.payload] }
    case "UPDATE_NIGHT_ROUTINE_ACTION":
      return {
        ...state,
        nightRoutineActions: state.nightRoutineActions.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      }
    case "DELETE_NIGHT_ROUTINE_ACTION":
      return {
        ...state,
        nightRoutineActions: state.nightRoutineActions.filter((a) => a.id !== action.payload),
      }
    case "REORDER_NIGHT_ROUTINE_ACTIONS":
      return {
        ...state,
        nightRoutineActions: action.payload,
      }
    case "LOG_NIGHT_ROUTINE":
      const existingNightLogIndex = state.nightRoutineLogs.findIndex(
        (l) => l.actionId === action.payload.actionId && l.date === action.payload.date
      )
      if (existingNightLogIndex >= 0) {
        const newLogs = [...state.nightRoutineLogs]
        newLogs[existingNightLogIndex] = action.payload
        return { ...state, nightRoutineLogs: newLogs }
      }
      return { ...state, nightRoutineLogs: [...state.nightRoutineLogs, action.payload] }
    
    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.payload] }
    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.payload.id ? action.payload : t)),
      }
    case "DELETE_TASK":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.payload) }
    case "ADD_MISSION":
      return { ...state, missions: [...state.missions, action.payload] }
    case "UPDATE_MISSION":
      return {
        ...state,
        missions: state.missions.map((m) =>
          m.id === action.payload.id ? action.payload : m
        ),
      }
    case "DELETE_MISSION":
      return { ...state, missions: state.missions.filter((m) => m.id !== action.payload) }
    case "ADD_PROJECT":
      return { ...state, projects: [...state.projects, action.payload] }
    case "UPDATE_PROJECT":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      }
    case "DELETE_PROJECT":
      return { ...state, projects: state.projects.filter((p) => p.id !== action.payload) }
    case "ADD_EVENT":
      return { ...state, calendarEvents: [...state.calendarEvents, action.payload] }
    case "UPDATE_EVENT":
      return {
        ...state,
        calendarEvents: state.calendarEvents.map((e) =>
          e.id === action.payload.id ? action.payload : e
        ),
      }
    case "DELETE_EVENT":
      return {
        ...state,
        calendarEvents: state.calendarEvents.filter((e) => e.id !== action.payload),
      }
    
    case "ADD_SLEEP_LOG":
      return { ...state, sleepLogs: [...state.sleepLogs, action.payload] }
    case "UPDATE_SLEEP_LOG":
      return {
        ...state,
        sleepLogs: state.sleepLogs.map((s) => (s.id === action.payload.id ? action.payload : s)),
      }
    case "DELETE_SLEEP_LOG":
      return { ...state, sleepLogs: state.sleepLogs.filter((s) => s.id !== action.payload) }
    
    case "ADD_WORKOUT":
      return { ...state, workoutSessions: [...state.workoutSessions, action.payload] }
    case "UPDATE_WORKOUT":
      return {
        ...state,
        workoutSessions: state.workoutSessions.map((w) =>
          w.id === action.payload.id ? action.payload : w
        ),
      }
    case "DELETE_WORKOUT":
      return { ...state, workoutSessions: state.workoutSessions.filter((w) => w.id !== action.payload) }
    
    case "ADD_WORKOUT_PROGRAM":
      return { ...state, workoutPrograms: [...state.workoutPrograms, action.payload] }
    case "UPDATE_WORKOUT_PROGRAM":
      return {
        ...state,
        workoutPrograms: state.workoutPrograms.map((wp) =>
          wp.id === action.payload.id ? action.payload : wp
        ),
      }
    case "DELETE_WORKOUT_PROGRAM":
      return { ...state, workoutPrograms: state.workoutPrograms.filter((wp) => wp.id !== action.payload) }
    
    case "ADD_PERSONAL_RECORD":
      return { ...state, personalRecords: [...state.personalRecords, action.payload] }
    case "UPDATE_PERSONAL_RECORD":
      return {
        ...state,
        personalRecords: state.personalRecords.map((pr) =>
          pr.id === action.payload.id ? action.payload : pr
        ),
      }
    case "DELETE_PERSONAL_RECORD":
      return { ...state, personalRecords: state.personalRecords.filter((pr) => pr.id !== action.payload) }
    
    case "UPDATE_FITNESS_PROFILE":
      return { ...state, fitnessProfile: action.payload }
    
    case "ADD_DAILY_NUTRITION":
      return { ...state, dailyNutrition: [...state.dailyNutrition, action.payload] }
    case "UPDATE_DAILY_NUTRITION":
      return {
        ...state,
        dailyNutrition: state.dailyNutrition.map((n) =>
          n.id === action.payload.id ? action.payload : n
        ),
      }
    case "DELETE_DAILY_NUTRITION":
      return { ...state, dailyNutrition: state.dailyNutrition.filter((n) => n.id !== action.payload) }
    
    case "UPDATE_DASHBOARD_WIDGETS":
      return { ...state, dashboardWidgets: action.payload }
    
    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.payload } }
    case "LIKE_INSIGHT":
      return {
        ...state,
        dailyInsights: state.dailyInsights.map((i) =>
          i.id === action.payload ? { ...i, liked: !i.liked } : i
        ),
      }
    case "HIDE_INSIGHT":
      return {
        ...state,
        dailyInsights: state.dailyInsights.map((i) =>
          i.id === action.payload ? { ...i, hidden: true } : i
        ),
      }
    default:
      return state
  }
}

interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

export const AppContext = createContext<AppContextType | null>(null)

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useApp must be used within AppProvider")
  }
  return context
}
