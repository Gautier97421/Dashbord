'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Search, Settings2, Trash2, X, GripVertical, Check,
} from 'lucide-react';
import { genId } from '@/lib/custom-pages-context';
import { DynamicIcon } from '@/lib/icon-map';
import {
  type PageBlock, type CollectionField, type CollectionRecord,
  type FieldType, FIELD_TYPE_META,
} from '@/lib/types/custom-page';
import { cn } from '@/lib/utils';

interface Props {
  block: PageBlock;
  onChange: (patch: Partial<PageBlock>) => void;
}

export function CollectionBlock({ block, onChange }: Props) {
  const fields = block.fields || [];
  const records = block.records || [];

  const [search, setSearch] = useState('');
  const [editRecord, setEditRecord] = useState<CollectionRecord | null>(null);
  const [fieldsOpen, setFieldsOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      Object.values(r.values).some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }, [records, search]);

  const titleField = fields[0];

  const addRecord = () => {
    const rec: CollectionRecord = { id: genId(), values: {}, createdAt: new Date().toISOString() };
    onChange({ records: [rec, ...records] });
    setEditRecord(rec);
  };

  const saveRecord = (rec: CollectionRecord) => {
    onChange({ records: records.map((r) => (r.id === rec.id ? rec : r)) });
  };

  const deleteRecord = (id: string) => {
    onChange({ records: records.filter((r) => r.id !== id) });
    setEditRecord(null);
  };

  const renderValue = (field: CollectionField, value: string | number | boolean | undefined) => {
    if (value === undefined || value === '' || value === null) return <span className="text-muted-foreground/50">—</span>;
    if (field.type === 'checkbox') {
      return value
        ? <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium"><Check className="w-3 h-3" /> Oui</span>
        : <span className="text-muted-foreground text-xs">Non</span>;
    }
    if (field.type === 'select') {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{String(value)}</span>;
    }
    if (field.type === 'date') {
      try { return <span className="text-sm">{new Date(String(value)).toLocaleDateString('fr-FR')}</span>; }
      catch { return <span className="text-sm">{String(value)}</span>; }
    }
    return <span className="text-sm">{String(value)}</span>;
  };

  return (
    <div className="space-y-3">
      {/* Toolbar: search + new + fields */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={addRecord} className="h-9 flex-1 sm:flex-none">
            <Plus className="w-4 h-4 mr-1" /> Nouveau
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setFieldsOpen(true)} title="Configurer les champs">
            <Settings2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Records as cards (mobile-first) */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
          {records.length === 0 ? 'Aucune entrée. Clique sur « Nouveau ».' : 'Aucun résultat.'}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((rec) => (
            <button
              key={rec.id}
              onClick={() => setEditRecord(rec)}
              className="text-left p-3 rounded-xl border bg-card hover:shadow-sm hover:border-primary/40 transition-all"
            >
              <div className="font-semibold mb-1.5 truncate">
                {titleField ? (String(rec.values[titleField.id] ?? '') || 'Sans titre') : 'Sans titre'}
              </div>
              <div className="space-y-1">
                {fields.slice(1).map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0">{f.name} :</span>
                    <span className="truncate">{renderValue(f, rec.values[f.id])}</span>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Record editor */}
      <RecordDialog
        open={!!editRecord}
        record={editRecord}
        fields={fields}
        onClose={() => setEditRecord(null)}
        onSave={saveRecord}
        onDelete={deleteRecord}
      />

      {/* Fields manager */}
      <FieldsDialog
        open={fieldsOpen}
        fields={fields}
        onClose={() => setFieldsOpen(false)}
        onChange={(nextFields) => onChange({ fields: nextFields })}
      />
    </div>
  );
}

// ─── Record editor dialog ─────────────────────────────────────────────────────

function RecordDialog({ open, record, fields, onClose, onSave, onDelete }: {
  open: boolean;
  record: CollectionRecord | null;
  fields: CollectionField[];
  onClose: () => void;
  onSave: (rec: CollectionRecord) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<CollectionRecord | null>(record);

  React.useEffect(() => { setDraft(record); }, [record]);

  if (!draft) return null;

  const setValue = (fieldId: string, value: string | number | boolean) => {
    setDraft({ ...draft, values: { ...draft.values, [fieldId]: value } });
  };

  const handleSave = () => { onSave(draft); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onSave(draft); onClose(); } }}>
      <DialogContent className="max-w-[92vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entrée</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.id} className="space-y-1">
              <label className="text-sm font-medium">{field.name}</label>
              <FieldInput field={field} value={draft.values[field.id]} onChange={(v) => setValue(field.id, v)} />
            </div>
          ))}
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">Ajoute d'abord des champs (icône ⚙️).</p>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" className="text-destructive" onClick={() => onDelete(draft.id)}>
            <Trash2 className="w-4 h-4 mr-1" /> Supprimer
          </Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({ field, value, onChange }: {
  field: CollectionField;
  value: string | number | boolean | undefined;
  onChange: (v: string | number | boolean) => void;
}) {
  switch (field.type) {
    case 'longtext':
      return (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full resize-y bg-muted/30 rounded-lg p-2 text-sm outline-none focus:ring-1 focus:ring-primary/30"
        />
      );
    case 'number':
      return <Input type="number" value={String(value ?? '')} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
    case 'date':
      return <Input type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'checkbox':
      return (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
            value ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300' : 'bg-muted/30'
          )}
        >
          <span className={cn('w-4 h-4 rounded border flex items-center justify-center', value && 'bg-green-500 border-green-500')}>
            {value ? <Check className="w-3 h-3 text-white" strokeWidth={3} /> : null}
          </span>
          {value ? 'Oui' : 'Non'}
        </button>
      );
    case 'select':
      return (
        <Select value={String(value ?? '')} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      return <Input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  }
}

