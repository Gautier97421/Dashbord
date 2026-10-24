import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, unauthorized } from '@/lib/projects/server'

// Reconnu par l'import (/api/projects/import)
const EXPORT_FORMAT = 'dashlife-projects'

// GET /api/projects/export — projets, tâches, commentaires et modèles, au format JSON (hors corbeille)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const [projects, tasks, comments, templates] = await Promise.all([
    prisma.project.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { createdAt: 'asc' } }),
    prisma.task.findMany({ where: { userId: user.id, deletedAt: null, missionId: null }, orderBy: { createdAt: 'asc' } }),
    prisma.projectActivity.findMany({ where: { userId: user.id, kind: 'comment' }, orderBy: { createdAt: 'asc' } }),
    prisma.projectTemplate.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
  ])

  const strip = <T extends { userId: string; deletedAt?: Date | null }>({ userId, deletedAt, ...rest }: T) => rest

  const payload = {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: projects.map(strip),
    tasks: tasks.map(strip),
    comments: comments.map(({ userId, ...rest }) => rest),
    templates: templates.map(({ userId, ...rest }) => rest),
  }

  const day = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dashlife-projets-${day}.json"`,
    },
  })
}
