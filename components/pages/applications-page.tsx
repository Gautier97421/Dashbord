'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLiveRefresh } from '@/lib/live-sync';
import { Plus, Trash2, Mail, Briefcase, Loader2 } from 'lucide-react';

interface JobApplication {
  id: string;
  company: string;
  position: string | null;
  status: string;
  appliedAt: string;
  lastUpdate: string;
  source: string | null;
  notes: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  applied: 'Envoyée',
  acknowledged: 'Accusé réception',
  interview: 'Entretien',
  offer: 'Offre',
  rejected: 'Refusée',
  ghosted: 'Sans réponse',
};

const STATUS_COLORS: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  acknowledged: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  interview: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  offer: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  ghosted: 'bg-muted text-muted-foreground',
};

export function ApplicationsPage() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ company: '', position: '', notes: '' });

  useEffect(() => {
    loadApplications();
  }, []);

  // silent : rafraîchissement automatique, sans écran de chargement ni message d'erreur
  const loadApplications = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/applications');
      if (!res.ok) throw new Error();
      setApplications(await res.json());
    } catch {
      if (!silent) toast({ title: 'Erreur', description: 'Impossible de charger les candidatures', variant: 'destructive' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useLiveRefresh(() => loadApplications(true));

  const scanEmails = async () => {
    try {
      setScanning(true);
      const res = await fetch('/api/applications/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast({
        title: 'Scan terminé',
        description: `${data.created} nouvelle(s) candidature(s) détectée(s) sur ${data.scanned} mails analysés.`,
      });
      loadApplications();
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Le scan a échoué',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  const addApplication = async () => {
    if (!form.company.trim()) return;
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setShowAdd(false);
      setForm({ company: '', position: '', notes: '' });
      loadApplications();
      toast({ title: 'Ajoutée', description: 'Candidature ajoutée' });
    } catch {
      toast({ title: 'Erreur', description: "Impossible d'ajouter", variant: 'destructive' });
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setApplications((apps) => apps.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch {
      toast({ title: 'Erreur', description: 'Mise à jour échouée', variant: 'destructive' });
      loadApplications();
    }
  };

  const deleteApplication = async (id: string) => {
    if (!window.confirm('Supprimer cette candidature ?')) return;
    setApplications((apps) => apps.filter((a) => a.id !== id));
    try {
      await fetch(`/api/applications/${id}`, { method: 'DELETE' });
    } catch {
      loadApplications();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Suivi de demande</h1>
          <p className="text-muted-foreground">Suivi automatique de vos candidatures de stage / emploi</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={scanEmails} disabled={scanning} variant="outline">
            {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Scanner mes mails
          </Button>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button data-tour="applications-add">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvelle candidature</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Entreprise *</Label>
                  <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="ex: Capgemini" />
                </div>
                <div className="space-y-2">
                  <Label>Poste</Label>
                  <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="ex: Stage développeur" />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button onClick={addApplication} className="w-full">Ajouter</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <Card><CardContent className="pt-6 text-center text-gray-500">Chargement...</CardContent></Card>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Briefcase className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 mb-4">Aucune candidature suivie</p>
            <p className="text-sm text-gray-400">Cliquez sur « Scanner mes mails » pour détecter automatiquement vos confirmations de candidature.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{app.company}</CardTitle>
                    {app.position && <p className="text-sm text-muted-foreground">{app.position}</p>}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[app.status] || ''}`}>
                    {STATUS_LABELS[app.status] || app.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>Envoyée le {new Date(app.appliedAt).toLocaleDateString('fr-FR')}</p>
                    {app.source === 'email' && <p className="text-cyan-600">📧 détectée automatiquement</p>}
                    {app.notes && <p className="text-muted-foreground max-w-md">{app.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={app.status} onValueChange={(v) => updateStatus(app.id, v)}>
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => deleteApplication(app.id)} size="sm" variant="ghost" className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default ApplicationsPage;
