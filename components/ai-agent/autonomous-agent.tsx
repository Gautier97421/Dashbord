'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Bot, Play, Loader2, CreditCard, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';

interface AgentConfig {
  enabled: boolean;
  safeMode: boolean;
  lastRunAt: string | null;
}

interface Subscription {
  id: string;
  service: string;
  status: 'active' | 'trial' | 'cancelled' | 'unknown';
  amount: string | null;
  lastAction: string | null;
  updatedAt: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: 'Actif', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  trial: { label: 'Essai', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  cancelled: { label: 'Résilié', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  unknown: { label: 'Inconnu', cls: 'bg-muted text-muted-foreground' },
};

export function AutonomousAgent({ gmailConnected }: { gmailConnected: boolean }) {
  const { toast } = useToast();
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [cfgRes, subRes] = await Promise.allSettled([
      fetch('/api/agent/config').then((r) => r.ok ? r.json() : null),
      fetch('/api/subscriptions').then((r) => r.ok ? r.json() : []),
    ]);
    if (cfgRes.status === 'fulfilled' && cfgRes.value) setConfig(cfgRes.value);
    if (subRes.status === 'fulfilled' && Array.isArray(subRes.value)) setSubs(subRes.value);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (patch: Partial<AgentConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...patch });
    setSaving(true);
    try {
      await fetch('/api/agent/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    if (!gmailConnected) {
      toast({ title: 'Gmail non connecté', description: 'Connecte Gmail pour lancer l\'agent.', variant: 'destructive' });
      return;
    }
    setRunning(true);
    try {
      const res = await fetch('/api/agent/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Erreur');
      toast({
        title: '✅ Agent terminé',
        description: `${data.scanned} mails analysés · ${data.sorted} triés · ${data.notified} notifications · ${data.applications} candidature(s)`,
      });
      load();
    } catch (err) {
      toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Échec', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const deleteSub = async (id: string) => {
    setSubs((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  if (!config) {
    return <div className="py-10 text-center text-muted-foreground text-sm">Chargement…</div>;
  }

  return (
    <div className="space-y-5">
      {/* Master switch */}
      <Card className={config.enabled ? 'border-indigo-300 dark:border-indigo-800' : ''}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${config.enabled ? 'bg-indigo-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                <Bot className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  Agent autonome
                  {config.enabled && <Badge className="bg-indigo-500 text-[10px]">Actif</Badge>}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  L'agent surveille ta boîte mail tout seul : il trie tes abonnements, détecte les résiliations et te prévient des nouveautés.
                </p>
                {config.lastRunAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Dernière exécution : {new Date(config.lastRunAt).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
            </div>
            <Switch checked={config.enabled} onCheckedChange={(v) => update({ enabled: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Safe mode — irreversible-action guard */}
      <Card className={config.safeMode ? 'border-green-300 dark:border-green-800 bg-green-50/40 dark:bg-green-950/20' : 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20'}>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.safeMode ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'}`}>
                {config.safeMode ? <ShieldCheck className="size-5" /> : <ShieldAlert className="size-5" />}
              </div>
              <div>
                <p className="font-semibold">Mode sécurisé {config.safeMode ? '(activé)' : '(désactivé)'}</p>
                <p className="text-sm text-muted-foreground max-w-lg">
                  {config.safeMode
                    ? "L'IA ne fait jamais d'action irréversible toute seule. Au lieu d'envoyer ou supprimer, elle prépare un brouillon, met un label « À supprimer » et te prévient."
                    : "⚠️ Désactivé : les automatisations peuvent envoyer des mails, supprimer et écrire vers des services externes sans te demander."}
                </p>
              </div>
            </div>
            <Switch checked={config.safeMode} onCheckedChange={(v) => update({ safeMode: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Run now */}
      <div className="flex items-center gap-3">
        <Button onClick={runNow} disabled={running}>
          {running ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Play className="size-4 mr-2" />}
          Lancer l'agent maintenant
        </Button>
        {saving && <span className="text-xs text-muted-foreground">Enregistré</span>}
      </div>

      {/* Subscriptions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><CreditCard className="size-4" /> Tes abonnements détectés</CardTitle>
          <CardDescription>Repérés automatiquement dans tes emails.</CardDescription>
        </CardHeader>
        <CardContent>
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucun abonnement détecté pour l'instant. Lance l'agent pour scanner ta boîte mail.
            </p>
          ) : (
            <div className="space-y-2">
              {subs.map((s) => {
                const meta = STATUS_META[s.status] || STATUS_META.unknown;
                return (
                  <div key={s.id} className="group flex items-center gap-3 p-2.5 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{s.service}</span>
                        <Badge variant="secondary" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {s.amount ? `${s.amount} · ` : ''}{s.lastAction || '—'}
                      </p>
                    </div>
                    <button onClick={() => deleteSub(s.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
