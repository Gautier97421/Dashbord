import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ownRef } from '@/lib/projects/server'

async function recomputeDailyTotals(dailyNutritionId: string) {
  const meals = await prisma.meal.findMany({ where: { dailyNutritionId } })
  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fats: acc.fats + m.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  )

  return prisma.dailyNutrition.update({
    where: { id: dailyNutritionId },
    data: totals,
    include: { meals: true },
  })
}

// POST create a meal (creates the day's record if it doesn't exist yet)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { date, name, time, calories, protein, carbs, fats, recipeId } = body

    if (!date || !name) {
      return NextResponse.json({ error: 'date and name are required' }, { status: 400 })
    }

    const dailyNutrition = await prisma.dailyNutrition.upsert({
      where: { userId_date: { userId: user.id, date } },
      update: {},
      create: { userId: user.id, date, calories: 0, protein: 0, carbs: 0, fats: 0 },
    })

    await prisma.meal.create({
      data: {
        dailyNutritionId: dailyNutrition.id,
        name,
        time: time || '12:00',
        calories: calories || 0,
        protein: protein || 0,
        carbs: carbs || 0,
        fats: fats || 0,
        recipeId: (await ownRef('recipe', recipeId, user.id)) ?? null,
      },
    })

    const updatedDay = await recomputeDailyTotals(dailyNutrition.id)

    return NextResponse.json(updatedDay, { status: 201 })
  } catch (error) {
    console.error('Error adding meal:', error)
    return NextResponse.json({ error: 'Failed to add meal' }, { status: 500 })
  }
}

// PUT update a meal
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { id, name, time, calories, protein, carbs, fats, recipeId } = body

    const existingMeal = await prisma.meal.findFirst({
      where: { id, dailyNutrition: { userId: user.id } },
    })

    if (!existingMeal) {
      return NextResponse.json({ error: 'Meal not found or unauthorized' }, { status: 404 })
    }

    await prisma.meal.update({
      where: { id },
      data: {
        name,
        time,
        calories,
        protein,
        carbs,
        fats,
        recipeId: (await ownRef('recipe', recipeId, user.id)) ?? null,
      },
    })

    const updatedDay = await recomputeDailyTotals(existingMeal.dailyNutritionId)

    return NextResponse.json(updatedDay)
  } catch (error) {
    console.error('Error updating meal:', error)
    return NextResponse.json({ error: 'Failed to update meal' }, { status: 500 })
  }
}

// DELETE a meal (removes the day's record too if it has no meals left)
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const existingMeal = await prisma.meal.findFirst({
      where: { id, dailyNutrition: { userId: user.id } },
    })

    if (!existingMeal) {
      return NextResponse.json({ error: 'Meal not found or unauthorized' }, { status: 404 })
    }

    const dailyNutritionId = existingMeal.dailyNutritionId
    await prisma.meal.delete({ where: { id } })

    const remainingMeals = await prisma.meal.count({ where: { dailyNutritionId } })
    if (remainingMeals === 0) {
      await prisma.dailyNutrition.delete({ where: { id: dailyNutritionId } })
      return NextResponse.json({ success: true, deletedDailyNutritionId: dailyNutritionId })
    }

    const updatedDay = await recomputeDailyTotals(dailyNutritionId)
    return NextResponse.json(updatedDay)
  } catch (error) {
    console.error('Error deleting meal:', error)
    return NextResponse.json({ error: 'Failed to delete meal' }, { status: 500 })
  }
}
