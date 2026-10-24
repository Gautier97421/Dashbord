"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import { Color, FontFamily, FontSize, LineHeight, TextStyle } from "@tiptap/extension-text-style"
import { Highlight } from "@tiptap/extension-highlight"
import { TextAlign } from "@tiptap/extension-text-align"
import { Image } from "@tiptap/extension-image"
import { TableKit } from "@tiptap/extension-table"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { CharacterCount, Placeholder } from "@tiptap/extensions"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  Brush,
  Code,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Minus,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { DrawingDialog } from "./drawing-dialog"

const FONTS = [
  { label: "Police par défaut", value: "default" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Garamond", value: "Garamond, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Comic Sans MS", value: "'Comic Sans MS', 'Comic Sans', cursive" },
]
const SIZES = ["10", "11", "12", "14", "16", "18", "20", "24", "28", "32", "36", "48", "60"]
const LINE_HEIGHTS = [
  { label: "Interligne simple", value: "1.2" },
  { label: "Interligne 1,15", value: "1.4" },
  { label: "Interligne 1,5", value: "1.75" },
  { label: "Interligne double", value: "2.3" },
]
// Pas de noir : la couleur par défaut ("Automatique") suit déjà le thème, un noir imposé disparaîtrait en mode sombre
const TEXT_COLORS = ["#666666", "#999999", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#2563eb", "#7c3aed", "#db2777", "#92400e", "#0f766e"]
const HIGHLIGHTS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#e9d5ff", "#e5e7eb"]
const DEFAULT = "default"

// ─── Collage ─────────────────────────────────────────────────────────────────
// Le HTML copié depuis un site ou un document garde ses couleurs de texte et de fond (texte surligné
// en noir depuis une page sombre, couleurs vives…) : on ne garde que la structure et le gras /
// italique / souligné / alignement. Un copier-coller entre notes (marqué data-pm-slice) reste intact.
const KEPT_STYLES = new Set(["text-align", "font-weight", "font-style", "text-decoration", "text-decoration-line"])

export function cleanPastedHtml(html: string): string {
  if (html.includes("data-pm-slice")) return html
  const doc = new DOMParser().parseFromString(html, "text/html")
  doc.querySelectorAll("style, script, meta, link, title, xml").forEach((n) => n.remove())
  doc.body.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const style = el.getAttribute("style")
    if (style) {
      const kept = style
        .split(";")
        .map((d) => d.trim())
        .filter((d) => KEPT_STYLES.has(d.split(":")[0].trim().toLowerCase()))
      if (kept.length) el.setAttribute("style", kept.join("; "))
      else el.removeAttribute("style")
    }
    for (const attr of ["color", "bgcolor", "background", "face", "size", "class"]) el.removeAttribute(attr)
  })
  // Surlignages d'origine retirés : le texte collé arrive "propre"
  doc.body.querySelectorAll("mark").forEach((m) => m.replaceWith(...Array.from(m.childNodes)))
  return doc.body.innerHTML
}

/**
 * Retire les couleurs de texte "neutres" (noir, blanc, gris très foncés ou très clairs) : sans couleur
 * imposée, le texte suit le thème (foncé en mode clair, clair en mode sombre). Les vraies couleurs restent.
 */
export function stripNeutralColors(html: string): string {
  if (!html || typeof window === "undefined") return html
  const doc = new DOMParser().parseFromString(html, "text/html")
  doc.body.querySelectorAll<HTMLElement>("[style], font[color]").forEach((el) => {
    el.removeAttribute("color")
    const color = el.style.color
    const m = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!m) return
    const [r, g, b] = m.slice(1, 4).map(Number)
    const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 25 && (Math.max(r, g, b) < 90 || Math.min(r, g, b) > 200)
    if (neutral) {
      el.style.removeProperty("color")
      if (!el.getAttribute("style")) el.removeAttribute("style")
    }
  })
  return doc.body.innerHTML
}

// ─── Images ──────────────────────────────────────────────────────────────────

const MAX_SIDE = 2000