// ─── Fields manager dialog ────────────────────────────────────────────────────

function FieldsDialog({ open, fields, onClose, onChange }: {
  open: boolean;
  fields: CollectionField[];
  onClose: () => void;
  onChange: (fields: CollectionField[]) => void;
}) {
  const addField = () => {
    onChange([...fields, { id: genId(), name: 'Nouveau champ', type: 'text' }]);
  };
  const updateField = (id: string, patch: Partial<CollectionField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };
  const deleteField = (id: string) => onChange(fields.filter((f) => f.id !== id));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[92vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Champs de la collection</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">Le premier champ sert de titre aux entrées.</p>

        <div className="space-y-2">
          {fields.map((field) => (
            <div key={field.id} className="space-y-2 p-2.5 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  value={field.name}
                  onChange={(e) => updateField(field.id, { name: e.target.value })}
                  className="h-8 flex-1"
                  placeholder="Nom du champ"
                />
                <Select value={field.type} onValueChange={(v) => updateField(field.id, { type: v as FieldType })}>
                  <SelectTrigger className="h-8 w-36 shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIELD_TYPE_META) as FieldType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                          <DynamicIcon name={FIELD_TYPE_META[t].icon} className="w-3.5 h-3.5" />
                          {FIELD_TYPE_META[t].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="size-8 text-destructive shrink-0" onClick={() => deleteField(field.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Options for select type */}
              {field.type === 'select' && (
                <SelectOptionsEditor
                  options={field.options || []}
                  onChange={(opts) => updateField(field.id, { options: opts })}
                />
              )}
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addField}>
          <Plus className="w-4 h-4 mr-1" /> Ajouter un champ
        </Button>

        <DialogFooter>
          <Button onClick={onClose}>Terminé</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectOptionsEditor({ options, onChange }: { options: string[]; onChange: (opts: string[]) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="pl-6 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <span key={opt} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {opt}
            <button onClick={() => onChange(options.filter((o) => o !== opt))}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && val.trim()) { onChange([...options, val.trim()]); setVal(''); }
          }}
          placeholder="Ajouter une option…"
          className="h-7 text-xs"
        />
        <Button
          size="sm" variant="outline" className="h-7"
          onClick={() => { if (val.trim()) { onChange([...options, val.trim()]); setVal(''); } }}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
