"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  NodeTypes,
  EdgeTypes,
  MarkerType,
  ReactFlowInstance,
  XYPosition,
  getConnectedEdges,
  getIncomers,
  getOutgoers,
} from "reactflow";
import "reactflow/dist/style.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, Plus, Save } from "lucide-react";

import { BuilderContext, DeletableEdge, FlowNode, type BuilderContextValue } from "./workflow-nodes";
import { NodeInspector } from "./node-inspector";
import { NodePicker } from "./node-picker";
import { WorkflowNode as WorkflowNodeType, WorkflowNodeData } from "@/lib/types/workflow";
import { serializeWorkflow, deserializeWorkflow } from "@/lib/workflow-serializer";
import { buildNodeData, type CatalogItem, type PickerFilter } from "@/lib/workflow-catalog";

const nodeTypes: NodeTypes = {
  trigger: FlowNode,
  logic: FlowNode,
  action: FlowNode,
};

const edgeTypes: EdgeTypes = {
  deletable: DeletableEdge,
};

const EDGE_DEFAULTS = { type: "deletable", markerEnd: { type: MarkerType.ArrowClosed } };

// Spacing between two chained steps (left-to-right flow)
const X_GAP = 290;
const BRANCH_GAP = 70;
const NODE_W = 210;
const NODE_H = 64;

type Panel =
  | { kind: "picker"; allowTriggers: boolean; initialFilter: PickerFilter; anchor?: { id: string; handle?: string } }
  | { kind: "inspector"; nodeId: string }
  | null;

interface WorkflowBuilderProps {
  workflowId?: string;
}

