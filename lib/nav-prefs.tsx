'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useCustomPages } from '@/lib/custom-pages-context';
import { BUILTIN_NAV, BUILTIN_KEYS, type NavItemDef } from '@/lib/nav-items';
import { useFeatures } from '@/lib/features-context';

const ORDER_KEY = 'dashlife:navOrder';
const HIDDEN_KEY = 'dashlife:navHidden';
// Page d'accueil : toujours présente dans le menu
export const ALWAYS_VISIBLE = new Set(['dashboard']);

interface NavPrefsValue {
  /** Visible nav entries (built-in + custom pages), in the user's chosen order. */
  items: NavItemDef[];
  /** Every entry, hidden ones included (settings screen). */
  allItems: (NavItemDef & { hidden: boolean })[];
  /** Raw ordered list of keys. */
  order: string[];
  move: (key: string, dir: 'up' | 'down') => void;
  setOrder: (keys: string[]) => void;
  /** Show / hide a page in the sidebar. */
  toggleHidden: (key: string) => void;
  isHidden: (key: string) => boolean;
}

const NavPrefsContext = createContext<NavPrefsValue | null>(null);

export function NavPrefsProvider({ children }: { children: React.ReactNode }) {
  const { pages } = useCustomPages();
  const { canNav } = useFeatures();

  // All nav entries available right now (built-in pages the user has access to + current custom pages)
  const allItems = useMemo<NavItemDef[]>(() => {
    const customItems: NavItemDef[] = [...pages]
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ key: `custom:${p.id}`, label: p.name, icon: p.icon }));
    return [...BUILTIN_NAV.filter((n) => canNav(n.key)), ...customItems];
  }, [pages, canNav]);

  const availableKeys = useMemo(() => allItems.map((i) => i.key), [allItems]);

  const [order, setOrderState] = useState<string[]>(BUILTIN_KEYS);
  const [hidden, setHidden] = useState<string[]>([]);

  // Load stored order and hidden pages once on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
      if (Array.isArray(stored)) setOrderState(stored);
      const storedHidden = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
      if (Array.isArray(storedHidden)) setHidden(storedHidden.filter((k) => !ALWAYS_VISIBLE.has(k)));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleHidden = (key: string) => {
    if (ALWAYS_VISIBLE.has(key)) return;
    setHidden((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const isHidden = useCallback((key: string) => hidden.includes(key), [hidden]);

  // Merge: keep stored order, drop stale keys, place new built-in pages right after
  // their predecessor in BUILTIN_NAV, and append new custom pages at the end
  const mergedOrder = useMemo(() => {
    const merged = order.filter((k) => availableKeys.includes(k));
    for (const key of availableKeys) {
      if (merged.includes(key)) continue;
      const builtinIdx = BUILTIN_KEYS.indexOf(key);
      const prev = builtinIdx > 0
        ? BUILTIN_KEYS.slice(0, builtinIdx).reverse().find((k) => merged.includes(k))
        : undefined;
      if (prev) merged.splice(merged.indexOf(prev) + 1, 0, key);
      else merged.push(key);
    }
    return merged;
  }, [order, availableKeys]);

  const persist = (next: string[]) => {
    setOrderState(next);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const setOrder = (keys: string[]) => persist(keys);

  const move = (key: string, dir: 'up' | 'down') => {
    const list = [...mergedOrder];
    const idx = list.indexOf(key);
    if (idx === -1) return;
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= list.length) return;
    [list[idx], list[swap]] = [list[swap], list[idx]];
    persist(list);
  };

  const orderedAll = useMemo(() => {
    const byKey = new Map(allItems.map((i) => [i.key, i]));
    return mergedOrder
      .map((k) => byKey.get(k))
      .filter((i): i is NavItemDef => !!i)
      .map((i) => ({ ...i, hidden: hidden.includes(i.key) }));
  }, [mergedOrder, allItems, hidden]);

  const items = useMemo<NavItemDef[]>(() => orderedAll.filter((i) => !i.hidden), [orderedAll]);

  return (
    <NavPrefsContext.Provider value={{ items, allItems: orderedAll, order: mergedOrder, move, setOrder, toggleHidden, isHidden }}>
      {children}
    </NavPrefsContext.Provider>
  );
}

export function useNavPrefs() {
  const ctx = useContext(NavPrefsContext);
  if (!ctx) throw new Error('useNavPrefs must be used within NavPrefsProvider');
  return ctx;
}
