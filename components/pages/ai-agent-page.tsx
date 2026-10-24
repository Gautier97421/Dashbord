'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Play, Sparkles, Loader2, Link2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowBuilder } from '@/components/ai-agent/workflow-builder';
import { WorkflowResponse } from '@/lib/types/workflow';
import { WORKFLOW_TEMPLATES } from '@/lib/ai-agent/templates';
import EmailAnalyzer from '@/components/ai-agent/email-analyzer';
import ActionHistory from '@/components/ai-agent/action-history';
import { AutonomousAgent } from '@/components/ai-agent/autonomous-agent';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AIAgentPage() {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowResponse[]>([]);
  const [loadingWf, setLoadingWf] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('agent');

  const loadGmailStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/gmail/status');
      if (r.ok) { const d = await r.json(); setGmailConnected(!!d.connected); }
    } catch { /* ignore */ }
  }, []);

  const loadWorkflows = useCallback(async () => {
    try {
      setLoadingWf(true);
      const r = await fetch('/api/workflows');
      if (!r.ok) throw new Error();
      setWorkflows(await r.json());
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger les workflows', variant: 'destructive' });
    } finally {
      setLoadingWf(false);
    }
  }, [toast]);

  useEffect(() => {
    loadGmailStatus();
    loadWorkflows();
  }, [loadGmailStatus, loadWorkflows]);

  const createFromTemplate = async (templateId: string) => {
    try {
      setCreatingTemplate(templateId);
      const res = await fetch('/api/workflows/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Automatisation créée', description: 'Lance-la avec « Tester ».' });
      await loadWorkflows();
      setActiveTab('automatisations');
    } catch {
      toast({ title: 'Erreur', description: 'Création impossible', variant: 'destructive' });
    } finally {
      setCreatingTemplate(null);
    }
  };

  const runWorkflow = async (id: string) => {
    if (!gmailConnected) {
      toast({ title: 'Gmail non connecté', description: 'Connecte Gmail dans Paramètres → Connexions.', variant: 'destructive' });
      return;
    }
    try {
      setRunningId(id);
      const res = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast({ title: '✅ Terminé', description: 'Automatisation exécutée.' });
    } catch (err) {
      toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Erreur', variant: 'destructive' });
    } finally {
      setRunningId(null);
    }
  };

  const deleteWorkflow = async (id: string) => {
    if (!window.confirm('Supprimer cette automatisation ?')) return;
    try {
      await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
      setWorkflows(wfs => wfs.filter(w => w.id !== id));
      toast({ title: 'Automatisation supprimée' });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const copyWebhookUrl = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows/${id}/webhook`);
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error();
      await navigator.clipboard.writeText(data.url);
      toast({ title: 'URL webhook copiée', description: 'Colle-la dans le service externe (POST).' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de récupérer l\'URL', variant: 'destructive' });
    }
  };

  const hasWebhookTrigger = (wf: WorkflowResponse) =>
    (wf.config?.nodes || []).some((n: any) => n.type === 'trigger' && n.data?.config?.type === 'webhook');

  if (showBuilder) {
    return (
      <div className="h-full">
        <div className="mb-4">
          <Button onClick={() => { setShowBuilder(false); setEditingId(null); loadWorkflows(); }} variant="outline">
            ← Retour
          </Button>
        </div>
        <WorkflowBuilder workflowId={editingId || undefined} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Agent IA</h1>
        <p className="text-sm text-gray-500">Ton assistant qui trie, surveille et automatise ta boîte mail</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-tour="ai-agent-tabs" className="w-full sm:w-auto grid grid-cols-2 sm:flex sm:flex-wrap h-auto">
          <TabsTrigger value="agent">Agent autonome</TabsTrigger>
          <TabsTrigger value="automatisations">Automatisations</TabsTrigger>
          <TabsTrigger value="assistant">Assistant</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        {/* ══════════════════ AGENT AUTONOME ══════════════════ */}
        <TabsContent value="agent" className="mt-4">
          <AutonomousAgent gmailConnected={gmailConnected} />
        </TabsContent>

        {/* ══════════════════ AUTOMATISATIONS ══════════════════ */}
        <TabsContent value="automatisations" className="mt-4 space-y-6">
          {!gmailConnected && (
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3">
              <span className="text-lg shrink-0">⚠️</span>
              <span>Connecte d'abord Gmail dans <strong>Paramètres → Connexions</strong>.</span>
            </div>
          )}

          {/* Templates */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h2 className="font-semibold">Modèles prêts à l'emploi</h2>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 @4xl/main:grid-cols-4">
              {WORKFLOW_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => createFromTemplate(tpl.id)}
                  disabled={creatingTemplate === tpl.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors text-left active:scale-[0.98]"
                >
                  <span className="text-2xl shrink-0">{tpl.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{tpl.name}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{tpl.description}</p>
                  </div>
                  {creatingTemplate === tpl.id
                    ? <Loader2 className="w-4 h-4 animate-spin text-purple-600 shrink-0" />
                    : <Plus className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* My workflows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Mes automatisations</h2>
              <Button onClick={() => { setEditingId(null); setShowBuilder(true); }} variant="outline" size="sm">
                <Plus className="w-3.5 h-3.5 mr-1" />Créer un workflow
              </Button>
            </div>

            {loadingWf ? (
              <div className="text-center py-8 text-gray-400 text-sm">Chargement...</div>
            ) : workflows.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                Aucune automatisation — choisis un modèle ci-dessus.
              </div>
            ) : (
              <div className="space-y-2">
                {workflows.map(wf => (
                  <div key={wf.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{wf.name}</p>
                      <p className="text-xs text-gray-500">
                        {(wf.config?.nodes || []).length} étape(s) · {new Date(wf.createdAt).toLocaleDateString('fr-FR')}
                        {wf.isActive && <span className="ml-2 text-green-600">● Actif</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {hasWebhookTrigger(wf) && (
                        <Button onClick={() => copyWebhookUrl(wf.id)} size="sm" variant="ghost" className="h-8 w-8 p-0" title="Copier l'URL webhook">
                          <Link2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button onClick={() => runWorkflow(wf.id)} size="sm" disabled={runningId === wf.id} className="h-8 px-3">
                        {runningId === wf.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Play className="w-3.5 h-3.5" />}
                      </Button>
                      <Button onClick={() => { setEditingId(wf.id); setShowBuilder(true); }} size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button onClick={() => deleteWorkflow(wf.id)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════ ASSISTANT ══════════════════ */}
        <TabsContent value="assistant" className="mt-4">
          <EmailAnalyzer />
        </TabsContent>

        {/* ══════════════════ HISTORIQUE ══════════════════ */}
        <TabsContent value="history" className="mt-4">
          <ActionHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
