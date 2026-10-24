'use client';

import React, { createContext, useContext } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, Handle, Position, NodeProps, getSmoothStepPath } from 'reactflow';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkflowNodeData } from '@/lib/types/workflow';
import { getCatalogItem } from '@/lib/workflow-catalog';
import { NodeIcon } from './node-icon';

export interface BuilderContextValue {
  onDelete: (id: string) => void;
  onAddAfter: (id: string, handle?: string) => void;
  isConnected: (id: string, handle?: string) => boolean;
  onDeleteEdge: (id: string) => void;
  hoveredEdge: string | null;
  setHoveredEdge: (id: string | null) => void;
}

export const BuilderContext = createContext<BuilderContextValue | null>(null);

const HANDLE_CLASS = '!w-3 !h-3 !border-2 !border-background !bg-muted-foreground';

// « + » au bout d'une sortie libre : ajoute l'étape suivante, comme dans n8n
function AddNextButton({ nodeId, handle, top }: { nodeId: string; handle?: string; top: string }) {
  const ctx = useContext(BuilderContext);
  if (!ctx || ctx.isConnected(nodeId, handle)) return null;

  return (
    <div className="absolute left-full ml-1.5 flex items-center -translate-y-1/2 pointer-events-none" style={{ top }}>
      <div className="w-7 h-px bg-muted-foreground/50" />
      <button
        type="button"
        title="Ajouter l'étape suivante"
        onClick={(e) => {
          e.stopPropagation();
          ctx.onAddAfter(nodeId, handle);
        }}
        className="nodrag nopan pointer-events-auto size-7 rounded-md border-2 border-dashed border-muted-foreground/50 bg-background text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center transition-colors"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function FlowNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const ctx = useContext(BuilderContext);
  const kind = data.type;
  const configType = (data.config as any)?.type as string | undefined;
  const item = getCatalogItem(kind, configType);
  const isIf = kind === 'logic' && configType === 'if_then';

  return (
    <div className="group relative">
      {kind !== 'trigger' && <Handle type="target" position={Position.Left} className={HANDLE_CLASS} />}

      <div
        className={cn(
          'w-[210px] flex items-center gap-3 p-3 border-2 bg-card text-card-foreground shadow-sm transition-colors',
          kind === 'trigger' ? 'rounded-l-[36px] rounded-r-xl pl-4' : 'rounded-xl',
          isIf && 'pr-10',
          selected ? 'border-primary shadow-md' : 'border-border hover:border-primary/50',
        )}
      >
        <NodeIcon kind={kind} nodeKey={configType} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{data.label}</p>
          <p className="text-[11px] text-muted-foreground truncate">{item?.group ?? data.config?.name}</p>
        </div>
        {isIf && (
          <>
            <span className="absolute right-2 top-[30%] -translate-y-1/2 text-[10px] font-semibold text-green-600">vrai</span>
            <span className="absolute right-2 top-[70%] -translate-y-1/2 text-[10px] font-semibold text-red-600">faux</span>
          </>
        )}
      </div>

      {ctx && (
        <button
          type="button"
          title="Supprimer l'étape"
          onClick={(e) => {
            e.stopPropagation();
            ctx.onDelete(id);
          }}
          className={cn(
            'nodrag absolute -top-2.5 -right-2.5 size-6 rounded-full border bg-background text-muted-foreground hover:text-destructive hover:border-destructive flex items-center justify-center transition-opacity',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <Trash2 className="size-3" />
        </button>
      )}

      {isIf ? (
        <>
          <Handle type="source" id="true" position={Position.Right} style={{ top: '30%' }} className={cn(HANDLE_CLASS, '!bg-green-600')} />
          <Handle type="source" id="false" position={Position.Right} style={{ top: '70%' }} className={cn(HANDLE_CLASS, '!bg-red-600')} />
          <AddNextButton nodeId={id} handle="true" top="30%" />
          <AddNextButton nodeId={id} handle="false" top="70%" />
        </>
      ) : (
        <>
          <Handle type="source" position={Position.Right} className={HANDLE_CLASS} />
          <AddNextButton nodeId={id} top="50%" />
        </>
      )}
    </div>
  );
}

// Link between two steps: hovering or selecting it shows a bin to remove it (like n8n)
export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
}: EdgeProps) {
  const ctx = useContext(BuilderContext);
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const visible = selected || ctx?.hoveredEdge === id;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={24}
        style={{ ...style, strokeWidth: visible ? 2.5 : 1.5, stroke: visible ? 'var(--primary)' : undefined }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
          onMouseEnter={() => ctx?.setHoveredEdge(id)}
          onMouseLeave={() => ctx?.setHoveredEdge(null)}
        >
          <button
            type="button"
            title="Supprimer la liaison"
            onClick={(e) => {
              e.stopPropagation();
              ctx?.onDeleteEdge(id);
            }}
            className={cn(
              'size-7 rounded-full border bg-background text-muted-foreground shadow-sm flex items-center justify-center transition-opacity hover:text-destructive hover:border-destructive',
              visible ? 'opacity-100' : 'opacity-0',
            )}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
