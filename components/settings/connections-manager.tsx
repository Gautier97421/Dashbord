'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

// ─── Tool catalog ─────────────────────────────────────────────────────────────

interface Tool {
  id: string;
  name: string;
  icon: string;
  color: string;
  status: 'oauth' | 'soon';
  connectHref?: string;
  statusEndpoint?: string;
  // Logo noir : inversé en mode sombre pour rester visible
  invertInDark?: boolean;
}

const TOOLS: Tool[] = [
  { id: 'gmail',    name: 'Gmail',    icon: '/logos/gmail.png',    color: '#EA4335', status: 'oauth', connectHref: '/api/gmail/connect',    statusEndpoint: '/api/gmail/status' },
  { id: 'outlook',  name: 'Outlook',  icon: '/logos/outlook.svg',  color: '#0078D4', status: 'oauth', connectHref: '/api/outlook/connect',  statusEndpoint: '/api/outlook/status' },
  { id: 'spotify',  name: 'Spotify',  icon: '/logos/spotify.png',  color: '#1DB954', status: 'oauth', connectHref: '/api/spotify/connect',  statusEndpoint: '/api/spotify/status' },
  { id: 'youtube',  name: 'YouTube',  icon: '/logos/YouTube.png',  color: '#FF0000', status: 'oauth', connectHref: '/api/youtube/connect',  statusEndpoint: '/api/youtube/status' },
  { id: 'linkedin', name: 'LinkedIn', icon: '/logos/linkedin.png', color: '#0A66C2', status: 'oauth', connectHref: '/api/linkedin/connect', statusEndpoint: '/api/linkedin/status' },
  { id: 'github',   name: 'GitHub',   icon: '/logos/github.png',   color: '#8b949e', invertInDark: true, status: 'oauth', connectHref: '/api/github/connect',   statusEndpoint: '/api/github/status' },
  { id: 'notion',   name: 'Notion',   icon: '/logos/notion.png',   color: '#9b9a97', invertInDark: true, status: 'oauth', connectHref: '/api/notion/connect',   statusEndpoint: '/api/notion/status' },
  { id: 'discord',  name: 'Discord',  icon: '/logos/discord.png',  color: '#5865F2', status: 'oauth', connectHref: '/api/discord/connect',  statusEndpoint: '/api/discord/status' },
  { id: 'trello',   name: 'Trello',   icon: '/logos/Trello.png',   color: '#0052CC', status: 'oauth', connectHref: '/api/trello/connect',   statusEndpoint: '/api/trello/status' },
  { id: 'netflix',  name: 'Netflix',  icon: '/logos/netflix.png',  color: '#E50914', status: 'soon' },
  { id: 'amazon',   name: 'Amazon',   icon: '/logos/Amazon.png',   color: '#FF9900', status: 'soon' },
];

// ─── Light-button icon ────────────────────────────────────────────────────────

type IconState = 'connected' | 'available' | 'soon';

