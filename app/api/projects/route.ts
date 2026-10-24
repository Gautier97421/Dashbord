import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  badRequest,
  describeProjectChanges,
  getSessionUser,
  logActivity,
  notFound,
  nullable,
  parseDay,
  parsePriority,
  parseProjectStatus,
  parseText,
  sanitizeLinks,
  trashProjectTree,
  unauthorized,
} from '@/lib/projects/server'

// Vérifie qu'un parent est valide : il appartient à l'utilisateur, n'est pas à la corbeille et, pour un
// projet existant, n'est ni le projet lui-même ni un de ses sous-projets (sinon on créerait une boucle)
async function isValidParent(userId: string, parentId: string, projectId?: string): Promise<boolean> {
  const projects = await prisma.project.findMany({ where: { userId, deletedAt: null }, select: { id: true, parentId: true } })
  const parentOf = new Map(projects.map((p) => [p.id, p.parentId]))
  if (!parentOf.has(parentId)) return false
  for (let cur: string | null | undefined = parentId; cur; cur = parentOf.get(cur)) {
    if (cur === projectId) return false
  }
  return true
}

async function projectTitles(userId: string) {
  const projects = await prisma.project.findMany({ where: { userId }, select: { id: true, title: true } })
  return new Map(projects.map((p) => [p.id, p.title]))
}

const parseCategory = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 50) : undefined)

// Échéance stockée en ISO (format historique de ce champ)
const toIsoDay = (v: unknown) => {
  const day = parseDay(v)
  return day ? new Date(day).toISOString() : undefined
}

// GET all projects (hors corbeille)
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const projects = await prisma.project.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

// POST create a new project
export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 300) : ''
    if (!title) return badRequest('Title is required')

    const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null
    if (parentId && !(await isValidParent(user.id, parentId))) {
      return NextResponse.json({ error: 'Invalid parent project' }, { status: 400 })
    }

    // Nouveau projet en fin de liste parmi ses frères
    const last = await prisma.project.aggregate({ where: { userId: user.id, parentId }, _max: { order: true } })

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        title,
        description: parseText(5000)(body.description) || null,
        notes: parseText(20000)(body.notes) || null,
        objectives: Array.isArray(body.objectives) ? body.objectives.filter((o: unknown) => typeof o === 'string').slice(0, 50) : [],
        deadline: toIsoDay(body.deadline) || null,
        startDate: parseDay(body.startDate) || null,
        priority: parsePriority(body.priority) || null,
        category: parseCategory(body.category) || null,
        favorite: body.favorite === true,
        showInCalendar: body.showInCalendar === true,
        parentId,
        links: sanitizeLinks(body.links) ?? [],
        status: parseProjectStatus(body.status) || null,
        order: (last._max.order ?? 0) + 1,
      },
    })

    await logActivity(user.id, [{ projectId: project.id, message: `Projet créé : « ${project.title} »` }])

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

// PUT update a project. Les champs absents restent inchangés ; null efface un champ optionnel.
export async function PUT(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const body = await request.json()
    const { id, completedAt, parentId } = body

    const existingProject = await prisma.project.findFirst({ where: { id, userId: user.id, deletedAt: null } })
    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found or unauthorized' }, { status: 404 })
    }

    if (parentId && !(await isValidParent(user.id, parentId, id))) {
      return NextResponse.json({ error: 'Invalid parent project' }, { status: 400 })
    }

    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 300) : undefined

    const project = await prisma.project.update({
      where: { id },
      data: {
        title,
        description: nullable(body.description, parseText(5000)),
        notes: nullable(body.notes, parseText(20000)),
        objectives: Array.isArray(body.objectives) ? body.objectives.filter((o: unknown) => typeof o === 'string').slice(0, 50) : undefined,
        // Échéance : le formulaire envoie toujours le projet complet, une échéance absente est donc effacée
        deadline: body.deadline === undefined ? undefined : toIsoDay(body.deadline) || null,
        startDate: nullable(body.startDate, parseDay),
        priority: nullable(body.priority, parsePriority),
        category: nullable(body.category, parseCategory),
        favorite: typeof body.favorite === 'boolean' ? body.favorite : undefined,
        showInCalendar: typeof body.showInCalendar === 'boolean' ? body.showInCalendar : undefined,
        completedAt: completedAt === null ? null : (completedAt ? new Date(completedAt).toISOString() : undefined),
        // parentId absent de la requête : inchangé ; null ou "" : le projet redevient racine
        parentId: parentId === undefined ? undefined : parentId || null,
        // links absent de la requête : inchangés
        links: sanitizeLinks(body.links),
        // status absent : inchangé ; null : le projet n'a plus d'état
        status: nullable(body.status, parseProjectStatus),
        // La position ne change que par /api/projects/reorder
      },
    })

    const changes = describeProjectChanges(existingProject, project, await projectTitles(user.id))
    if (existingProject.favorite !== project.favorite) changes.push(project.favorite ? 'Ajouté aux favoris' : 'Retiré des favoris')
    if (existingProject.showInCalendar !== project.showInCalendar) {
      changes.push(project.showInCalendar ? 'Échéance affichée dans le calendrier principal' : 'Retiré du calendrier principal')
    }
    await logActivity(user.id, changes.map((message) => ({ projectId: project.id, message })))

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

// DELETE a project : il part à la corbeille avec ses sous-projets et leurs tâches (restaurables 30 jours)
export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return badRequest('ID is required')

    const existingProject = await prisma.project.findFirst({ where: { id, userId: user.id, deletedAt: null } })
    if (!existingProject) return notFound('Project not found or unauthorized')

    await trashProjectTree(user.id, id)
    await logActivity(user.id, [{ projectId: id, message: `Projet mis à la corbeille : « ${existingProject.title} »` }])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
