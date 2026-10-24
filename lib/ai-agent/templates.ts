/**
 * Ready-to-use workflow templates.
 *
 * These let a user create a working automation in one click, without having to
 * build a node graph by hand. Each template produces a valid WorkflowConfig
 * understood by the workflow runner.
 */

import { WorkflowConfig } from '../types/workflow';
import { TRIGGER_NODES, LOGIC_NODES, ACTION_NODES } from '../types/workflow';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: WorkflowConfig;
}

/** Build a node in the shape the runner + builder expect. */
function node(
  id: string,
  type: 'trigger' | 'logic' | 'action',
  subtype: string,
  x: number,
  parameters: Record<string, any> = {}
) {
  const registry =
    type === 'trigger' ? TRIGGER_NODES : type === 'logic' ? LOGIC_NODES : ACTION_NODES;
  const config = (registry as any)[subtype];
  return {
    id,
    type,
    position: { x, y: 150 },
    data: {
      type,
      label: config.name,
      config,
      parameters,
    },
  } as any;
}

function chain(...ids: string[]) {
  const edges = [];
  for (let i = 0; i < ids.length - 1; i++) {
    edges.push({ id: `${ids[i]}->${ids[i + 1]}`, source: ids[i], target: ids[i + 1] });
  }
  return edges as any;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'sort-emails',
    name: 'Trier mes mails',
    description: "Range automatiquement tes mails non lus par catégorie (à traiter, promo, à garder…) grâce à l'IA.",
    icon: '🧠',
    config: {
      nodes: [
        node('t1', 'trigger', 'manual', 50),
        node('a1', 'action', 'gmail_read', 300, { query: 'is:unread', maxResults: 20 }),
        node('a2', 'action', 'gmail_classify', 550, { query: 'is:unread', maxResults: 20 }),
      ],
      edges: chain('t1', 'a1', 'a2'),
    },
  },
  {
    id: 'mail-to-calendar',
    name: 'Mail → Agenda',
    description: "Détecte les rendez-vous dans tes mails récents et les ajoute automatiquement à ton agenda.",
    icon: '📅',
    config: {
      nodes: [
        node('t1', 'trigger', 'manual', 50),
        node('a1', 'action', 'gmail_read', 300, { query: 'newer_than:7d', maxResults: 15 }),
        node('a2', 'action', 'calendar_create', 550),
      ],
      edges: chain('t1', 'a1', 'a2'),
    },
  },
  {
    id: 'track-applications',
    name: 'Suivi de mes candidatures',
    description: "Repère les mails de confirmation de candidature et les ajoute à ta page Suivi de demande.",
    icon: '💼',
    config: {
      nodes: [
        node('t1', 'trigger', 'manual', 50),
        node('a1', 'action', 'track_application', 300, { query: 'newer_than:30d', maxResults: 30 }),
      ],
      edges: chain('t1', 'a1'),
    },
  },
  {
    id: 'clean-promos',
    name: 'Nettoyer les pubs',
    description: "Marque les mails promotionnels « À supprimer » (à valider) pour garder une boîte propre.",
    icon: '🗑️',
    config: {
      nodes: [
        node('t1', 'trigger', 'manual', 50),
        node('a1', 'action', 'gmail_delete', 300, { query: 'category:promotions', permanent: false }),
      ],
      edges: chain('t1', 'a1'),
    },
  },
];

export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
