'use client';

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import type { CustomPage, PageBlock } from '@/lib/types/custom-page';

interface CustomPagesContextValue {
  pages: CustomPage[];
  loading: boolean;
  refresh: () => Promise<void>;
  createPage: (input?: { name?: string; icon?: string; color?: string; blocks?: PageBlock[] }) => Promise<CustomPage | null>;
  updatePage: (id: string, patch: Partial<Pick<CustomPage, 'name' | 'icon' | 'color' | 'order' | 'blocks'>>) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  reorder: (id: string, direction: 'up' | 'down') => Promise<void>;
}

const CustomPagesContext = createContext<CustomPagesContextValue | null>(null);

export function CustomPagesProvider({ children }: { children: React.ReactNode }) {
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/custom-pages');
      if (res.ok) {
        const data = await res.json();
        setPages(Array.isArray(data) ? data : []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createPage = useCallback(
    async (input?: { name?: string; icon?: string; color?: string; blocks?: PageBlock[] }) => {
      try {
        const res = await fetch('/api/custom-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input || {}),
        });
        if (!res.ok) return null;
        const page: CustomPage = await res.json();
        setPages((prev) => [...prev, { ...page, blocks: page.blocks || [] }]);
        return page;
      } catch {
        return null;
      }
    },
    []
  );

  const updatePage = useCallback(
    async (id: string, patch: Partial<Pick<CustomPage, 'name' | 'icon' | 'color' | 'order' | 'blocks'>>) => {
      // Optimistic update
      setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } as CustomPage : p)));
      try {
        await fetch(`/api/custom-pages/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
      } catch {
        /* ignore — optimistic */
      }
    },
    []
  );

  const deletePage = useCallback(async (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    try {
      await fetch(`/api/custom-pages/${id}`, { method: 'DELETE' });
    } catch {
      /* ignore */
    }
  }, []);

  const reorder = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      setPages((prev) => {
        const sorted = [...prev].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((p) => p.id === id);
        if (idx === -1) return prev;
        const swapWith = direction === 'up' ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= sorted.length) return prev;
        const a = sorted[idx];
        const b = sorted[swapWith];
        const aOrder = a.order;
        const bOrder = b.order;
        // persist both
        fetch(`/api/custom-pages/${a.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: bOrder }),
        }).catch(() => {});
        fetch(`/api/custom-pages/${b.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: aOrder }),
        }).catch(() => {});
        return prev.map((p) =>
          p.id === a.id ? { ...p, order: bOrder } : p.id === b.id ? { ...p, order: aOrder } : p
        );
      });
    },
    []
  );

  return (
    <CustomPagesContext.Provider value={{ pages, loading, refresh, createPage, updatePage, deletePage, reorder }}>
      {children}
    </CustomPagesContext.Provider>
  );
}

export function useCustomPages() {
  const ctx = useContext(CustomPagesContext);
  if (!ctx) throw new Error('useCustomPages must be used within CustomPagesProvider');
  return ctx;
}

/** Helper to generate a short unique id on the client. */
export function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function emptyBlock(type: PageBlock['type']): PageBlock {
  const base = { id: genId(), type };
  switch (type) {
    case 'collection':
      return {
        ...base,
        title: 'Ma collection',
        fields: [
          { id: genId(), name: 'Nom', type: 'text' },
          { id: genId(), name: 'Date', type: 'date' },
        ],
        records: [],
      };
    case 'calendar':
      return { ...base, title: 'Mon calendrier', events: [] };
    case 'routine':
      return { ...base, title: 'Ma routine', routineItems: [], log: {} };
    case 'checklist':
      return { ...base, title: 'Ma checklist', items: [] };
    case 'tasks':
      return { ...base, title: 'Mes tâches', items: [] };
    case 'dates':
      return { ...base, title: 'Mes dates', items: [] };
    case 'list':
      return { ...base, title: 'Ma liste', items: [] };
    case 'notes':
      return { ...base, title: 'Mes notes', items: [], text: '' };
    default:
      return { ...base, title: 'Bloc', items: [] };
  }
}

/** Build a brand-new page seeded with one block of the chosen template. */
export function templateBlocks(template: PageBlock['type'] | 'blank' | 'films'): PageBlock[] {
  if (template === 'blank') return [];
  if (template === 'films') {
    return [{
      id: genId(),
      type: 'collection',
      title: 'Films & séries à voir',
      fields: [
        { id: genId(), name: 'Titre', type: 'text' },
        { id: genId(), name: 'Plateforme', type: 'select', options: ['Netflix', 'Prime Video', 'Disney+', 'Cinéma', 'Autre'] },
        { id: genId(), name: 'Statut', type: 'select', options: ['À voir', 'En cours', 'Vu'] },
        { id: genId(), name: 'Note', type: 'text' },
      ],
      records: [],
    }];
  }
  return [emptyBlock(template)];
}
