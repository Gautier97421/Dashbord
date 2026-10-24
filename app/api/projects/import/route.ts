import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  badRequest,
  getSessionUser,
  logActivity,
  parseDay,
  parsePriority,
  parseProjectStatus,
  parseRecurrence,
  parseTaskStatus,
  sanitizeChecklist,
  sanitizeIds,
  sanitizeLinks,
  unauthorized,
} from '@/lib/projects/server'
import { isTemplateData } from '@/lib/projects/tree'

const MAX_PROJECTS = 2000
const MAX_TASKS = 20000

const text = (v: unknown, max: number) => (typeof v === 'string' && v ? v.slice(0, max) : null)

// POST /api/projects/import — fichier produit par /api/projects/export. Tout est ajouté (rien n'est
// remplacé) avec de nouveaux identifiants ; les liens parent / dépendances / commentaires suivent.
export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const body = await request.json().catch(() => null)
    if (!body || body.format !== 'dashlife-projects' || !Array.isArray(body.projects) || !Array.isArray(body.tasks)) {
      return badRequest('Fichier non reconnu : utilise un export de la section Projets')
    }
    if (body.projects.length > MAX_PROJECTS || body.tasks.length > MAX_TASKS) return badRequest('Fichier trop volumineux')

    const projects: any[] = body.projects.filter((p: any) => p && typeof p.id === 'string' && typeof p.title === 'string')
    const tasks: any[] = body.tasks.filter((t: any) => t && typeof t.id === 'string' && typeof t.title === 'string')
    const projectIdMap = new Map<string, string>()
    const taskIdMap = new Map<string, string>()

    // Parents avant enfants
    const pending = [...projects]
    let guard = pending.length + 1
    while (pending.length && guard-- > 0) {
      for (let i = 0; i < pending.length; i++) {
        const p = pending[i]
        const parentKnown = !p.parentId || projectIdMap.has(p.parentId) || !projects.some((x) => x.id === p.parentId)
        if (!parentKnown) continue
        const deadline = parseDay(p.deadline)
        const created = await prisma.project.create({
          data: {
            userId: user.id,
            title: p.title.slice(0, 300),
            description: text(p.description, 5000),
            notes: text(p.notes, 20000),
            objectives: Array.isArray(p.objectives) ? p.objectives.filter((o: unknown) => typeof o === 'string').slice(0, 50) : [],
            deadline: deadline ? new Date(deadline).toISOString() : null,
            startDate: parseDay(p.startDate) || null,
            completedAt: typeof p.completedAt === 'string' ? p.completedAt : null,
            status: parseProjectStatus(p.status) || null,
            priority: parsePriority(p.priority) || null,
            category: text(p.category, 50),
            favorite: p.favorite === true,
            order: Number.isInteger(p.order) ? p.order : 0,
            links: sanitizeLinks(p.links) ?? [],
            parentId: p.parentId ? projectIdMap.get(p.parentId) ?? null : null,
          },
        })
        projectIdMap.set(p.id, created.id)
        pending.splice(i--, 1)
      }
    }

    for (const t of tasks) {
      const created = await prisma.task.create({
        data: {
          userId: user.id,
          title: t.title.slice(0, 500),
          description: text(t.description, 5000),
          notes: text(t.notes, 20000),
          priority: parsePriority(t.priority) || 'medium',
          status: parseTaskStatus(t.status) || 'todo',
          dueDate: parseDay(t.dueDate) || null,
          startDate: parseDay(t.startDate) || null,
          completedAt: typeof t.completedAt === 'string' ? t.completedAt : null,
          projectId: t.projectId ? projectIdMap.get(t.projectId) ?? null : null,
          checklist: sanitizeChecklist(t.checklist) ?? [],
          links: sanitizeLinks(t.links) ?? [],
          recurrence: parseRecurrence(t.recurrence) || null,
          order: Number.isInteger(t.order) ? t.order : 0,
        },
      })
      taskIdMap.set(t.id, created.id)
    }

    // Dépendances, une fois tous les nouveaux ids connus
    for (const t of tasks) {
      const deps = (sanitizeIds(t.dependsOn) || []).map((id) => taskIdMap.get(id)).filter((id): id is string => !!id)
      if (deps.length) await prisma.task.update({ where: { id: taskIdMap.get(t.id)! }, data: { dependsOn: deps } })
    }

    const comments = Array.isArray(body.comments) ? body.comments.slice(0, 20000) : []
    const commentRows = comments
      .filter((c: any) => c && typeof c.message === 'string' && c.message.trim())
      .map((c: any) => ({
        userId: user.id,
        kind: 'comment',
        message: c.message.slice(0, 5000),
        projectId: c.projectId ? projectIdMap.get(c.projectId) ?? null : null,
        taskId: c.taskId ? taskIdMap.get(c.taskId) ?? null : null,
        createdAt: typeof c.createdAt === 'string' ? new Date(c.createdAt) : undefined,
      }))
      .filter((c: any) => c.projectId || c.taskId)
    if (commentRows.length) await prisma.projectActivity.createMany({ data: commentRows })

    const templates = Array.isArray(body.templates) ? body.templates.slice(0, 200) : []
    const templateRows = templates
      .filter((t: any) => t && typeof t.name === 'string' && isTemplateData(t.data))
      .map((t: any) => ({ userId: user.id, name: t.name.slice(0, 100), description: text(t.description, 500), data: t.data as Prisma.InputJsonValue }))
    if (templateRows.length) await prisma.projectTemplate.createMany({ data: templateRows })

    const rootIds = projects.filter((p) => !p.parentId).map((p) => projectIdMap.get(p.id)).filter(Boolean) as string[]
    await logActivity(user.id, rootIds.map((projectId) => ({ projectId, message: 'Projet importé depuis un fichier' })))

    return NextResponse.json({
      projects: projectIdMap.size,
      tasks: taskIdMap.size,
      comments: commentRows.length,
      templates: templateRows.length,
    })
  } catch (error) {
    console.error('Error importing projects:', error)
    return NextResponse.json({ error: 'Failed to import projects' }, { status: 500 })
  }
}