function LightIcon({ tool, state, sublabel, onClick }: {
  tool: Tool; state: IconState; sublabel?: string; onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const clickable = state !== 'soon';
  const isConnected = state === 'connected';
  const beamClass = isConnected ? 'light-beam-connected' : hovered && clickable ? 'light-beam-hover' : '';

  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex flex-col items-center outline-none select-none ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ height: 160, width: 80 }}
    >
      <div className="absolute top-0 left-0 right-0 flex flex-col items-center" style={{ height: 120 }}>
        <div
          className="relative z-10 rounded-full transition-all duration-300"
          style={{
            width: 10, height: 10,
            backgroundColor: isConnected ? tool.color : hovered && clickable ? tool.color : '#4b5563',
            boxShadow: isConnected ? `0 0 8px 3px ${tool.color}99` : hovered && clickable ? `0 0 6px 2px ${tool.color}66` : 'none',
          }}
        />
        <div
          className={beamClass}
          style={{
            position: 'absolute', top: 0, width: 160, height: 120,
            clipPath: 'polygon(50% 0%, 20% 100%, 80% 100%)',
            background: `linear-gradient(180deg, ${tool.color} 0%, ${tool.color}55 50%, transparent 100%)`,
            opacity: isConnected ? undefined : 0, pointerEvents: 'none',
          }}
        />
      </div>
      <div
        className="absolute bottom-6 flex items-center justify-center transition-all duration-200"
        style={{
          width: 56, height: 56,
          filter: isConnected ? `drop-shadow(0 0 8px ${tool.color}88)` : state === 'soon' ? 'grayscale(1) opacity(0.35)' : hovered ? `drop-shadow(0 0 6px ${tool.color}66)` : 'none',
          transform: hovered && clickable && !isConnected ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <img src={tool.icon} alt={tool.name} className={cn("w-full h-full object-contain", tool.invertInDark && "dark:invert")} draggable={false} />
      </div>
      <span
        // Couleurs du thème (clair / sombre) ; un service connecté prend sa propre couleur
        className={cn(
          'absolute bottom-0 text-[11px] text-center leading-none w-20 truncate transition-colors duration-200',
          !isConnected && (hovered && clickable ? 'text-foreground' : state === 'soon' ? 'text-muted-foreground/60' : 'text-muted-foreground')
        )}
        style={isConnected ? { color: tool.color } : undefined}
      >
        {isConnected && sublabel ? (sublabel.includes('@') ? sublabel.split('@')[0] : sublabel) : tool.name}
      </span>
    </button>
  );
}

function ToolSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-5">{children}</div>
      <div className="border-b border-gray-100 dark:border-gray-800" />
    </div>
  );
}

// ─── Manager ──────────────────────────────────────────────────────────────────

export function ConnectionsManager() {
  const [connected, setConnected] = useState<Record<string, string>>({});

  const loadStatuses = useCallback(async () => {
    const oauthTools = TOOLS.filter(t => t.status === 'oauth' && t.statusEndpoint);
    const results = await Promise.allSettled(
      oauthTools.map(t => fetch(t.statusEndpoint!).then(r => r.ok ? r.json() : null))
    );
    const next: Record<string, string> = {};
    oauthTools.forEach((t, i) => {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value?.connected) next[t.id] = r.value.identifier || r.value.email || '✓';
    });
    setConnected(next);
  }, []);

  useEffect(() => { loadStatuses(); }, [loadStatuses]);

  const handleClick = (tool: Tool) => {
    if (tool.status === 'soon' || !tool.connectHref) return;
    if (connected[tool.id]) {
      if (window.confirm(`Reconnecter ${tool.name} ?`)) window.location.href = tool.connectHref;
    } else {
      window.location.href = tool.connectHref;
    }
  };

  const connectedTools = TOOLS.filter(t => t.status === 'oauth' && connected[t.id]);
  const availableTools = TOOLS.filter(t => t.status === 'oauth' && !connected[t.id]);
  const soonTools = TOOLS.filter(t => t.status === 'soon');

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-950/50 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Connecte tes applications</p>
        <p className="text-sm text-blue-700 dark:text-blue-400">Appuie sur une icône pour connecter (ou reconnecter) un service. Une fois connectés, ils alimentent l'Agent IA et les automatisations.</p>
      </div>

      {connectedTools.length > 0 ? (
        <ToolSection title="Connecté" color="bg-green-500">
          {connectedTools.map(tool => (
            <LightIcon key={tool.id} tool={tool} state="connected" sublabel={connected[tool.id]} onClick={() => handleClick(tool)} />
          ))}
        </ToolSection>
      ) : (
        <ToolSection title="Connecté" color="bg-green-500">
          <p className="text-sm text-gray-400 italic py-2">Aucun service connecté — connecte-en un ci-dessous.</p>
        </ToolSection>
      )}

      <ToolSection title="Non connecté" color="bg-blue-500">
        {availableTools.map(tool => (
          <LightIcon key={tool.id} tool={tool} state="available" onClick={() => handleClick(tool)} />
        ))}
      </ToolSection>

      <ToolSection title="Bientôt disponible" color="bg-gray-300">
        {soonTools.map(tool => <LightIcon key={tool.id} tool={tool} state="soon" />)}
      </ToolSection>
    </div>
  );
}
