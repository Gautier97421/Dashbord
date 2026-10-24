/**
 * Workflow serialization utilities
 * Converts ReactFlow nodes/edges to JSON-safe format for database storage
 */

import { Node, Edge } from 'reactflow';
import { WorkflowNodeData, TRIGGER_NODES, LOGIC_NODES, ACTION_NODES } from '@/lib/types/workflow';

/**
 * Serialize nodes for JSON storage (remove non-serializable properties)
 */
export function serializeNodes(nodes: Node<WorkflowNodeData>[]): any[] {
  return nodes.map(node => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: {
      type: node.data.type,
      label: node.data.label,
      config: {
        // The runner and the cron rely on config.type to know what the node does
        type: (node.data.config as any).type,
        name: node.data.config.name,
        icon: node.data.config.icon,
        service: 'service' in node.data.config ? node.data.config.service : undefined,
        parameters: node.data.config.parameters,
        // Don't include functions or other non-serializable properties
      },
      parameters: node.data.parameters,
    },
  }));
}

/**
 * Serialize edges for JSON storage
 */
export function serializeEdges(edges: Edge[]): any[] {
  return edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  }));
}

/**
 * Serialize complete workflow configuration
 */
export function serializeWorkflow(nodes: Node<WorkflowNodeData>[], edges: Edge[]) {
  return {
    nodes: serializeNodes(nodes),
    edges: serializeEdges(edges),
  };
}

/**
 * Older saves dropped config.type — recover it from the node name so the
 * workflow runs again once re-saved.
 */
function repairConfig(nodeType: string, config: any) {
  if (!config || config.type) return config;
  const registry: Record<string, any> =
    nodeType === 'trigger' ? TRIGGER_NODES : nodeType === 'logic' ? LOGIC_NODES : ACTION_NODES;
  const match = Object.values(registry).find((c: any) => c.name === config.name);
  return match ? { ...config, type: match.type } : config;
}

/**
 * Deserialize nodes from database JSON
 */
export function deserializeNodes(data: any[]): Node<WorkflowNodeData>[] {
  return data.map(item => ({
    id: item.id,
    type: item.type,
    position: item.position,
    data: {
      type: item.data.type,
      label: item.data.label,
      config: repairConfig(item.type, item.data.config),
      parameters: item.data.parameters || {},
    },
  }));
}

/**
 * Deserialize edges from database JSON
 */
export function deserializeEdges(data: any[]): Edge[] {
  return data.map(item => ({
    id: item.id,
    source: item.source,
    target: item.target,
    sourceHandle: item.sourceHandle,
    targetHandle: item.targetHandle,
  }));
}

/**
 * Deserialize complete workflow configuration
 */
export function deserializeWorkflow(config: any) {
  return {
    nodes: deserializeNodes(config.nodes || []),
    edges: deserializeEdges(config.edges || []),
  };
}
