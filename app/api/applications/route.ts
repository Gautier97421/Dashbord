/**
 * GET  /api/applications  — list the user's tracked job applications
 * POST /api/applications  — manually add an application
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function getUser(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await getUser(session.user.email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const applications = await prisma.jobApplication.findMany({
      where: { userId: user.id },
      orderBy: { appliedAt: 'desc' },
    });

    return NextResponse.json(applications);
  } catch (error) {
    console.error('Error in GET /api/applications:', error);
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await getUser(session.user.email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await req.json();
    const { company, position, status, notes, appliedAt } = body;

    if (!company || typeof company !== 'string') {
      return NextResponse.json({ error: 'company is required' }, { status: 400 });
    }

    const application = await prisma.jobApplication.create({
      data: {
        userId: user.id,
        company,
        position: position || null,
        status: status || 'applied',
        notes: notes || null,
        source: 'manual',
        ...(appliedAt ? { appliedAt: new Date(appliedAt) } : {}),
      },
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/applications:', error);
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 });
  }
}
