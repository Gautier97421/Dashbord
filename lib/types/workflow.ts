import { Node, Edge } from 'reactflow';

// Trigger Types
export type TriggerType = 'manual' | 'email_received' | 'calendar_event' | 'scheduled' | 'webhook';

export interface TriggerConfig {
  type: TriggerType;
  name: string;
  icon: string;
  parameters?: Record<string, any>;
}

// Logic Types
export type LogicType = 'filter' | 'if_then' | 'delay' | 'transform' | 'code';

export interface LogicConfig {
  type: LogicType;
  name: string;
  icon: string;
  parameters?: Record<string, any>;
  condition?: string; // For if_then
  trueOutput?: string;
  falseOutput?: string;
}

// Action Types
export type ActionType =
  | 'gmail_read'
  | 'gmail_send'
  | 'gmail_label'
  | 'gmail_move'
  | 'gmail_delete'
  | 'gmail_classify'
  | 'outlook_read'
  | 'outlook_send'
  | 'outlook_move'
  | 'calendar_create'
  | 'track_application'
  | 'http_request'
  | 'discord_send'
  | 'slack_send'
  | 'telegram_send'
  | 'notion_create'
  | 'github_issue'
  | 'trello_card'
  | 'notify';

export interface ActionConfig {
  type: ActionType;
  name: string;
  icon: string;
  service:
    | 'gmail'
    | 'outlook'
    | 'calendar'
    | 'applications'
    | 'http'
    | 'discord'
    | 'slack'
    | 'telegram'
    | 'notion'
    | 'github'
    | 'trello'
    | 'system';
  parameters?: Record<string, any>;
}

// Workflow Node Types
export type WorkflowNodeType = 'trigger' | 'logic' | 'action';

export interface WorkflowNodeData {
  type: WorkflowNodeType;
  label: string;
  config: TriggerConfig | LogicConfig | ActionConfig;
  parameters?: Record<string, any>;
}

export interface WorkflowNode extends Node<WorkflowNodeData> {
  type: WorkflowNodeType;
}

export type WorkflowEdge = Edge;

// Workflow Structure
export interface WorkflowConfig {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: {
    name: string;
    description?: string;
    version: number;
  };
}

// API Types
export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  config: WorkflowConfig;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  config?: WorkflowConfig;
  isActive?: boolean;
}

