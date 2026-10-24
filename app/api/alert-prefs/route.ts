import { NextResponse } from 'next/server'
import { getSessionUser, unauthorized } from '@/lib/projects/server'
import { getAlertPrefs, mergeAlertPrefs, saveAlertPrefs } from '@/lib/projects/alert-prefs'

// GET /api/alert-prefs — préférences des alertes projets
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  return NextResponse.json(await getAlertPrefs(user.id))
}

// PUT /api/alert-prefs — modification partielle ({ push: false }, { kinds: { project_stale: false } }…)
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const body = await request.json().catch(() => ({}))
  const prefs = mergeAlertPrefs(await getAlertPrefs(user.id), body)
  await saveAlertPrefs(user.id, prefs)
  return NextResponse.json(prefs)
}
