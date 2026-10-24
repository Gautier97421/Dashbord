'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLiveRefresh } from '@/lib/live-sync';
import { ShieldCheck, Check, X, Loader2, Mail, Trash2, MessageSquare, FileText, Globe } from 'lucide-react';

interface PendingAction {
  id: string;
  kind: string;
  summary: string;
  status: string;
  createdAt: string;
  executedAt: string | null;
  error: string | null;
}

const KIND_ICON: Record<string, React.ElementType> = {
  gmail_send: Mail,
  gmail_delete: Trash2,
  discord_send: MessageSquare,
  notion_create: FileText,
  http_request: Globe,
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  executed: { label: 'Approuvé ✓', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  rejected: { label: 'Rejeté', cls: 'bg-muted text-muted-foreground' },
  failed: { label: 'Échec', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
};

export function ValidationPage() {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [recent, setRecent] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pending-actions');
      if (res.ok) {
        const data = await res.json();
        setPending(data.pending || []);
        setRecent(data.recent || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Actions proposées par l'agent depuis un autre appareil ou en arrière-plan
  useLiveRefresh(load);

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setBusy(id);
    try {
      const res = await fetch(`/api/pending-actions/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast({ title: decision === 'approve' ? '✅ Action exécutée' : 'Action rejetée' });
      load();
    } catch (err) {
      toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Échec', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="size-6 text-green-500" /> À valider</h1>
        <p className="text-sm text-muted-foreground">Les actions sensibles préparées par l'IA attendent ton accord ici. Rien n'est envoyé ou supprimé sans ton clic.</p>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Chargement…</div>
      ) : pending.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShieldCheck className="size-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aucune action en attente. Tout est à jour 👍</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pending.map((a) => {
            const Icon = KIND_ICON[a.kind] || Globe;
            return (
              <Card key={a.id}>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center shrink-0">
                    <Icon className="size-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.summary}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" onClick={() => decide(a.id, 'approve')} disabled={busy === a.id} className="h-8">
                      {busy === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5 mr-1" />}
                      Approuver
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decide(a.id, 'reject')} disabled={busy === a.id} className="h-8">
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {recent.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Historique récent</h2>
          {recent.map((a) => {
            const meta = STATUS_META[a.status] || { label: a.status, cls: '' };
            return (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border text-sm">
                <span className="flex-1 truncate text-muted-foreground">{a.summary}</span>
                <Badge variant="secondary" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
