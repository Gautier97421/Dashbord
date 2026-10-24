'use client';

import React from 'react';
import {
  Bell,
  Briefcase,
  CalendarDays,
  Clock,
  Code2,
  Filter,
  GitBranch,
  Globe,
  Hash,
  MousePointerClick,
  Send,
  Shuffle,
  Sparkles,
  Timer,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Brand services show their logo (like n8n); core nodes a line icon on a tinted tile.
type IconDef = { logo: string } | { icon: LucideIcon; tile: string };

const TILE = {
  trigger: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  app: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  logic: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  web: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  code: 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900',
  slack: 'bg-[#4A154B] text-white',
  telegram: 'bg-[#229ED9] text-white',
};

const LOGO = {
  gmail: { logo: '/logos/gmail.png' },
  outlook: { logo: '/logos/outlook.svg' },
  discord: { logo: '/logos/discord.png' },
  notion: { logo: '/logos/notion.png' },
  github: { logo: '/logos/github.png' },
  trello: { logo: '/logos/Trello.png' },
};

const ICONS: Record<string, IconDef> = {
  'trigger:manual': { icon: MousePointerClick, tile: TILE.trigger },
  'trigger:scheduled': { icon: Clock, tile: TILE.trigger },
  'trigger:email_received': LOGO.gmail,
  'trigger:calendar_event': { icon: CalendarDays, tile: TILE.trigger },
  'trigger:webhook': { icon: Webhook, tile: TILE.trigger },

  'action:gmail_read': LOGO.gmail,
  'action:gmail_send': LOGO.gmail,
  'action:gmail_label': LOGO.gmail,
  'action:gmail_move': LOGO.gmail,
  'action:gmail_delete': LOGO.gmail,
  'action:gmail_classify': LOGO.gmail,
  'action:outlook_read': LOGO.outlook,
  'action:outlook_send': LOGO.outlook,
  'action:outlook_move': LOGO.outlook,
  'action:discord_send': LOGO.discord,
  'action:notion_create': LOGO.notion,
  'action:github_issue': LOGO.github,
  'action:trello_card': LOGO.trello,
  'action:slack_send': { icon: Hash, tile: TILE.slack },
  'action:telegram_send': { icon: Send, tile: TILE.telegram },
  'action:calendar_create': { icon: CalendarDays, tile: TILE.app },
  'action:track_application': { icon: Briefcase, tile: TILE.app },
  'action:notify': { icon: Bell, tile: TILE.app },
  'action:http_request': { icon: Globe, tile: TILE.web },

  'logic:code': { icon: Code2, tile: TILE.code },
  'logic:filter': { icon: Filter, tile: TILE.logic },
  'logic:if_then': { icon: GitBranch, tile: TILE.logic },
  'logic:delay': { icon: Timer, tile: TILE.logic },
  'logic:transform': { icon: Shuffle, tile: TILE.logic },
};

const FALLBACK: IconDef = { icon: Sparkles, tile: 'bg-muted text-muted-foreground' };

export function NodeIcon({ kind, nodeKey, size = 'md' }: { kind: string; nodeKey?: string; size?: 'sm' | 'md' }) {
  const def = ICONS[`${kind}:${nodeKey}`] ?? FALLBACK;
  const box = size === 'sm' ? 'size-9' : 'size-10';

  if ('logo' in def) {
    return (
      <span className={cn(box, 'rounded-lg border bg-white p-1.5 flex items-center justify-center shrink-0')}>
        <img src={def.logo} alt="" className="size-full object-contain" draggable={false} />
      </span>
    );
  }

  const Icon = def.icon;
  return (
    <span className={cn(box, 'rounded-lg flex items-center justify-center shrink-0', def.tile)}>
      <Icon className="size-5" strokeWidth={2} />
    </span>
  );
}
