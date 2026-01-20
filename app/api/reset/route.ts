import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 })
    }

    // Supprimer toutes les données de l'utilisateur
    // Les cascades dans le schéma Prisma s'occuperont de supprimer toutes les relations
    await prisma.$transaction([
      // Supprimer les routines
      prisma.routineLog.deleteMany({ where: { userId: user.id } }),
      prisma.routineAction.deleteMany({ where: { userId: user.id } }),
      
      // Supprimer les routines du soir
      prisma.nightRoutineLog.deleteMany({ where: { userId: user.id } }),
      prisma.nightRoutineAction.deleteMany({ where: { userId: user.id } }),
      
      // Supprimer les missions et tâches
      prisma.task.deleteMany({ where: { userId: user.id } }),
      prisma.mission.deleteMany({ where: { userId: user.id } }),
      
      // Supprimer les projets
      prisma.project.deleteMany({ where: { userId: user.id } }),
      
      // Supprimer les événements du calendrier
      prisma.calendarEvent.deleteMany({ where: { userId: user.id } }),
      
      // Supprimer les insights quotidiens
      prisma.dailyInsight.deleteMany({ where: { userId: user.id } }),
      
      // Supprimer les données de sommeil
      prisma.sleepLog.deleteMany({ where: { userId: user.id } }),
      
      // Supprimer les données de sport
      prisma.workoutProgramSession.deleteMany({
        where: { program: { userId: user.id } }
      }),
      prisma.workoutProgram.deleteMany({ where: { userId: user.id } }),
      prisma.workoutSession.deleteMany({ where: { userId: user.id } }),
      prisma.personalRecord.deleteMany({ where: { userId: user.id } }),
      
      // Supprimer les données de nutrition
      prisma.meal.deleteMany({
        where: { dailyNutrition: { userId: user.id } }
      }),
      prisma.dailyNutrition.deleteMany({ where: { userId: user.id } }),
      
      // Supprimer les widgets du dashboard
      prisma.dashboardWidget.deleteMany({ where: { userId: user.id } }),
      
      // Réinitialiser le profil fitness
      prisma.fitnessProfile.deleteMany({ where: { userId: user.id } }),
      
      // Réinitialiser les paramètres utilisateur aux valeurs par défaut
      prisma.userSettings.updateMany({
        where: { userId: user.id },
        data: {
          theme: "system",
          dayStartHour: 6,
          dayEndHour: 22,
          showRoutines: true,
          showStats: true,
          showDailyInsight: true,
        }
      })
    ])

    return NextResponse.json({ success: true, message: "Données réinitialisées avec succès" })
  } catch (error) {
    console.error("Erreur lors de la réinitialisation:", error)
    return NextResponse.json(
      { error: "Erreur lors de la réinitialisation des données" },
      { status: 500 }
    )
  }
}
