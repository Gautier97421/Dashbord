'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, ArrowRight, LayoutGrid } from 'lucide-react';
import { useCustomPages, templateBlocks } from '@/lib/custom-pages-context';
import { DynamicIcon } from '@/lib/icon-map';
import { PAGE_ICONS } from '@/lib/types/custom-page';
import type { CustomPage, BlockType } from '@/lib/types/custom-page';
import type { PageKey } from '@/components/app-sidebar';
import { cn } from '@/lib/utils';

const COLORS = ['#6366f1', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#64748b'];

// Page types offered at creation
type Template = BlockType | 'films';
const TEMPLATES: { id: Template; label: string; description: string; icon: string }[] = [
  { id: 'collection', label: 'Collection', description: 'Crée tes propres fiches (ex : candidatures de stage) avec tes champs et une recherche', icon: 'Table2' },
  { id: 'calendar', label: 'Calendrier', description: 'Un calendrier mensuel avec tes événements', icon: 'Calendar' },
  { id: 'routine', label: 'Routine', description: 'Une routine quotidienne à cocher chaque jour', icon: 'Sun' },
  { id: 'films', label: 'Films à voir', description: 'Une watchlist de films/séries (titre, plateforme, statut, note)', icon: 'Film' },
];

export function CustomPagesManager({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  const { pages, createPage, updatePage, deletePage } = useCustomPages();
  const sorted = [...pages].sort((a, b) => a.order - b.order);

  const [editing, setEditing] = useState<CustomPage | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftIcon, setDraftIcon] = useState('Sparkles');
  const [draftColor, setDraftColor] = useState('#6366f1');
  const [draftTemplate, setDraftTemplate] = useState<Template>('collection');
  const [deleteTarget, setDeleteTarget] = useState<CustomPage | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDraftName('');
    setDraftIcon('Sparkles');
    setDraftColor('#6366f1');
    setDraftTemplate('collection');
    setDialogOpen(true);
  };

  const openEdit = (page: CustomPage) => {
    setEditing(page);
    setDraftName(page.name);
    setDraftIcon(page.icon);
    setDraftColor(page.color || '#6366f1');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = draftName.trim() || 'Nouvelle page';
    if (editing) {
      await updatePage(editing.id, { name, icon: draftIcon, color: draftColor });
      setDialogOpen(false);
    } else {
      const created = await createPage({
        name, icon: draftIcon, color: draftColor,
        blocks: templateBlocks(draftTemplate),
      });
      setDialogOpen(false);
      if (created && onNavigate) onNavigate(`custom:${created.id}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="size-5" /> Pages personnalisées
            </CardTitle>
            <CardDescription>Crée tes propres pages (routines, anniversaires, listes…) et organise-les comme tu veux.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            Aucune page personnalisée pour l'instant.
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((page) => (
              <div key={page.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                {/* Icon + name */}
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-white shrink-0"
                  style={{ backgroundColor: page.color || '#6366f1' }}
                >
                  <DynamicIcon name={page.icon} className="size-4" />
                </div>
                <span className="flex-1 font-medium truncate">{page.name}</span>

                {/* Actions */}
                {onNavigate && (
                  <Button variant="ghost" size="icon" className="size-8" title="Ouvrir" onClick={() => onNavigate(`custom:${page.id}`)}>
                    <ArrowRight className="size-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="size-8" title="Modifier" onClick={() => openEdit(page)}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8 text-destructive" title="Supprimer" onClick={() => setDeleteTarget(page)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="size-4 mr-2" /> Créer une page
        </Button>
      </CardContent>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la page' : 'Nouvelle page'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template picker (creation only) */}
            {!editing && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Que contient cette page ?</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => { setDraftTemplate(tpl.id); setDraftIcon(tpl.icon); }}
                      className={cn(
                        'flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors',
                        draftTemplate === tpl.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'
                      )}
                    >
                      <DynamicIcon name={tpl.icon} className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{tpl.label}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight">{tpl.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nom</label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Ex : Anniversaires, Routine sport…"
              />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Couleur</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraftColor(c)}
                    className={cn(
                      'size-8 rounded-lg transition-transform hover:scale-110',
                      draftColor === c && 'ring-2 ring-offset-2 ring-primary'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Icon */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Icône</label>
              <div className="grid grid-cols-8 gap-1.5 max-h-44 overflow-y-auto p-1 border rounded-lg">
                {PAGE_ICONS.map((name) => (
                  <button
                    key={name}
                    onClick={() => setDraftIcon(name)}
                    className={cn(
                      'flex items-center justify-center aspect-square rounded-md hover:bg-muted transition-colors',
                      draftIcon === name && 'bg-primary text-primary-foreground hover:bg-primary'
                    )}
                    title={name}
                  >
                    <DynamicIcon name={name} className="size-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg text-white" style={{ backgroundColor: draftColor }}>
                <DynamicIcon name={draftIcon} className="size-4" />
              </div>
              <span className="font-medium">{draftName.trim() || 'Nouvelle page'}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave}>{editing ? 'Enregistrer' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleteTarget?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette page et tout son contenu seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) deletePage(deleteTarget.id); setDeleteTarget(null); }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
