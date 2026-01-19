import { prisma } from "./prisma"
import { hash } from "bcryptjs"

export async function seedDefaultInsights(userId: string) {
  const existingInsights = await prisma.dailyInsight.count({
    where: { userId },
  })

  if (existingInsights === 0) {
    await prisma.dailyInsight.createMany({
      data: [
        {
          userId,
          content: "The most effective way to do it is to do it. - Amelia Earhart",
          category: "motivation",
        },
        {
          userId,
          content: "Taking regular breaks improves productivity by up to 30%.",
          category: "productivity",
        },
        {
          userId,
          content: "Drinking water first thing in the morning helps activate your internal organs.",
          category: "health",
        },
        {
          userId,
          content: "Did you know? Your brain uses 20% of your body's energy!",
          category: "funfact",
        },
      ],
    })
  }
}

export async function seedDefaultRoutines(userId: string) {
  const existingRoutines = await prisma.routineAction.count({
    where: { userId },
  })

  if (existingRoutines === 0) {
    await prisma.routineAction.createMany({
      data: [
        { userId, name: "Meditation", category: "mental", importance: "high" },
        { userId, name: "Exercise", category: "sport", importance: "high" },
        { userId, name: "Reading", category: "personal", importance: "medium" },
        { userId, name: "Journaling", category: "mental", importance: "medium" },
        { userId, name: "Healthy Breakfast", category: "health", importance: "high" },
      ],
    })
  }
}

export async function initializeUserData(userId: string) {
  // Créer les paramètres par défaut
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  })

  if (!settings) {
    await prisma.userSettings.create({
      data: {
        userId,
        theme: "system",
        dayStartHour: 6,
        dayEndHour: 22,
        showRoutines: true,
        showStats: true,
        showDailyInsight: true,
      },
    })
  }

  // Ajouter les données de démonstration
  await seedDefaultRoutines(userId)
  await seedDefaultInsights(userId)
}