// Photos de téléphone : réduites (2000 px max, JPEG/WebP) avant l'envoi, pour rester sous les 10 Mo
async function prepareImage(file: File): Promise<Blob> {
  if (file.type === "image/gif" || file.size < 600_000) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const type = file.type === "image/png" ? "image/webp" : "image/jpeg"
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

async function uploadNoteImage(file: File, noteId: string): Promise<string> {
  const blob = await prepareImage(file)
  const form = new FormData()
  form.append("file", blob instanceof File ? blob : new File([blob], file.name.replace(/\.\w+$/, blob.type === "image/webp" ? ".webp" : ".jpg"), { type: blob.type }))
  form.append("noteId", noteId)
  const res = await fetch("/api/attachments", { method: "POST", body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Envoi impossible")
  return `/api/attachments/${data.id}`
}

// ─── Éditeur ─────────────────────────────────────────────────────────────────

interface NoteEditorProps {
  noteId: string
  initialHtml: string
  onChange: (html: string) => void
  // Fourni par le parent pour l'export / l'impression
  onReady?: (editor: Editor) => void
}

/** Éditeur de texte enrichi du bloc-notes (titres, polices, tailles, couleurs, listes, tableaux, images…). */
export function NoteEditor({ noteId, initialHtml, onChange, onReady }: NoteEditorProps) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(0)
  const [drawingOpen, setDrawingOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const insertImages = async (files: File[], pos?: number) => {
    const images = files.filter((f) => f.type.startsWith("image/"))
    if (!images.length) return
    setUploading((n) => n + images.length)
    for (const file of images) {
      try {
        const src = await uploadNoteImage(file, noteId)
        const editor = editorRef.current
        if (!editor) continue
        const node = { type: "image", attrs: { src, alt: file.name } }
        if (pos != null) editor.chain().focus().insertContentAt(pos, node).run()
        else editor.chain().focus().insertContent(node).run()
      } catch (error) {
        toast({ title: `Image « ${file.name} » non ajoutée`, description: error instanceof Error ? error.message : undefined, variant: "destructive" })
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }
  const insertImagesRef = useRef(insertImages)
  insertImagesRef.current = insertImages

  const editor = useEditor({
    immediatelyRender: false,
    // La barre d'outils suit la sélection (gras actif, taille courante…)
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight.configure({ types: ["paragraph", "heading"] }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({
        resize: { enabled: true, directions: ["top-left", "top-right", "bottom-left", "bottom-right"], minWidth: 60, minHeight: 40, alwaysPreserveAspectRatio: true },
      }),
      TableKit.configure({ table: { resizable: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Subscript,
      Superscript,
      CharacterCount,
      Placeholder.configure({ placeholder: "Commence à écrire… (colle ou glisse aussi des images)" }),
    ],
    // Couleurs neutres retirées : le texte suit le thème (anciennes notes, anciens collages)
    content: stripNeutralColors(initialHtml),
    editorProps: {
      attributes: { class: "note-content min-h-[50vh] focus:outline-none" },
      transformPastedHTML: cleanPastedHtml,
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"))
        if (!files.length) return false
        event.preventDefault()
        insertImagesRef.current(files)
        return true
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false
        const files = Array.from(event.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"))
        if (!files.length) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        insertImagesRef.current(files, pos)
        return true
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getHTML()),
  })

  useEffect(() => {
    editorRef.current = editor
    if (editor) onReady?.(editor)
  }, [editor, onReady])

  if (!editor) return <p className="py-12 text-center text-sm text-muted-foreground">Chargement de l&apos;éditeur…</p>

  const words = editor.storage.characterCount?.words?.() ?? 0
  const characters = editor.storage.characterCount?.characters?.() ?? 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar editor={editor} onPickImage={() => fileInputRef.current?.click()} onDraw={() => setDrawingOpen(true)} uploading={uploading > 0} />
      <DrawingDialog open={drawingOpen} onOpenChange={setDrawingOpen} onSave={(file) => insertImages([file])} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          insertImages(Array.from(e.target.files || []))
          e.target.value = ""
        }}
      />
      <div className="flex-1 overflow-auto bg-[#f8f1e3] dark:bg-[#1a1a1a]">
        <div className="mx-auto max-w-4xl p-3 sm:p-8">
          <div className="rounded bg-[#fffef5] p-5 text-base leading-relaxed shadow-lg dark:bg-[#242424] dark:text-gray-100 sm:p-10" onClick={() => editor.chain().focus().run()}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t bg-background px-4 py-1.5 text-xs text-muted-foreground">
        <span>
          {words} mot{words > 1 ? "s" : ""} · {characters} caractère{characters > 1 ? "s" : ""}
        </span>
        <span className="hidden sm:inline">Ctrl+Maj+V : coller sans mise en forme</span>
      </div>
    </div>
  )
}

// ─── Barre d'outils ──────────────────────────────────────────────────────────

function ToolButton({ active, onClick, label, children, disabled }: { active?: boolean; onClick: () => void; label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      // La sélection du texte ne doit pas être perdue au clic sur un bouton
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn("size-8 shrink-0", active && "bg-muted text-foreground")}
    >
      {children}
    </Button>
  )
}

const Divider = () => <span className="mx-1 h-6 w-px shrink-0 bg-border" />

function Toolbar({ editor, onPickImage, onDraw, uploading }: { editor: Editor; onPickImage: () => void; onDraw: () => void; uploading: boolean }) {
  const chain = () => editor.chain().focus()
  const textStyle = editor.getAttributes("textStyle")
  const block = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : editor.isActive("blockquote")
          ? "quote"
          : editor.isActive("codeBlock")
            ? "code"
            : "p"
  const fontSize = typeof textStyle.fontSize === "string" ? textStyle.fontSize.replace("px", "") : DEFAULT
  const fontFamily = FONTS.find((f) => f.value === textStyle.fontFamily)?.value || DEFAULT
  const lineHeight = editor.getAttributes("paragraph").lineHeight || editor.getAttributes("heading").lineHeight || DEFAULT
  const inTable = editor.isActive("table")

  const setBlock = (value: string) => {
    const c = chain()
    if (value === "p") c.setParagraph().run()
    else if (value === "h1" || value === "h2" || value === "h3") c.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run()
    else if (value === "quote") c.setParagraph().setBlockquote().run()
    else if (value === "code") c.setCodeBlock().run()
  }

  const listItem = editor.isActive("taskItem") ? "taskItem" : "listItem"

  return (
    // Mobile : une seule ligne qui défile ; grand écran : sur plusieurs lignes
    <div className="flex items-center gap-0.5 overflow-x-auto border-b bg-background px-2 py-1.5 sm:flex-wrap sm:px-4">
      <ToolButton label="Annuler (Ctrl+Z)" onClick={() => chain().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 className="size-4" />
      </ToolButton>
      <ToolButton label="Rétablir (Ctrl+Y)" onClick={() => chain().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 className="size-4" />
      </ToolButton>
      <Divider />

      <Select value={block} onValueChange={setBlock}>
        <SelectTrigger size="sm" className="w-32 shrink-0" aria-label="Style de paragraphe">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p">Texte normal</SelectItem>
          <SelectItem value="h1"><span className="text-lg font-bold">Titre 1</span></SelectItem>
          <SelectItem value="h2"><span className="text-base font-bold">Titre 2</span></SelectItem>
          <SelectItem value="h3"><span className="font-semibold">Titre 3</span></SelectItem>
          <SelectItem value="quote"><span className="italic">Citation</span></SelectItem>
          <SelectItem value="code"><span className="font-mono">Code</span></SelectItem>
        </SelectContent>
      </Select>
      <Select value={fontFamily} onValueChange={(v) => (v === DEFAULT ? chain().unsetFontFamily().run() : chain().setFontFamily(v).run())}>
        <SelectTrigger size="sm" className="w-36 shrink-0" aria-label="Police">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONTS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              <span style={{ fontFamily: f.value === DEFAULT ? undefined : f.value }}>{f.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={SIZES.includes(fontSize) ? fontSize : DEFAULT} onValueChange={(v) => (v === DEFAULT ? chain().unsetFontSize().run() : chain().setFontSize(`${v}px`).run())}>
        <SelectTrigger size="sm" className="w-20 shrink-0" aria-label="Taille du texte">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>Auto</SelectItem>
          {SIZES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Divider />

      <ToolButton label="Gras (Ctrl+B)" active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()}>
        <Bold className="size-4" />
      </ToolButton>
      <ToolButton label="Italique (Ctrl+I)" active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()}>
        <Italic className="size-4" />
      </ToolButton>
      <ToolButton label="Souligné (Ctrl+U)" active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()}>
        <UnderlineIcon className="size-4" />
      </ToolButton>
      <ToolButton label="Barré" active={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </ToolButton>
      <ToolButton label="Exposant" active={editor.isActive("superscript")} onClick={() => chain().toggleSuperscript().run()}>
        <SuperscriptIcon className="size-4" />
      </ToolButton>
      <ToolButton label="Indice" active={editor.isActive("subscript")} onClick={() => chain().toggleSubscript().run()}>
        <SubscriptIcon className="size-4" />
      </ToolButton>
      <ToolButton label="Code" active={editor.isActive("code")} onClick={() => chain().toggleCode().run()}>
        <Code className="size-4" />
      </ToolButton>

      <ColorPopover
        label="Couleur du texte"
        icon={<Baseline className="size-4" />}
        current={typeof textStyle.color === "string" ? textStyle.color : undefined}
        colors={TEXT_COLORS}
        onPick={(c) => chain().setColor(c).run()}
        onClear={() => chain().unsetColor().run()}
        clearLabel="Couleur automatique"
        allowCustom
      />
      <ColorPopover
        label="Surligner"
        icon={<Highlighter className="size-4" />}
        current={editor.isActive("highlight") ? editor.getAttributes("highlight").color || HIGHLIGHTS[0] : undefined}
        colors={HIGHLIGHTS}
        onPick={(c) => chain().setHighlight({ color: c }).run()}
        onClear={() => chain().unsetHighlight().run()}
        clearLabel="Sans surlignage"
      />
      <Divider />

      <ToolButton label="Aligner à gauche" active={editor.isActive({ textAlign: "left" })} onClick={() => chain().setTextAlign("left").run()}>
        <AlignLeft className="size-4" />
      </ToolButton>
      <ToolButton label="Centrer" active={editor.isActive({ textAlign: "center" })} onClick={() => chain().setTextAlign("center").run()}>
        <AlignCenter className="size-4" />
      </ToolButton>
      <ToolButton label="Aligner à droite" active={editor.isActive({ textAlign: "right" })} onClick={() => chain().setTextAlign("right").run()}>
        <AlignRight className="size-4" />
      </ToolButton>
      <ToolButton label="Justifier" active={editor.isActive({ textAlign: "justify" })} onClick={() => chain().setTextAlign("justify").run()}>
        <AlignJustify className="size-4" />
      </ToolButton>
      <Select value={LINE_HEIGHTS.some((l) => l.value === lineHeight) ? lineHeight : DEFAULT} onValueChange={(v) => (v === DEFAULT ? chain().unsetLineHeight().run() : chain().setLineHeight(v).run())}>
        <SelectTrigger size="sm" className="w-36 shrink-0" aria-label="Interligne">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>Interligne normal</SelectItem>
          {LINE_HEIGHTS.map((l) => (
            <SelectItem key={l.value} value={l.value}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Divider />

      <ToolButton label="Liste à puces" active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()}>
        <List className="size-4" />
      </ToolButton>
      <ToolButton label="Liste numérotée" active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </ToolButton>
      <ToolButton label="Liste de tâches" active={editor.isActive("taskList")} onClick={() => chain().toggleTaskList().run()}>
        <ListChecks className="size-4" />
      </ToolButton>
      <ToolButton label="Diminuer le retrait" onClick={() => chain().liftListItem(listItem).run()} disabled={!editor.can().liftListItem(listItem)}>
        <IndentDecrease className="size-4" />
      </ToolButton>
      <ToolButton label="Augmenter le retrait" onClick={() => chain().sinkListItem(listItem).run()} disabled={!editor.can().sinkListItem(listItem)}>
        <IndentIncrease className="size-4" />
      </ToolButton>
      <Divider />

      <LinkPopover editor={editor} />
      <ToolButton label="Insérer une image" onClick={onPickImage} disabled={uploading}>
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
      </ToolButton>
      <ToolButton label="Dessiner (souris, doigt ou stylet)" onClick={onDraw} disabled={uploading}>
        <Brush className="size-4" />
      </ToolButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className={cn("size-8 shrink-0", inTable && "bg-muted")} aria-label="Tableau" title="Tableau">
            <TableIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Insérer un tableau 3 × 3</DropdownMenuItem>
          {inTable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => chain().addRowBefore().run()}>Ligne au-dessus</DropdownMenuItem>
              <DropdownMenuItem onClick={() => chain().addRowAfter().run()}>Ligne en dessous</DropdownMenuItem>
              <DropdownMenuItem onClick={() => chain().addColumnBefore().run()}>Colonne à gauche</DropdownMenuItem>
              <DropdownMenuItem onClick={() => chain().addColumnAfter().run()}>Colonne à droite</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => chain().mergeOrSplit().run()}>Fusionner / scinder les cellules</DropdownMenuItem>
              <DropdownMenuItem onClick={() => chain().toggleHeaderRow().run()}>Ligne d&apos;en-tête</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => chain().deleteRow().run()}>Supprimer la ligne</DropdownMenuItem>
              <DropdownMenuItem onClick={() => chain().deleteColumn().run()}>Supprimer la colonne</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => chain().deleteTable().run()}>
                Supprimer le tableau
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolButton label="Ligne de séparation" onClick={() => chain().setHorizontalRule().run()}>
        <Minus className="size-4" />
      </ToolButton>
      <ToolButton label="Effacer la mise en forme" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting className="size-4" />
      </ToolButton>
    </div>
  )
}

function ColorPopover({
  label,
  icon,
  current,
  colors,
  onPick,
  onClear,
  clearLabel,
  allowCustom = false,
}: {
  label: string
  icon: ReactNode
  current?: string
  colors: string[]
  onPick: (color: string) => void
  onClear: () => void
  clearLabel: string
  allowCustom?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative size-8 shrink-0" aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()}>
          {icon}
          <span className="absolute bottom-1 left-1.5 right-1.5 h-0.5 rounded" style={{ backgroundColor: current || "transparent" }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-2 p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="grid grid-cols-6 gap-1.5">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onPick(c)
                setOpen(false)
              }}
              className={cn("size-7 rounded-md border transition-transform hover:scale-110", current === c && "ring-2 ring-primary ring-offset-1")}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>
        {allowCustom && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="color" className="size-7 cursor-pointer rounded border bg-transparent" onChange={(e) => onPick(e.target.value)} />
            Autre couleur
          </label>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            onClear()
            setOpen(false)
          }}
        >
          {clearLabel}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function LinkPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const active = editor.isActive("link")

  const apply = () => {
    const value = url.trim()
    if (!value) editor.chain().focus().extendMarkRange("link").unsetLink().run()
    else editor.chain().focus().extendMarkRange("link").setLink({ href: /^[a-z]+:/i.test(value) ? value : `https://${value}` }).run()
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setUrl(editor.getAttributes("link").href || "")
        setOpen(o)
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className={cn("size-8 shrink-0", active && "bg-muted")} aria-label="Lien" title="Lien (sélectionne du texte)" onMouseDown={(e) => e.preventDefault()}>
          <Link2 className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 p-3">
        <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), apply())} autoFocus />
        <div className="flex justify-end gap-2">
          {active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run()
                setOpen(false)
              }}
            >
              Retirer le lien
            </Button>
          )}
          <Button size="sm" onClick={apply}>
            Appliquer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
