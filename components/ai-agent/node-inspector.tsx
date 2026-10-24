'use client';

import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { WorkflowNode } from '@/lib/types/workflow';
import { getCatalogItem } from '@/lib/workflow-catalog';
import { NodeIcon } from './node-icon';

const OPTION_LABELS: Record<string, string> = {
  daily: 'Chaque jour',
  weekly: 'Chaque semaine',
  monthly: 'Chaque mois',
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  equals: 'est égal à',
  contains: 'contient',
  startsWith: 'commence par',
  endsWith: 'finit par',
};

const PARAM_HINTS: Record<string, string> = {
  query: 'Recherche Gmail, ex : is:unread, from:amazon.fr, newer_than:7d',
  search: 'Mots à chercher dans tes mails (vide = les plus récents)',
  folder: "inbox, archive, ou le nom d'un de tes dossiers",
  webhookUrl: 'URL du webhook fournie par le service (réglages du salon / de l’app)',
  message: 'Insère des données des étapes précédentes avec {{champ}}',
  duration: '1000 ms = 1 seconde',
  repo: 'ex : gautier/mon-projet',
  listId: "Dans Trello : ouvre une carte de la liste, ajoute .json à l'URL et copie « idList »",
  botToken: 'Donné par @BotFather sur Telegram',
  chatId: 'Écris à ton bot, puis ouvre api.telegram.org/bot<token>/getUpdates pour trouver l’id',
  code: 'Bac à sable sécurisé : pas d’accès réseau ni fichiers, 2 secondes maximum.',
};

interface NodeInspectorProps {
  node: WorkflowNode;
  onUpdateNode: (node: WorkflowNode) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function NodeInspector({ node, onUpdateNode, onDelete, onClose }: NodeInspectorProps) {
  const [parameters, setParameters] = useState<Record<string, any>>(node.data.parameters || {});

  const config = node.data.config;
  const configType = (config as any).type as string | undefined;
  const item = getCatalogItem(node.data.type, configType);
  const params: Record<string, any> = config.parameters || {};

  const setParam = (key: string, value: any) => {
    const updated = { ...parameters, [key]: value };
    setParameters(updated);
    onUpdateNode({ ...node, data: { ...node.data, parameters: updated } });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-start gap-3">
        <NodeIcon kind={node.data.type} nodeKey={configType} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{config.name}</p>
          {item?.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
        </div>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onClose} aria-label="Fermer">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="node-label" className="text-xs">Nom de l'étape</Label>
          <Input
            id="node-label"
            value={node.data.label}
            onChange={(e) => onUpdateNode({ ...node, data: { ...node.data, label: e.target.value } })}
          />
        </div>

        {Object.keys(params).length === 0 ? (
          <p className="text-xs text-muted-foreground">Cette étape n'a rien à configurer.</p>
        ) : (
          <div className="space-y-4 pt-4 border-t">
            {Object.entries(params).map(([key, param]: [string, any]) => (
              <div key={key} className="space-y-1.5">
                {param.type === 'boolean' ? (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={key}
                      checked={!!parameters[key]}
                      onCheckedChange={(checked) => setParam(key, checked === true)}
                    />
                    <Label htmlFor={key} className="text-xs cursor-pointer">{param.label || key}</Label>
                  </div>
                ) : (
                  <Label htmlFor={key} className="text-xs">
                    {param.label || key}
                    {param.required && <span className="text-destructive"> *</span>}
                  </Label>
                )}

                {param.type === 'text' && (
                  <Textarea
                    id={key}
                    value={parameters[key] ?? ''}
                    onChange={(e) => setParam(key, e.target.value)}
                    className="text-sm h-24 resize-y"
                  />
                )}

                {param.type === 'code' && (
                  <Textarea
                    id={key}
                    value={parameters[key] ?? ''}
                    onChange={(e) => setParam(key, e.target.value)}
                    spellCheck={false}
                    className="font-mono text-xs h-56 resize-y bg-muted/40"
                  />
                )}

                {param.type === 'string' && (
                  <Input id={key} value={parameters[key] ?? ''} onChange={(e) => setParam(key, e.target.value)} />
                )}

                {param.type === 'number' && (
                  <Input
                    id={key}
                    type="number"
                    value={parameters[key] ?? ''}
                    placeholder={param.default !== undefined ? String(param.default) : ''}
                    onChange={(e) => setParam(key, e.target.value === '' ? undefined : Number(e.target.value))}
                  />
                )}

                {param.type === 'time' && (
                  <Input id={key} type="time" value={parameters[key] ?? ''} onChange={(e) => setParam(key, e.target.value)} />
                )}

                {param.type === 'select' && (
                  <Select value={parameters[key] ?? ''} onValueChange={(value) => setParam(key, value)}>
                    <SelectTrigger id={key}>
                      <SelectValue placeholder="Choisir…" />
                    </SelectTrigger>
                    <SelectContent>
                      {param.options?.map((opt: string) => (
                        <SelectItem key={opt} value={opt}>{OPTION_LABELS[opt] ?? opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {PARAM_HINTS[key] && <p className="text-[11px] text-muted-foreground">{PARAM_HINTS[key]}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t">
        <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="size-4 mr-2" />
          Supprimer l'étape
        </Button>
      </div>
    </div>
  );
}
