/**
 * PATCH  /api/applications/[id]  — update status / fields
 * DELETE /api/applications/[id]  — remove a tracked application
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Context = { params: Promise<{ id: string }> };

async function authorize(id: string, email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: 'User not found', status: 404 as const };
  const application = await prisma.jobApplication.findUnique({ where: { id } });
  if (!application || application.userId !== user.id) {
    return { error: 'Application not found', status: 404 as const };
  }
  return { application };
}

export async function PATCH(req: NextRequest, context: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await context.params;
    const auth = await authorize(id, session.user.email);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const { status, position, notes, company } = body;

    const updated = await prisma.jobApplication.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(position !== undefined && { position }),
        ...(notes !== undefined && { notes }),
        ...(company && { company }),
        lastUpdate: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error in PATCH /api/applications/[id]:', error);
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await context.params;
    const auth = await authorize(id, session.user.email);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await prisma.jobApplication.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/applications/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 });
  }
}
