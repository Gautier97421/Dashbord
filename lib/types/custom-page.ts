// Types for user-created custom pages.

export type BlockType =
  | 'checklist'
  | 'tasks'
  | 'dates'
  | 'list'
  | 'notes'
  | 'collection'
  | 'calendar'
  | 'routine';

// ── Simple item (checklist, tasks, dates, list) ──
export interface BlockItem {
  id: string;
  text: string;
  done?: boolean;                         // checklist, tasks
  priority?: 'low' | 'medium' | 'high';   // tasks
  date?: string;                          // dates, tasks due date
}

// ── Collection (custom fields = mini database) ──
export type FieldType = 'text' | 'longtext' | 'number' | 'date' | 'checkbox' | 'select';

export interface CollectionField {
  id: string;
  name: string;
  type: FieldType;
  options?: string[];   // for select
}

export interface CollectionRecord {
  id: string;
  values: Record<string, string | number | boolean>; // keyed by field id
  createdAt: string;
}

// ── Calendar ──
export interface CalendarEvent {
  id: string;
  date: string;   // YYYY-MM-DD
  title: string;
  startTime?: string;
  endTime?: string;
  priority?: 'low' | 'medium' | 'high';
  completed?: boolean;
  color?: string;
}

// ── Routine (daily tracking) ──
export type RoutineCategory = 'health' | 'sport' | 'mental' | 'work' | 'personal';

export interface RoutineItem {
  id: string;
  text: string;
  category?: RoutineCategory;
  importance?: 'low' | 'medium' | 'high';
}

// ── A block can hold any of the above shapes ──
export interface PageBlock {
  id: string;
  type: BlockType;
  title: string;

  // simple lists
  items?: BlockItem[];
  text?: string;        // notes

  // collection
  fields?: CollectionField[];
  records?: CollectionRecord[];

  // calendar
  events?: CalendarEvent[];

  // routine
  routineItems?: RoutineItem[];
  log?: Record<string, string[]>; // 'YYYY-MM-DD' -> array of completed routine item ids
}

export interface CustomPage {
  id: string;
  name: string;
  icon: string;
  color: string | null;
  order: number;
  blocks: PageBlock[];
  createdAt: string;
  updatedAt: string;
}

// Curated lucide icon names.
export const PAGE_ICONS = [
  'Sparkles', 'Star', 'Heart', 'Cake', 'Gift', 'Calendar', 'CalendarHeart',
  'Sun', 'Moon', 'CheckSquare', 'ListTodo', 'Target', 'Flag', 'Trophy',
  'Dumbbell', 'BookOpen', 'GraduationCap', 'Briefcase', 'Plane', 'Home',
  'ShoppingCart', 'Wallet', 'PiggyBank', 'Music', 'Film', 'Gamepad2',
  'Camera', 'Palette', 'Coffee', 'Pizza', 'Leaf', 'Dog', 'Cat', 'Baby',
  'Users', 'MapPin', 'Clock', 'Bell', 'Zap', 'Rocket', 'Lightbulb', 'Table2',
] as const;

export const BLOCK_TYPE_META: Record<BlockType, { label: string; description: string; icon: string }> = {
  collection: { label: 'Collection', description: 'Tes propres champs (ex : candidatures)', icon: 'Table2' },
  calendar:   { label: 'Calendrier', description: 'Vue mensuelle avec événements', icon: 'Calendar' },
  routine:    { label: 'Routine',    description: 'Suivi quotidien avec progression', icon: 'Sun' },
  checklist:  { label: 'Checklist',  description: 'Cases à cocher simples', icon: 'CheckSquare' },
  tasks:      { label: 'Tâches',     description: 'Tâches avec priorité et échéance', icon: 'ListTodo' },
  dates:      { label: 'Dates',      description: 'Liste triée par date', icon: 'CalendarHeart' },
  list:       { label: 'Liste',      description: 'Liste à puces simple', icon: 'List' },
  notes:      { label: 'Notes',      description: 'Bloc de texte libre', icon: 'StickyNote' },
};

export const FIELD_TYPE_META: Record<FieldType, { label: string; icon: string }> = {
  text:     { label: 'Texte', icon: 'Type' },
  longtext: { label: 'Texte long', icon: 'AlignLeft' },
  number:   { label: 'Nombre', icon: 'Hash' },
  date:     { label: 'Date', icon: 'Calendar' },
  checkbox: { label: 'Oui / Non', icon: 'CheckSquare' },
  select:   { label: 'Choix', icon: 'List' },
};