export function WorkflowBuilder({ workflowId }: WorkflowBuilderProps) {
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState("Mon workflow");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>(workflowId);
  const [panel, setPanel] = useState<Panel>(null);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [fitPending, setFitPending] = useState(false);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load an existing workflow for editing (new ones start empty, like n8n)
  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (!res.ok) return;
        const wf = await res.json();
        if (cancelled) return;
        setWorkflowName(wf.name || "Mon workflow");
        setWorkflowDescription(wf.description || "");
        setIsActive(!!wf.isActive);
        setSavedId(wf.id);
        const { nodes: n, edges: e } = deserializeWorkflow(wf.config || { nodes: [], edges: [] });
        setNodes(n);
        setEdges(e.map((edge) => ({ ...edge, ...EDGE_DEFAULTS })));
        setFitPending(true);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  useEffect(() => {
    if (!fitPending || !flow || nodes.length === 0) return;
    requestAnimationFrame(() => flow.fitView({ padding: 0.3, maxZoom: 1 }));
    setFitPending(false);
  }, [fitPending, flow, nodes.length]);

  const isConnected = useCallback(
    (id: string, handle?: string) =>
      edges.some((e) => e.source === id && (e.sourceHandle || undefined) === (handle || undefined)),
    [edges],
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, ...EDGE_DEFAULTS }, eds)),
    [setEdges],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== id));
      setHoveredEdge(null);
    },
    [setEdges],
  );

  // Deleting a middle step reconnects its neighbours
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      setEdges(
        deleted.reduce((acc, node) => {
          const incomers = getIncomers(node, nodes, edges);
          const outgoers = getOutgoers(node, nodes, edges);
          const connectedEdges = getConnectedEdges([node], edges);
          const remainingEdges = acc.filter((edge) => !connectedEdges.includes(edge));
          const createdEdges: Edge[] = incomers.flatMap(({ id: source }) =>
            outgoers.map(({ id: target }) => ({ id: `${source}->${target}`, source, target, ...EDGE_DEFAULTS })),
          );
          return [...remainingEdges, ...createdEdges];
        }, edges),
      );
      setPanel((p) => (p?.kind === "inspector" && deleted.some((n) => n.id === p.nodeId) ? null : p));
    },
    [nodes, edges, setEdges],
  );

  const deleteNode = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      setNodes((nds) => nds.filter((n) => n.id !== id));
      onNodesDelete([node]);
    },
    [nodes, setNodes, onNodesDelete],
  );

  const updateNode = useCallback(
    (updated: WorkflowNodeType) => setNodes((nds) => nds.map((n) => (n.id === updated.id ? updated : n))),
    [setNodes],
  );

  // Add the node picked in the search panel. From a step's "+", it is chained after that step;
  // otherwise it is dropped freely in the middle of the canvas, unconnected (full freedom).
  const addFromCatalog = (item: CatalogItem) => {
    const id = `${item.kind}-${Date.now()}`;
    const anchorInfo = panel?.kind === "picker" ? panel.anchor : undefined;
    const anchor = anchorInfo ? nodes.find((n) => n.id === anchorInfo.id) : undefined;
    const handle = anchorInfo?.handle;
    const newEdges: Edge[] = [];
    let position: XYPosition;

    if (anchor) {
      const dy = handle === "true" ? -BRANCH_GAP : handle === "false" ? BRANCH_GAP : 0;
      position = { x: anchor.position.x + X_GAP, y: anchor.position.y + dy };
      newEdges.push({
        id: `${anchor.id}${handle ? `-${handle}` : ""}->${id}`,
        source: anchor.id,
        sourceHandle: handle,
        target: id,
        ...EDGE_DEFAULTS,
      });
    } else {
      const rect = canvasRef.current?.getBoundingClientRect();
      position =
        flow && rect
          ? flow.project({ x: rect.width / 2 - NODE_W / 2, y: rect.height / 2 - NODE_H / 2 })
          : { x: 0, y: 0 };
    }

    // Avoid dropping the node on top of another one
    while (nodes.some((n) => Math.abs(n.position.x - position.x) < 60 && Math.abs(n.position.y - position.y) < 60)) {
      position = { ...position, y: position.y + 110 };
    }

    const newNode: Node<WorkflowNodeData> = { id, type: item.kind, position, data: buildNodeData(item.kind, item.key) };
    setNodes((nds) => [...nds, newNode]);
    if (newEdges.length) setEdges((eds) => [...eds, ...newEdges]);

    // Open the settings right away when the step has something to configure
    const hasParams = Object.keys(newNode.data.config.parameters || {}).length > 0;
    setPanel(hasParams ? { kind: "inspector", nodeId: id } : null);
  };

  const builderContext = useMemo<BuilderContextValue>(
    () => ({
      onDelete: deleteNode,
      onAddAfter: (id, handle) =>
        setPanel({ kind: "picker", allowTriggers: false, initialFilter: "all", anchor: { id, handle } }),
      isConnected,
      onDeleteEdge: deleteEdge,
      hoveredEdge,
      setHoveredEdge,
    }),
    [deleteNode, isConnected, deleteEdge, hoveredEdge],
  );

  const saveWorkflow = useCallback(async () => {
    if (!workflowName.trim()) {
      toast({ title: "Nom manquant", description: "Donne un nom à ton workflow.", variant: "destructive" });
      return;
    }
    if (nodes.length === 0) {
      toast({ title: "Workflow vide", description: "Ajoute au moins un nœud.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(savedId ? `/api/workflows/${savedId}` : "/api/workflows", {
        method: savedId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflowName,
          description: workflowDescription,
          config: serializeWorkflow(nodes, edges),
          isActive,
        }),
      });
      if (!response.ok) throw new Error("Erreur lors de la sauvegarde");

      const data = await response.json();
      if (data?.id) setSavedId(data.id);
      toast({ title: "Workflow enregistré" });
      return (data?.id as string | undefined) ?? savedId;
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [workflowName, workflowDescription, nodes, edges, isActive, savedId, toast]);

  const executeWorkflow = useCallback(async () => {
    setIsExecuting(true);
    try {
      // Save first so the latest version runs from the database (secure path)
      const id = await saveWorkflow();
      if (!id) return;

      const response = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de l'exécution");

      toast({ title: "✅ Workflow exécuté" });
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  }, [saveWorkflow, toast]);

  const selectedNode =
    panel?.kind === "inspector" ? (nodes.find((n) => n.id === panel.nodeId) as WorkflowNodeType | undefined) : undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 sm:p-3">
        <Input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          aria-label="Nom du workflow"
          className="h-9 flex-1 min-w-[180px] font-semibold"
        />
        <label
          className="flex items-center gap-2 text-sm px-2 cursor-pointer"
          title="Exécute automatiquement les workflows « Programmé » et « E-mail reçu »"
        >
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          Actif
        </label>
        <Button variant="outline" size="sm" onClick={executeWorkflow} disabled={isExecuting || isSaving}>
          {isExecuting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Play className="size-4 mr-2" />}
          Exécuter
        </Button>
        <Button size="sm" onClick={() => saveWorkflow()} disabled={isSaving}>
          {isSaving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
          Enregistrer
        </Button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative h-[calc(100dvh-15rem)] min-h-[460px] rounded-xl border overflow-hidden bg-muted/20"
      >
        <BuilderContext.Provider value={builderContext}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodesDelete={onNodesDelete}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={setFlow}
            onNodeClick={(_, node) => setPanel({ kind: "inspector", nodeId: node.id })}
            onPaneClick={() => setPanel(null)}
            onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)}
            onEdgeMouseLeave={() => setHoveredEdge(null)}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </BuilderContext.Provider>

        {/* Empty canvas: add the first trigger */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              type="button"
              onClick={() => setPanel({ kind: "picker", allowTriggers: true, initialFilter: "trigger" })}
              className="pointer-events-auto group flex flex-col items-center gap-3 p-4"
            >
              <span className="size-24 rounded-2xl border-2 border-dashed border-muted-foreground/40 bg-background text-muted-foreground flex items-center justify-center transition-colors group-hover:border-primary group-hover:text-primary">
                <Plus className="size-10" />
              </span>
              <span className="text-sm font-medium">Ajouter un premier déclencheur</span>
              <span className="text-xs text-muted-foreground max-w-[260px] text-center">
                Choisis ce qui lance ton workflow : un clic, une heure précise, un nouveau mail…
              </span>
            </button>
          </div>
        )}

        {/* Floating "+": any node, triggers included */}
        {nodes.length > 0 && !panel && (
          <Button
            size="icon"
            className="absolute top-3 right-3 z-10 shadow-md"
            onClick={() => setPanel({ kind: "picker", allowTriggers: true, initialFilter: "all" })}
            title="Ajouter un nœud"
          >
            <Plus className="size-5" />
          </Button>
        )}

        {/* Side panel: node search or node settings */}
        {panel && (
          <div className="absolute inset-y-0 right-0 z-20 w-full sm:w-[360px] border-l bg-background shadow-xl">
            {panel.kind === "picker" ? (
              <NodePicker
                key={`${panel.anchor?.id ?? "free"}-${panel.anchor?.handle ?? ""}-${panel.initialFilter}`}
                allowTriggers={panel.allowTriggers}
                initialFilter={panel.initialFilter}
                onSelect={addFromCatalog}
                onClose={() => setPanel(null)}
              />
            ) : (
              selectedNode && (
                <NodeInspector
                  key={selectedNode.id}
                  node={selectedNode}
                  onUpdateNode={updateNode}
                  onDelete={() => deleteNode(selectedNode.id)}
                  onClose={() => setPanel(null)}
                />
              )
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Astuce : le <strong>+</strong> au bout d'une étape ajoute la suivante, le <strong>+</strong> en haut à droite
        ajoute n'importe quel nœud (même un 2ᵉ déclencheur). Relie deux étapes en tirant un trait entre leurs points,
        survole une liaison et clique sur la corbeille pour la supprimer.
      </p>
    </div>
  );
}
