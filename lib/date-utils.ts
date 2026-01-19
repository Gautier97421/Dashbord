export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0]
}

export function getWeekDates(date: Date): Date[] {
  const startOfWeek = new Date(date)
  const day = startOfWeek.getDay()
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
  startOfWeek.setDate(diff)
  
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    dates.push(d)
  }
  return dates
}

export function getMonthDates(date: Date): Date[] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  
  const dates: Date[] = []
  const startDay = firstDay.getDay()
  
  // Add previous month days
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    dates.push(d)
  }
  
  // Add current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    dates.push(new Date(year, month, i))
  }
  
  // Add next month days to complete the grid
  const remaining = 42 - dates.length
  for (let i = 1; i <= remaining; i++) {
    dates.push(new Date(year, month + 1, i))
  }
  
  return dates
}

export function isToday(date: Date | string): boolean {
  const d = typeof date === "string" ? new Date(date) : date
  const today = new Date()
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === "string" ? new Date(date1) : date1
  const d2 = typeof date2 === "string" ? new Date(date2) : date2
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  )
}

export function getStreak(logs: { date: string; completed: boolean }[]): number {
  if (logs.length === 0) return 0
  
  const sortedLogs = [...logs]
    .filter((l) => l.completed)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  
  if (sortedLogs.length === 0) return 0
  
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() - i)
    const dateStr = formatDateISO(checkDate)
    
    const hasLog = sortedLogs.some((l) => l.date === dateStr)
    if (hasLog) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  
  return streak
}

export function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function getMonthName(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
