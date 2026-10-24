// Shared definition of the built-in navigation entries.
// Icons are stored as lucide names so both the sidebar and the settings
// re-order editor can render them via <DynamicIcon />.

export interface NavItemDef {
  key: string;
  label: string;
  icon: string; // lucide icon name
}

// Built-in content pages (Settings is pinned separately, not reorderable).
export const BUILTIN_NAV: NavItemDef[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard' },
  { key: 'calendar', label: 'Calendrier', icon: 'Calendar' },
  { key: 'routine', label: 'Routine', icon: 'SunMoon' },
  { key: 'missions', label: 'Objectif', icon: 'CheckSquare' },
  { key: 'projects', label: 'Projets', icon: 'FolderKanban' },
  { key: 'sport', label: 'Sport', icon: 'Dumbbell' },
  { key: 'nutrition', label: 'Nutrition', icon: 'Apple' },
  { key: 'sleep', label: 'Sommeil', icon: 'BedDouble' },
  { key: 'notes', label: 'Bloc-notes', icon: 'StickyNote' },
  { key: 'cuisine', label: 'Cuisine', icon: 'ChefHat' },
  { key: 'ai-agent', label: 'Agent IA', icon: 'Brain' },
  { key: 'validation', label: 'À valider', icon: 'ShieldCheck' },
  { key: 'applications', label: 'Suivi de demande', icon: 'Briefcase' },
  { key: 'budget', label: 'Budgets', icon: 'Wallet' },
  { key: 'wishlist', label: 'Wishlist', icon: 'Gift' },
  { key: 'travel', label: 'Voyages', icon: 'Plane' },
  { key: 'statistics', label: 'Statistiques', icon: 'BarChart3' },
];

export const BUILTIN_KEYS = BUILTIN_NAV.map((n) => n.key);
