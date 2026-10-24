"use client"

import { useState, useMemo, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import type { Editor } from "@tiptap/react"
import { sanitizeNoteHtml } from "@/lib/sanitize-html"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Trash2,
  Edit,
  Pin,
  PinOff,
  Search,
  ArrowLeft,
  Check,
  Download,
  FileDown,
  Loader2,
  Printer,
} from "lucide-react"
import { useApp } from "@/lib/store-api"
import { formatDateFr } from "@/lib/helpers"
import type { Note } from "@/lib/types"
import { cn } from "@/lib/utils"
import { NoteEditor } from "@/components/notes/note-editor"
import { Lottie, MoreDots } from "@/components/lottie"

const NOTE_COLORS = [
  { value: "#fef3c7", label: "Jaune" },
  { value: "#dbeafe", label: "Bleu" },
  { value: "#dcfce7", label: "Vert" },
  { value: "#fce7f3", label: "Rose" },
  { value: "#f3e8ff", label: "Violet" },
  { value: "#fed7aa", label: "Orange" },
  { value: "#e0e7ff", label: "Indigo" },
  { value: "#ffffff", label: "Blanc" },
]

const AUTOSAVE_MS = 1500

const safeFileName = (title: string) => title.replace(/[^a-z0-9àâäéèêëîïôöùûüç _-]/gi, "_").trim() || "note"

// Impression (et "Enregistrer en PDF" du navigateur) : la note seule, avec toute sa mise en forme et ses images
function printNote(title: string, html: string) {
  const root = document.createElement("div")
  root.id = "note-print-root"
  const heading = document.createElement("h1")
  heading.textContent = title
  heading.style.cssText = "font-size: 24px; font-weight: 700; margin-bottom: 16px"
  const content = document.createElement("div")
  content.className = "note-content"
  content.innerHTML = sanitizeNoteHtml(html)
  root.append(heading, content)
  document.body.appendChild(root)
  document.documentElement.classList.add("printing-note")
  const cleanup = () => {
    document.documentElement.classList.remove("printing-note")
    root.remove()
    window.removeEventListener("afterprint", cleanup)
  }
  window.addEventListener("afterprint", cleanup)
  window.print()
}

// Les images de la note n'existent que sur le serveur : elles sont intégrées au fichier Word
async function inlineImages(html: string): Promise<string> {
  const container = document.createElement("div")
  container.innerHTML = html
  await Promise.all(
    Array.from(container.querySelectorAll("img")).map(async (img) => {
      try {
        const blob = await fetch(img.src).then((r) => r.blob())
        img.src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      } catch {
        /* image indisponible : on garde le lien */
      }
    })
  )
  return container.innerHTML
}

