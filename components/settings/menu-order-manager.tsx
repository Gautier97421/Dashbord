'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronUp, ChevronDown, ListOrdered } from 'lucide-react';
import { useNavPrefs, ALWAYS_VISIBLE } from '@/lib/nav-prefs';
import { DynamicIcon } from '@/lib/icon-map';
import { cn } from '@/lib/utils';

export function MenuOrderManager() {
  const { allItems, move, toggleHidden } = useNavPrefs();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListOrdered className="size-5" /> Organisation du menu
        </CardTitle>
        <CardDescription>
          Choisis les pages affichées dans la barre latérale et leur ordre. Une page masquée garde ses données.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {allItems.map((item, idx) => {
            const locked = ALWAYS_VISIBLE.has(item.key);
            return (
              <div key={item.key} className={cn('flex items-center gap-2 p-2 rounded-lg border bg-card', item.hidden && 'opacity-50')}>
                <Checkbox
                  id={`nav-visible-${item.key}`}
                  checked={!item.hidden}
                  disabled={locked}
                  onCheckedChange={() => toggleHidden(item.key)}
                  aria-label={`Afficher ${item.label} dans le menu`}
                  title={locked ? "La page d'accueil reste toujours affichée" : undefined}
                />
                <DynamicIcon name={item.icon} className="size-4 text-muted-foreground shrink-0" />
                <label htmlFor={`nav-visible-${item.key}`} className="flex-1 text-sm font-medium truncate cursor-pointer">
                  {item.label}
                </label>
                {item.key.startsWith('custom:') && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Perso</span>
                )}
                <div className="flex items-center">
                  <Button
                    variant="ghost" size="icon" className="size-7"
                    disabled={idx === 0}
                    onClick={() => move(item.key, 'up')}
                    aria-label={`Monter ${item.label}`}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="size-7"
                    disabled={idx === allItems.length - 1}
                    onClick={() => move(item.key, 'down')}
                    aria-label={`Descendre ${item.label}`}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Le tableau de bord et le bouton « Paramètres » restent toujours affichés.
        </p>
      </CardContent>
    </Card>
  );
}
