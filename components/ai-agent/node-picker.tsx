'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WorkflowNodeType } from '@/lib/types/workflow';
import { groupItems, searchCatalog, KIND_LABELS, type CatalogItem, type PickerFilter } from '@/lib/workflow-catalog';
import { NodeIcon } from './node-icon';

interface NodePickerProps {
  // false when adding after a step's output: a trigger cannot have an input
  allowTriggers: boolean;
  initialFilter: PickerFilter;
  onSelect: (item: CatalogItem) => void;
  onClose: () => void;
}

export function NodePicker({ allowTriggers, initialFilter, onSelect, onClose }: NodePickerProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PickerFilter>(initialFilter);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const kindsAllowed: WorkflowNodeType[] = allowTriggers ? ['trigger', 'action', 'logic'] : ['action', 'logic'];
  const filters: PickerFilter[] = ['all', ...kindsAllowed];

  const results = useMemo(
    () => searchCatalog(query, filter === 'all' ? kindsAllowed : [filter]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, filter, allowTriggers]
  );
  const groups = useMemo(() => groupItems(results), [results]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{allowTriggers ? 'Ajouter un nœud' : 'Que se passe-t-il ensuite ?'}</p>
            <p className="text-xs text-muted-foreground">Cherche par nom, par service ou par type.</p>
          </div>
          <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onClose} aria-label="Fermer">
            <X className="size-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) onSelect(results[0]);
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Rechercher (gmail, code, déclencheur…)"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded-full border text-xs transition-colors',
                filter === f ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {f === 'all' ? 'Tous' : KIND_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun nœud ne correspond à « {query} ».</p>
        )}
        {groups.map(([group, items]) => (
          <div key={group} className="mb-2">
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
            {items.map((item) => (
              <button
                key={`${item.kind}:${item.key}`}
                type="button"
                onClick={() => onSelect(item)}
                className="w-full flex items-start gap-3 p-2 rounded-lg text-left hover:bg-muted transition-colors"
              >
                <NodeIcon kind={item.kind} nodeKey={item.key} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.description}</span>
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
