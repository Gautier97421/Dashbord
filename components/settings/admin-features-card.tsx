'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FEATURES, FEATURE_KEYS, type FeatureKey } from '@/lib/feature-defs';
import { useFeatures } from '@/lib/features-context';

export function AdminFeaturesCard() {
  const { isAdmin, flags, setFeature } = useFeatures();
  const { toast } = useToast();
  const [saving, setSaving] = useState<FeatureKey | null>(null);

  if (!isAdmin) return null;

  const toggle = async (key: FeatureKey, enabled: boolean) => {
    setSaving(key);
    const ok = await setFeature(key, enabled);
    setSaving(null);
    if (!ok) {
      toast({ title: 'Erreur', description: 'Impossible de modifier la fonctionnalité.', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5" /> Administration
        </CardTitle>
        <CardDescription>
          Active ou désactive des fonctionnalités pour tous les utilisateurs. Une fonctionnalité désactivée reste
          accessible pour toi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {FEATURE_KEYS.map((key) => {
          const enabled = !!flags[key];
          return (
            <div key={key} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{FEATURES[key].label}</p>
                <p className="text-xs text-muted-foreground">{FEATURES[key].description}</p>
                <p className="text-xs mt-1 text-muted-foreground">
                  {enabled ? 'Ouverte à tous les utilisateurs' : "Réservée à l'administrateur"}
                </p>
              </div>
              <Switch
                checked={enabled}
                disabled={saving === key}
                onCheckedChange={(value) => toggle(key, value)}
                aria-label={`Activer ${FEATURES[key].label}`}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
