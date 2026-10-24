'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Cloud, Plus, X } from 'lucide-react';
import { useCustomPages, genId } from '@/lib/custom-pages-context';
import { DynamicIcon } from '@/lib/icon-map';
import { type PageBlock, type BlockItem } from '@/lib/types/custom-page';
import { cn } from '@/lib/utils';
import { CollectionBlock } from './custom-blocks/collection-block';
import { CalendarBlock } from './custom-blocks/calendar-block';
import { RoutineBlock } from './custom-blocks/routine-block';

export function CustomPageView({ pageId }: { pageId: string }) {
  const { pages, updatePage } = useCustomPages();
  const page = pages.find((p) => p.id === pageId);

  // A custom page holds exactly one block (its type, chosen at creation)
  const [block, setBlock] = useState<PageBlock | null>(page?.blocks?.[0] || null);
  const [name, setName] = useState(page?.name || '');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPageId = useRef(pageId);

  // Re-sync when navigating to another page
  useEffect(() => {
    if (lastPageId.current !== pageId) {
      lastPageId.current = pageId;
      setBlock(page?.blocks?.[0] || null);
      setName(page?.name || '');
    }
  }, [pageId, page]);

  const scheduleSave = (nextBlock: PageBlock | null, nextName?: string) => {
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await updatePage(pageId, {
        blocks: nextBlock ? [nextBlock] : [],
        ...(nextName !== undefined ? { name: nextName } : {}),
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
    }, 600);
  };

  const onChange = (patch: Partial<PageBlock>) => {
    if (!block) return;
    const next = { ...block, ...patch };
    setBlock(next);
    scheduleSave(next);
  };

  if (!page) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Page introuvable.</div>;
  }

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 text-white shadow"
          style={{ backgroundColor: page.color || '#6366f1' }}
        >
          <DynamicIcon name={page.icon} className="w-5 h-5" />
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => scheduleSave(block, name)}
          placeholder="Titre de la page"
          className="flex-1 bg-transparent text-2xl sm:text-3xl font-bold outline-none border-b-2 border-transparent focus:border-primary/30 transition-colors min-w-0"
        />
        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          {saveState === 'saving' && <><Cloud className="w-3.5 h-3.5 animate-pulse" /> <span className="hidden sm:inline">Sauvegarde…</span></>}
          {saveState === 'saved' && <><Check className="w-3.5 h-3.5 text-green-500" /> <span className="hidden sm:inline">Enregistré</span></>}
        </span>
      </div>

      {/* Body — the single page type */}
      {!block ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Cette page n'a pas de contenu.</div>
      ) : block.type === 'collection' ? (
        <CollectionBlock block={block} onChange={onChange} />
      ) : block.type === 'calendar' ? (
        <CalendarBlock block={block} onChange={onChange} />
      ) : block.type === 'routine' ? (
        <RoutineBlock block={block} onChange={onChange} />
      ) : block.type === 'notes' ? (
        <textarea
          value={block.text || ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Écris ici…"
          rows={12}
          className="w-full resize-y bg-muted/30 rounded-xl p-4 text-sm outline-none focus:ring-1 focus:ring-primary/30"
        />
      ) : (
        <SimpleListBlock block={block} onChange={onChange} />
      )}
    </div>
  );
}

// ─── Simple list (checklist / tasks / dates / list) — fallback for legacy pages ─

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
};
const PRIORITY_LABEL: Record<string, string> = { high: 'Haute', medium: 'Moyenne', low: 'Basse' };

function SimpleListBlock({ block, onChange }: { block: PageBlock; onChange: (patch: Partial<PageBlock>) => void }) {
  const [newItemText, setNewItemText] = useState('');
  const simpleItems = block.items || [];

  const items = block.type === 'dates'
    ? [...simpleItems].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
    : simpleItems;

  const addItem = (partial: Partial<BlockItem>) => {
    onChange({ items: [...simpleItems, { id: genId(), text: '', ...partial }] });
  };
  const updateItem = (id: string, patch: Partial<BlockItem>) => {
    onChange({ items: simpleItems.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  };
  const deleteItem = (id: string) => {
    onChange({ items: simpleItems.filter((it) => it.id !== id) });
  };

  const handleAdd = () => {
    const text = newItemText.trim();
    if (!text) return;
    if (block.type === 'tasks') addItem({ text, done: false, priority: 'medium' });
    else if (block.type === 'dates') addItem({ text, date: '' });
    else if (block.type === 'checklist') addItem({ text, done: false });
    else addItem({ text });
    setNewItemText('');
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {items.length === 0 && <p className="text-sm text-muted-foreground italic px-1">Aucun élément pour l'instant.</p>}
        {items.map((item) => (
          <ItemRow key={item.id} block={block} item={item} onUpdate={(p) => updateItem(item.id, p)} onDelete={() => deleteItem(item.id)} />
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Input
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder={block.type === 'dates' ? 'Nom (ex : Anniversaire de Léa)' : block.type === 'tasks' ? 'Nouvelle tâche…' : 'Nouvel élément…'}
          className="h-9"
        />
        <Button size="sm" onClick={handleAdd} className="h-9 shrink-0"><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

function ItemRow({ block, item, onUpdate, onDelete }: {
  block: PageBlock; item: BlockItem; onUpdate: (patch: Partial<BlockItem>) => void; onDelete: () => void;
}) {
  const checkable = block.type === 'checklist' || block.type === 'tasks';
  return (
    <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors">
      {checkable && (
        <button
          onClick={() => onUpdate({ done: !item.done })}
          className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
            item.done ? 'bg-green-500 border-green-500' : 'border-muted-foreground/40 hover:border-primary')}
        >
          {item.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </button>
      )}
      {block.type === 'list' && <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />}
      <input
        value={item.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        className={cn('flex-1 bg-transparent text-sm outline-none min-w-0', item.done && 'line-through text-muted-foreground')}
      />
      {block.type === 'dates' && (
        <input type="date" value={item.date || ''} onChange={(e) => onUpdate({ date: e.target.value })}
          className="text-xs bg-muted/50 rounded px-2 py-1 outline-none shrink-0" />
      )}
      {block.type === 'tasks' && (
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0', PRIORITY_COLORS[item.priority || 'medium'])}>
          {PRIORITY_LABEL[item.priority || 'medium']}
        </span>
      )}
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