// Fichier .doc (HTML que Word, LibreOffice et Google Docs ouvrent avec la mise en forme)
async function exportToWord(title: string, html: string) {
  const body = await inlineImages(sanitizeNoteHtml(html))
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 6px}blockquote{border-left:3px solid #ccc;padding-left:12px;color:#555}</style></head><body><h1>${title.replace(/</g, "&lt;")}</h1>${body}</body></html>`
  const url = URL.createObjectURL(new Blob(["﻿", doc], { type: "application/msword" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `${safeFileName(title)}.doc`
  a.click()
  URL.revokeObjectURL(url)
}

export function NotesPage() {
  const { state, addNote, updateNote, deleteNote } = useApp()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [currentNote, setCurrentNote] = useState<Note | null>(null)
  const [saveState, setSaveState] = useState<"saved" | "pending" | "saving">("saved")
  const [searchQuery, setSearchQuery] = useState("")
  const [newNote, setNewNote] = useState<Partial<Note>>({
    title: "",
    color: "#fef3c7",
    pinned: false,
  })
  // Dernier contenu de l'éditeur et sauvegarde automatique en attente
  const latestHtml = useRef("")
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const editorRef = useRef<Editor | null>(null)

  const filteredNotes = useMemo(() => {
    if (!searchQuery) return state.notes || []
    const query = searchQuery.toLowerCase()
    return (state.notes || []).filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
    )
  }, [state.notes, searchQuery])

  const pinnedNotes = useMemo(() => filteredNotes.filter((n) => n.pinned), [filteredNotes])
  const unpinnedNotes = useMemo(() => filteredNotes.filter((n) => !n.pinned), [filteredNotes])

  const handleSaveNote = async () => {
    if (!newNote.title) return

    if (editingNote) {
      await updateNote({
        ...editingNote,
        title: newNote.title || "Sans titre",
        color: newNote.color,
        pinned: newNote.pinned || false,
      })
    } else {
      await addNote({
        title: newNote.title || "Sans titre",
        content: "",
        color: newNote.color || "#fef3c7",
        pinned: newNote.pinned || false,
      })
    }

    resetForm()
  }

  const resetForm = () => {
    setNewNote({ title: "", color: "#fef3c7", pinned: false })
    setEditingNote(null)
    setIsDialogOpen(false)
  }

  const openNoteEditor = (note: Note) => {
    latestHtml.current = note.content
    setSaveState("saved")
    setCurrentNote(note)
  }

  const save = useCallback(
    async (note: Note, content: string) => {
      setSaveState("saving")
      try {
        await updateNote({ ...note, content })
        // Le contenu a pu changer pendant l'envoi : une autre sauvegarde suivra
        setSaveState((s) => (s === "saving" && latestHtml.current === content ? "saved" : s))
      } catch {
        setSaveState("pending")
      }
    },
    [updateNote]
  )

  const handleEditorChange = useCallback(
    (html: string) => {
      if (!currentNote) return
      latestHtml.current = html
      setSaveState("pending")
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = setTimeout(() => save(currentNote, html), AUTOSAVE_MS)
    },
    [currentNote, save]
  )

  const closeNoteEditor = async () => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    // Dernière sauvegarde si quelque chose a changé
    if (currentNote && latestHtml.current !== currentNote.content) {
      await updateNote({ ...currentNote, content: latestHtml.current })
    }
    editorRef.current = null
    setCurrentNote(null)
  }

  const onEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor
  }, [])

  const openEditDialog = (note: Note) => {
    setEditingNote(note)
    setNewNote({
      title: note.title,
      color: note.color,
      pinned: note.pinned,
    })
    setIsDialogOpen(true)
  }

  const handleDeleteNote = async (id: string) => {
    await deleteNote(id)
  }

  const togglePin = async (note: Note) => {
    await updateNote({
      ...note,
      pinned: !note.pinned,
    })
  }

  const renderNoteCard = (note: Note) => (
    <Card
      key={note.id}
      // Fond pastel même en mode sombre : texte toujours foncé pour rester lisible
      className="group relative overflow-hidden text-neutral-900 transition-all hover:shadow-lg cursor-pointer"
      style={{ backgroundColor: note.color }}
      onClick={() => openNoteEditor(note)}
    >
      <CardContent className="p-4 min-h-[200px] flex flex-col">
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 bg-background/80"
            onClick={(e) => {
              e.stopPropagation()
              togglePin(note)
            }}
          >
            {note.pinned ? (
              <PinOff className="size-4" />
            ) : (
              <Pin className="size-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="size-8 bg-background/80 hover:bg-background/80 hover:text-foreground dark:hover:bg-background/80">
                <MoreDots />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                openEditDialog(note)
              }}>
                <Edit className="size-4 mr-2" />
                Modifier le titre
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteNote(note.id)
                }}
                className="text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {note.pinned && (
          <Pin className="absolute top-2 left-2 size-4 text-neutral-600" />
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg mb-2 pr-16">
            {note.title}
          </h3>
          <div
            className="note-content max-h-40 overflow-hidden text-sm text-neutral-700 [&_img]:max-h-24 [&_img]:w-auto"
            // Contenu nettoyé : une note ne doit jamais pouvoir exécuter de script (XSS)
            dangerouslySetInnerHTML={{
              __html: sanitizeNoteHtml(note.content) || "<em>Aucun contenu</em>"
            }}
          />
        </div>

        <div className="text-xs text-neutral-600 mt-4">
          {formatDateFr(note.updatedAt, "short")}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Bloc-notes</h1>
          <p className="text-sm text-muted-foreground">
            Prenez des notes rapides et organisez vos idées
          </p>
        </div>

        <Button data-tour="notes-add" onClick={() => setIsDialogOpen(true)} size="sm" className="sm:size-default w-full sm:w-auto">
          <Plus className="size-4 mr-2" />
          Nouvelle note
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une note..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Pinned Notes */}
      {pinnedNotes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Pin className="size-5" />
            Épinglées
          </h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 @4xl/main:grid-cols-3 @6xl/main:grid-cols-4">
            {pinnedNotes.map(renderNoteCard)}
          </div>
        </div>
      )}

      {/* Unpinned Notes */}
      {unpinnedNotes.length > 0 && (
        <div>
          {pinnedNotes.length > 0 && (
            <h2 className="text-lg font-semibold mb-4">Autres notes</h2>
          )}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 @4xl/main:grid-cols-3 @6xl/main:grid-cols-4">
            {unpinnedNotes.map(renderNoteCard)}
          </div>
        </div>
      )}

      {/* Aucune note : animation au centre de la page ; recherche sans résultat : simple message */}
      {filteredNotes.length === 0 && (
        (state.notes || []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Lottie src="/animations/utilisees/Pensil Drawing.json" adaptive="ink" className="size-56 text-foreground sm:size-72" />
            <p className="font-medium">Aucune note pour l'instant</p>
            <p className="mt-1 text-sm text-muted-foreground">Capture tes idées, listes et brouillons</p>
            <Button className="mt-4" size="sm" onClick={() => setIsDialogOpen(true)}>
              <Plus className="size-4 mr-2" />
              Créer une note
            </Button>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">Aucune note ne correspond à « {searchQuery} »</p>
        )
      )}

      {/* Note Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) resetForm()
        setIsDialogOpen(open)
      }}>
        <DialogContent className="max-w-[90vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingNote ? "Modifier la note" : "Nouvelle note"}</DialogTitle>
            <DialogDescription>
              {editingNote
                ? "Modifiez le titre, la couleur ou épinglez cette note"
                : "Créez une nouvelle note. Vous pourrez ensuite cliquer dessus pour écrire le contenu."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                placeholder="Sans titre"
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
              />
            </div>

            <div>
              <Label>Couleur</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {NOTE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={cn(
                      "size-10 rounded-lg border-2 transition-all hover:scale-110",
                      newNote.color === color.value
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setNewNote({ ...newNote, color: color.value })}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="pinned"
                type="checkbox"
                checked={newNote.pinned}
                onChange={(e) => setNewNote({ ...newNote, pinned: e.target.checked })}
                className="size-4"
              />
              <Label htmlFor="pinned" className="cursor-pointer">
                Épingler cette note
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Annuler
            </Button>
            <Button onClick={handleSaveNote}>
              {editingNote ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Éditeur plein écran, rendu dans <body> : la zone de contenu de l'app (conteneur CSS) le limiterait sinon à sa taille */}
      {currentNote && createPortal(
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="border-b px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 bg-background">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={closeNoteEditor}
                title="Retour (sauvegarde automatique)"
              >
                <ArrowLeft className="size-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold truncate">{currentNote.title}</h2>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {saveState === "saved" ? (
                    <>
                      <Check className="size-3" /> Enregistré
                    </>
                  ) : saveState === "saving" ? (
                    <>
                      <Loader2 className="size-3 animate-spin" /> Enregistrement…
                    </>
                  ) : (
                    "Modifications non enregistrées"
                  )}
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="size-4 sm:mr-2" />
                  <span className="hidden sm:inline">Exporter</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => printNote(currentNote.title, editorRef.current?.getHTML() ?? latestHtml.current)}>
                  <Printer className="size-4" />
                  Imprimer / PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToWord(currentNote.title, editorRef.current?.getHTML() ?? latestHtml.current)}>
                  <FileDown className="size-4" />
                  Document Word (.doc)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <NoteEditor
            key={currentNote.id}
            noteId={currentNote.id}
            initialHtml={sanitizeNoteHtml(currentNote.content)}
            onChange={handleEditorChange}
            onReady={onEditorReady}
          />
        </div>,
        document.body
      )}
    </div>
  )
}
