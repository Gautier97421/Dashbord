/**
 * Catalogue des nœuds du constructeur de workflows (façon n8n) :
 * description, groupe et mots-clés pour la barre de recherche.
 */

import {
  TRIGGER_NODES,
  LOGIC_NODES,
  ACTION_NODES,
  type WorkflowNodeType,
  type WorkflowNodeData,
} from '@/lib/types/workflow';

export interface CatalogItem {
  kind: WorkflowNodeType;
  key: string;
  name: string;
  description: string;
  group: string;
  keywords: string;
}

// Ordre d'affichage des groupes dans le sélecteur de nœuds
export const GROUP_ORDER = [
  'Déclencheurs',
  'Gmail',
  'Outlook',
  'Agenda',
  'Application',
  'Discord',
  'Slack',
  'Telegram',
  'Notion',
  'GitHub',
  'Trello',
  'Web',
  'Code',
  'Logique',
];

// Filtres par type dans le sélecteur
export type PickerFilter = 'all' | WorkflowNodeType;

export const KIND_LABELS: Record<WorkflowNodeType, string> = {
  trigger: 'Déclencheurs',
  action: 'Actions',
  logic: 'Logique & code',
};

// Words that let the search box match a whole type ("déclencheur", "logique"…)
const KIND_KEYWORDS: Record<WorkflowNodeType, string> = {
  trigger: 'declencheur declencheurs trigger demarrage',
  action: 'action actions',
  logic: 'logique code condition',
};

const META: Record<string, { description: string; group: string; keywords?: string }> = {
  'trigger:manual': { description: 'Lance le workflow quand tu cliques sur « Exécuter ».', group: 'Déclencheurs', keywords: 'bouton clic lancer manuel' },
  'trigger:scheduled': { description: 'Lance le workflow tout seul chaque jour, semaine ou mois.', group: 'Déclencheurs', keywords: 'planifié horaire heure cron automatique' },
  'trigger:email_received': { description: 'Se déclenche quand un nouveau mail arrive.', group: 'Déclencheurs', keywords: 'gmail mail reçu nouveau' },
  'trigger:calendar_event': { description: "Se déclenche sur un événement de l'agenda.", group: 'Déclencheurs', keywords: 'agenda calendrier rendez-vous' },
  'trigger:webhook': { description: "Reçoit un appel HTTP (POST) d'un service externe.", group: 'Déclencheurs', keywords: 'url http api externe' },

  'action:gmail_read': { description: 'Récupère des mails selon une recherche Gmail.', group: 'Gmail', keywords: 'mail lire récupérer boîte' },
  'action:gmail_classify': { description: "Trie tes mails par catégorie avec l'IA.", group: 'Gmail', keywords: 'ia trier classer catégorie' },
  'action:gmail_send': { description: 'Envoie un mail (validé par toi en mode sécurisé).', group: 'Gmail', keywords: 'mail envoyer écrire' },
  'action:gmail_label': { description: 'Ajoute un label aux mails trouvés.', group: 'Gmail', keywords: 'étiquette tag label' },
  'action:gmail_move': { description: 'Range les mails trouvés dans un dossier.', group: 'Gmail', keywords: 'dossier ranger déplacer' },
  'action:gmail_delete': { description: 'Supprime les mails trouvés (ou les marque « À supprimer »).', group: 'Gmail', keywords: 'supprimer effacer nettoyer corbeille' },
  'action:outlook_read': { description: 'Récupère des mails de ta boîte Outlook.', group: 'Outlook', keywords: 'microsoft hotmail mail lire récupérer' },
  'action:outlook_send': { description: 'Envoie un mail depuis Outlook (validé par toi en mode sécurisé).', group: 'Outlook', keywords: 'microsoft hotmail mail envoyer' },
  'action:outlook_move': { description: 'Range des mails Outlook dans un dossier.', group: 'Outlook', keywords: 'microsoft hotmail dossier ranger déplacer' },
  'action:calendar_create': { description: "Repère les rendez-vous dans tes mails et les ajoute à l'agenda.", group: 'Agenda', keywords: 'ia calendrier rendez-vous événement' },
  'action:track_application': { description: 'Ajoute les confirmations de candidature à ton suivi de demande.', group: 'Application', keywords: 'ia candidature emploi suivi' },
  'action:notify': { description: "Affiche une notification dans l'app.", group: 'Application', keywords: 'alerte notification rappel cloche' },
  'action:discord_send': { description: 'Poste un message dans un salon Discord.', group: 'Discord', keywords: 'message salon webhook' },
  'action:slack_send': { description: 'Poste un message dans un canal Slack.', group: 'Slack', keywords: 'message canal webhook' },
  'action:telegram_send': { description: 'Envoie un message avec ton bot Telegram.', group: 'Telegram', keywords: 'message bot' },
  'action:notion_create': { description: 'Crée une page dans Notion.', group: 'Notion', keywords: 'page note' },
  'action:github_issue': { description: 'Crée une issue dans un dépôt GitHub.', group: 'GitHub', keywords: 'issue bug ticket dépôt repo' },
  'action:trello_card': { description: 'Ajoute une carte dans une liste Trello.', group: 'Trello', keywords: 'carte tâche liste tableau' },
  'action:http_request': { description: "Appelle n'importe quelle API web.", group: 'Web', keywords: 'http api requête url get post' },

  'logic:code': { description: 'Écris ton propre JavaScript pour transformer les données.', group: 'Code', keywords: 'javascript js script programmer fonction' },
  'logic:filter': { description: 'Ne continue que si une donnée correspond.', group: 'Logique', keywords: 'filtre condition' },
  'logic:if_then': { description: 'Sépare le workflow en deux branches : vrai / faux.', group: 'Logique', keywords: 'si alors condition branche' },
  'logic:delay': { description: 'Attend un moment avant de continuer.', group: 'Logique', keywords: 'attendre pause délai' },
  'logic:transform': { description: 'Modifie ou reformate les données.', group: 'Logique', keywords: 'modifier formater transformer' },
};