export interface WorkflowResponse {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'inactive' | 'error';
  isActive: boolean;
  config: WorkflowConfig;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecutionRequest {
  workflowId: string;
  input?: Record<string, any>;
}

export interface WorkflowExecutionResponse {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  output?: Record<string, any>;
  error?: string;
  executedAt: string;
  completedAt?: string;
}

const DEFAULT_CODE = `// « data » contient les données des étapes précédentes (ex : data.emails).
// Retourne un objet : ses champs sont ajoutés aux données pour les étapes suivantes.
const emails = data.emails || [];
return { nombreDeMails: emails.length };`;

// Node Registry Types
export const TRIGGER_NODES: Record<TriggerType, TriggerConfig> = {
  manual: {
    type: 'manual',
    name: 'Manuel',
    icon: '👆',
  },
  email_received: {
    type: 'email_received',
    name: 'E-mail reçu',
    icon: '📧',
    parameters: {
      from: { type: 'string', label: 'De', required: false },
      subject: { type: 'string', label: 'Objet', required: false },
    },
  },
  calendar_event: {
    type: 'calendar_event',
    name: 'Événement calendrier',
    icon: '📅',
    parameters: {
      calendar: { type: 'string', label: 'Calendrier', required: false },
      eventType: { type: 'select', label: 'Type', options: ['create', 'update', 'delete'], required: false },
    },
  },
  scheduled: {
    type: 'scheduled',
    name: 'Programmé',
    icon: '⏰',
    parameters: {
      frequency: { type: 'select', label: 'Fréquence', options: ['daily', 'weekly', 'monthly'], required: true },
      time: { type: 'time', label: 'Heure', required: true },
    },
  },
  webhook: {
    type: 'webhook',
    name: 'Webhook (URL entrante)',
    icon: '🪝',
    parameters: {},
  },
};

export const LOGIC_NODES: Record<LogicType, LogicConfig> = {
  filter: {
    type: 'filter',
    name: 'Filtre',
    icon: '🔍',
    parameters: {
      field: { type: 'string', label: 'Champ', required: true },
      operator: { type: 'select', label: 'Opérateur', options: ['equals', 'contains', 'startsWith', 'endsWith'], required: true },
      value: { type: 'string', label: 'Valeur', required: true },
    },
  },
  if_then: {
    type: 'if_then',
    name: 'Si / Alors',
    icon: '❓',
    parameters: {
      condition: { type: 'string', label: 'Condition', required: true },
    },
  },
  delay: {
    type: 'delay',
    name: 'Délai',
    icon: '⏳',
    parameters: {
      duration: { type: 'number', label: 'Durée (ms)', required: true },
    },
  },
  transform: {
    type: 'transform',
    name: 'Transformer',
    icon: '🔄',
    parameters: {
      transformation: { type: 'string', label: 'Transformation', required: true },
    },
  },
  code: {
    type: 'code',
    name: 'Code (JavaScript)',
    icon: '💻',
    parameters: {
      code: { type: 'code', label: 'Code JavaScript', required: true, default: DEFAULT_CODE },
    },
  },
};

export const ACTION_NODES: Record<ActionType, ActionConfig> = {
  gmail_read: {
    type: 'gmail_read',
    name: 'Lire emails',
    icon: '📖',
    service: 'gmail',
    parameters: {
      query: { type: 'string', label: 'Requête Gmail', required: false },
      maxResults: { type: 'number', label: 'Max résultats', required: false, default: 10 },
    },
  },
  gmail_send: {
    type: 'gmail_send',
    name: 'Envoyer email',
    icon: '📤',
    service: 'gmail',
    parameters: {
      to: { type: 'string', label: 'Destinataire', required: true },
      subject: { type: 'string', label: 'Objet', required: true },
      body: { type: 'text', label: 'Corps', required: true },
    },
  },
  gmail_label: {
    type: 'gmail_label',
    name: 'Ajouter label',
    icon: '🏷️',
    service: 'gmail',
    parameters: {
      label: { type: 'string', label: 'Label', required: true },
      query: { type: 'string', label: 'Requête', required: true },
    },
  },
  gmail_move: {
    type: 'gmail_move',
    name: 'Déplacer emails',
    icon: '📬',
    service: 'gmail',
    parameters: {
      targetLabel: { type: 'string', label: 'Dossier cible', required: true },
      query: { type: 'string', label: 'Requête', required: true },
    },
  },
  gmail_delete: {
    type: 'gmail_delete',
    name: 'Supprimer emails',
    icon: '🗑️',
    service: 'gmail',
    parameters: {
      query: { type: 'string', label: 'Requête', required: true },
      permanent: { type: 'boolean', label: 'Supprimer définitivement', required: false },
    },
  },
  gmail_classify: {
    type: 'gmail_classify',
    name: 'Trier emails (IA)',
    icon: '🧠',
    service: 'gmail',
    parameters: {
      query: { type: 'string', label: 'Requête Gmail', required: false, default: 'is:unread' },
      maxResults: { type: 'number', label: 'Max résultats', required: false, default: 20 },
    },
  },
  outlook_read: {
    type: 'outlook_read',
    name: 'Lire emails Outlook',
    icon: '📨',
    service: 'outlook',
    parameters: {
      search: { type: 'string', label: 'Recherche', required: false },
      folder: { type: 'string', label: 'Dossier', required: false, default: 'inbox' },
      maxResults: { type: 'number', label: 'Max résultats', required: false, default: 10 },
    },
  },
  outlook_send: {
    type: 'outlook_send',
    name: 'Envoyer email Outlook',
    icon: '📤',
    service: 'outlook',
    parameters: {
      to: { type: 'string', label: 'Destinataire', required: true },
      subject: { type: 'string', label: 'Objet', required: true },
      body: { type: 'text', label: 'Corps', required: true },
    },
  },
  outlook_move: {
    type: 'outlook_move',
    name: 'Déplacer emails Outlook',
    icon: '📬',
    service: 'outlook',
    parameters: {
      folder: { type: 'string', label: 'Dossier cible', required: true },
      search: { type: 'string', label: 'Recherche', required: false },
    },
  },
  calendar_create: {
    type: 'calendar_create',
    name: 'Mail → Agenda (IA)',
    icon: '📅',
    service: 'calendar',
    parameters: {},
  },
  track_application: {
    type: 'track_application',
    name: 'Suivi candidatures (IA)',
    icon: '💼',
    service: 'applications',
    parameters: {
      query: { type: 'string', label: 'Requête Gmail', required: false, default: 'newer_than:7d' },
      maxResults: { type: 'number', label: 'Max résultats', required: false, default: 20 },
    },
  },
  http_request: {
    type: 'http_request',
    name: 'Requête HTTP (toute API)',
    icon: '🌐',
    service: 'http',
    parameters: {
      method: { type: 'select', label: 'Méthode', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], required: true, default: 'GET' },
      url: { type: 'string', label: 'URL', required: true },
      headers: { type: 'text', label: 'En-têtes (JSON)', required: false },
      body: { type: 'text', label: 'Corps (texte / JSON)', required: false },
    },
  },
  discord_send: {
    type: 'discord_send',
    name: 'Envoyer sur Discord',
    icon: '💬',
    service: 'discord',
    parameters: {
      webhookUrl: { type: 'string', label: 'URL du webhook Discord', required: true },
      message: { type: 'text', label: 'Message', required: true },
    },
  },
  slack_send: {
    type: 'slack_send',
    name: 'Envoyer sur Slack',
    icon: '💬',
    service: 'slack',
    parameters: {
      webhookUrl: { type: 'string', label: 'URL du webhook Slack', required: true },
      message: { type: 'text', label: 'Message', required: true },
    },
  },
  telegram_send: {
    type: 'telegram_send',
    name: 'Envoyer sur Telegram',
    icon: '✈️',
    service: 'telegram',
    parameters: {
      botToken: { type: 'string', label: 'Token du bot', required: true },
      chatId: { type: 'string', label: 'ID de la conversation', required: true },
      message: { type: 'text', label: 'Message', required: true },
    },
  },
  notion_create: {
    type: 'notion_create',
    name: 'Créer une page Notion',
    icon: '📝',
    service: 'notion',
    parameters: {
      title: { type: 'string', label: 'Titre', required: true },
      content: { type: 'text', label: 'Contenu', required: false },
    },
  },
  github_issue: {
    type: 'github_issue',
    name: 'Créer une issue GitHub',
    icon: '🐙',
    service: 'github',
    parameters: {
      repo: { type: 'string', label: 'Dépôt (propriétaire/nom)', required: true },
      title: { type: 'string', label: 'Titre', required: true },
      body: { type: 'text', label: 'Description', required: false },
    },
  },
  trello_card: {
    type: 'trello_card',
    name: 'Créer une carte Trello',
    icon: '📋',
    service: 'trello',
    parameters: {
      listId: { type: 'string', label: 'ID de la liste', required: true },
      name: { type: 'string', label: 'Titre de la carte', required: true },
      desc: { type: 'text', label: 'Description', required: false },
    },
  },
  notify: {
    type: 'notify',
    name: 'Notifier (dans l\'app)',
    icon: '🔔',
    service: 'system',
    parameters: {
      title: { type: 'string', label: 'Titre', required: true },
      body: { type: 'text', label: 'Message', required: false },
    },
  },
};
