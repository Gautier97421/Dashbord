'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Check, Trash2, X, CreditCard, Ban, TrendingUp, Clock, Briefcase, AlertTriangle, Sparkles, FolderKanban, ListTodo, Gift, Plane, Users } from 'lucide-react';
import { requestProjectsTarget } from '@/lib/projects/nav';
import { BellAnimation } from '@/components/bell-animation';
import { OPEN_SOCIAL_EVENT } from '@/components/social-button';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PageKey } from '@/components/app-sidebar';
import { cn } from '@/lib/utils';
import { useLiveRefresh } from '@/lib/live-sync';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
  meta?: { taskId?: string | null; projectId?: string | null } | null;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  subscription: CreditCard,
  cancellation: Ban,
  price_increase: TrendingUp,
  trial_ending: Clock,
  application: Briefcase,
  important: AlertTriangle,
  agent: Sparkles,
  project: FolderKanban,
  task: ListTodo,
  wishlist: Gift,
  trip: Plane,
  social: Users,
  info: Bell,
};

const TYPE_COLOR: Record<string, string> = {
  subscription: 'text-blue-500',
  cancellation: 'text-red-500',
  price_increase: 'text-orange-500',
  trial_ending: 'text-amber-500',
  application: 'text-purple-500',
  important: 'text-yellow-500',
  agent: 'text-indigo-500',
  project: 'text-primary',
  task: 'text-orange-500',
  wishlist: 'text-emerald-500',
  trip: 'text-sky-500',
  social: 'text-violet-500',
  info: 'text-muted-foreground',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export function NotificationsBell({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      // Le fuseau sert aux alertes projets (quel jour est-on chez l'utilisateur ?)
      const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
      const res = await fetch(`/api/notifications?tz=${tz}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Nouvelles notifications : au retour sur l'app et toutes les 30 s tant qu'elle est affichée
  useLiveRefresh(load);

  const markAllRead = async () => {
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await fetch('/api/notifications', { method: 'PATCH' }).catch(() => {});
  };

  const clearAll = async () => {
    setItems([]); setUnread(0);
    await fetch('/api/notifications', { method: 'DELETE' }).catch(() => {});
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const openItem = async (item: NotificationItem) => {
    if (!item.read) {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, read: true } : i));
      setUnread((u) => Math.max(0, u - 1));
      fetch(`/api/notifications/${item.id}`, { method: 'PATCH' }).catch(() => {});
    }
    // Alerte d'un projet ou d'une tâche : la section Projets l'ouvre directement
    if (item.meta?.taskId || item.meta?.projectId) {
      requestProjectsTarget({ taskId: item.meta.taskId || undefined, projectId: item.meta.projectId || undefined });
    }
    // Demande d'ami : ouvre le panneau Social
    if (item.type === 'social') {
      setOpen(false);
      window.dispatchEvent(new Event(OPEN_SOCIAL_EVENT));
    }
    if (item.link && onNavigate) {
      onNavigate(item.link as PageKey);
      setOpen(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-transparent dark:hover:bg-transparent" aria-label={unread > 0 ? `Notifications : ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}>
          <BellAnimation happy={unread > 0} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          <div className="flex items-center gap-1">
            {items.length > 0 && (
              <>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
                  <Check className="size-3.5 mr-1" /> Tout lu
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAll}>
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Bell className="size-6 mx-auto mb-2 opacity-40" />
              Aucune notification
            </div>
          ) : (
            items.map((item) => {
              const Icon = TYPE_ICON[item.type] || Bell;
              return (
                <div
                  key={item.id}
                  className={cn('group flex gap-2.5 px-3 py-2.5 border-b last:border-0 cursor-pointer hover:bg-muted/50', !item.read && 'bg-primary/5')}
                  onClick={() => openItem(item)}
                >
                  <Icon className={cn('size-4 mt-0.5 shrink-0', TYPE_COLOR[item.type] || 'text-muted-foreground')} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-tight', !item.read && 'font-semibold')}>{item.title}</p>
                    {item.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(item.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