function registry(kind: WorkflowNodeType): Record<string, any> {
  return kind === 'trigger' ? TRIGGER_NODES : kind === 'logic' ? LOGIC_NODES : ACTION_NODES;
}

export const NODE_CATALOG: CatalogItem[] = (['trigger', 'action', 'logic'] as WorkflowNodeType[]).flatMap((kind) =>
  Object.values(registry(kind)).map((cfg: any) => {
    const meta = META[`${kind}:${cfg.type}`];
    return {
      kind,
      key: cfg.type,
      name: cfg.name,
      description: meta?.description ?? '',
      group: meta?.group ?? (kind === 'trigger' ? 'Déclencheurs' : kind === 'logic' ? 'Logique' : 'Application'),
      keywords: meta?.keywords ?? '',
    };
  })
);

export function getCatalogItem(kind: string, key: string | undefined): CatalogItem | undefined {
  return NODE_CATALOG.find((item) => item.kind === kind && item.key === key);
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Every word typed must appear in the name, description, group, keywords or type
export function searchCatalog(query: string, kinds: WorkflowNodeType[]): CatalogItem[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return NODE_CATALOG.filter((item) => {
    if (!kinds.includes(item.kind)) return false;
    const haystack = normalize(
      `${item.name} ${item.description} ${item.group} ${item.keywords} ${KIND_KEYWORDS[item.kind]}`
    );
    return words.every((w) => haystack.includes(w));
  });
}

export function groupItems(items: CatalogItem[]): [string, CatalogItem[]][] {
  const groups = new Map<string, CatalogItem[]>(GROUP_ORDER.map((g) => [g, []]));
  for (const item of items) {
    if (!groups.has(item.group)) groups.set(item.group, []);
    groups.get(item.group)!.push(item);
  }
  return [...groups.entries()].filter(([, list]) => list.length > 0);
}

// Données d'un nouveau nœud, avec les valeurs par défaut de ses paramètres
export function buildNodeData(kind: WorkflowNodeType, key: string): WorkflowNodeData {
  const config = registry(kind)[key];
  const parameters: Record<string, any> = {};
  for (const [name, param] of Object.entries<any>(config.parameters || {})) {
    if (param.default !== undefined) parameters[name] = param.default;
  }
  return { type: kind, label: config.name, config, parameters };
}
