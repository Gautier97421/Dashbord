/**
 * POST /api/workflows/from-template
 * Body: { templateId: string }
 *
 * Creates a ready-to-use workflow from a built-in template — no manual graph
 * building required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireFeature } from '@/lib/features';
import { prisma } from '@/lib/prisma';
import { getTemplateById } from '@/lib/ai-agent/templates';

export async function POST(req: NextRequest) {
  try {
    const denied = await requireFeature('ai-agent');
    if (denied) return denied;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { templateId } = await req.json();
    const template = getTemplateById(templateId);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const workflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        name: template.name,
        description: template.description,
        config: template.config as any,
        isActive: false,
        status: 'draft',
      },
    });

    return NextResponse.json(workflow, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/workflows/from-template:', error);
    return NextResponse.json({ error: 'Failed to create workflow from template' }, { status: 500 });
  }
}
