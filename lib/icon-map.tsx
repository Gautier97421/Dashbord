'use client';

import React from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

/**
 * Render a lucide icon by its string name. Falls back to "Sparkles".
 */
export function DynamicIcon({ name, ...props }: { name: string } & LucideProps) {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<LucideProps>>;
  const Icon = icons[name] || icons['Sparkles'];
  return <Icon {...props} />;
}
