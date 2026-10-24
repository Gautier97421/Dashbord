import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AI_QUOTA_MESSAGE, takeAiQuota } from "@/lib/rate-limit";
import { authOptions } from "@/lib/auth";
import { requireFeature } from "@/lib/features";
import { WorkflowConfig } from "@/lib/types/workflow";
import { executeWorkflow } from "@/lib/ai-agent/workflow-runner";

export async function POST(request: NextRequest) {
  try {
    const denied = await requireFeature("ai-agent");
    if (denied) return denied;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { workflowId, input } = body;

    if (!workflowId || typeof workflowId !== "string") {
      return NextResponse.json({ error: "workflowId is required" }, { status: 400 });
    }

    // Workflow must belong to the authenticated user
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow || workflow.userId !== user.id) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    if (!takeAiQuota(user.id)) return NextResponse.json({ error: AI_QUOTA_MESSAGE }, { status: 429 });
    const config = workflow.config as unknown as WorkflowConfig;
    const result = await executeWorkflow(user.id, workflowId, config, input || {});

    return NextResponse.json(
      {
        id: result.executionId,
        status: result.status,
        output: result.output,
        logs: result.logs,
        error: result.error,
      },
      { status: result.status === "success" ? 200 : 500 }
    );
  } catch (error) {
    console.error("Error executing workflow:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
