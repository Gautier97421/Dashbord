import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ingredientsSeed } from '@/lib/data/ingredients-seed'

let seedChecked = false

// Ajoute les ingrédients de la base de référence absents de la table (y compris ceux ajoutés après le premier seed)
async function ensureSeeded() {
  if (seedChecked) return
  const existing = new Set((await prisma.ingredient.findMany({ select: { name: true } })).map((i) => i.name))
  const missing = ingredientsSeed
    .filter((i) => !existing.has(i.name))
    .map(({ unitWeight, unitLabel, ...ingredient }) => ingredient)
  if (missing.length > 0) {
    await prisma.ingredient.createMany({ data: missing })
  }
  seedChecked = true
}

// GET ingredients (reference data, shared across all users), optional search by name/category
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensureSeeded()

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const category = searchParams.get('category')

    const ingredients = await prisma.ingredient.findMany({
      where: {
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { name: 'asc' },
      take: 50,
    })

    return NextResponse.json(ingredients)
  } catch (error) {
    console.error('Error fetching ingredients:', error)
    return NextResponse.json({ error: 'Failed to fetch ingredients' }, { status: 500 })
  }
}
