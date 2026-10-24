'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { featureForNavKey, type FeatureKey } from '@/lib/feature-defs';

interface FeaturesState {
  loaded: boolean;
  isAdmin: boolean;
  /** État global des fonctionnalités (renseigné pour l'admin uniquement). */
  flags: Partial<Record<FeatureKey, boolean>>;
  /** Accès de l'utilisateur courant. */
  access: Partial<Record<FeatureKey, boolean>>;
}

interface FeaturesValue extends Omit<FeaturesState, 'access'> {
  can: (key: FeatureKey) => boolean;
  /** Une page du menu est visible si elle ne dépend d'aucune fonctionnalité, ou d'une fonctionnalité accessible. */
  canNav: (navKey: string) => boolean;
  setFeature: (key: FeatureKey, enabled: boolean) => Promise<boolean>;
}

const FeaturesContext = createContext<FeaturesValue | null>(null);

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FeaturesState>({ loaded: false, isAdmin: false, flags: {}, access: {} });

  useEffect(() => {
    fetch('/api/features')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setState({
          loaded: true,
          isAdmin: !!data?.isAdmin,
          flags: data?.flags ?? {},
          access: data?.access ?? {},
        });
      })
      .catch(() => setState((s) => ({ ...s, loaded: true })));
  }, []);

  const can = useCallback((key: FeatureKey) => !!state.access[key], [state.access]);

  const canNav = useCallback(
    (navKey: string) => {
      const feature = featureForNavKey(navKey);
      return !feature || !!state.access[feature];
    },
    [state.access]
  );

  const setFeature = async (key: FeatureKey, enabled: boolean) => {
    const res = await fetch('/api/features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, enabled }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setState((s) => ({ ...s, flags: data.flags }));
    return true;
  };

  return (
    <FeaturesContext.Provider
      value={{ loaded: state.loaded, isAdmin: state.isAdmin, flags: state.flags, can, canNav, setFeature }}
    >
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures() {
  const ctx = useContext(FeaturesContext);
  if (!ctx) throw new Error('useFeatures must be used within FeaturesProvider');
  return ctx;
}
