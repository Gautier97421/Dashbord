"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  MoreHorizontal,
  Trash2,
  Edit,
  Pin,
  PinOff,
  StickyNote,
  Search,
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Download,
  Type,
} from "lucide-react"
import { useApp } from "@/lib/store-api"
import { generateId, formatDateFr } from "@/lib/helpers"
import type { Note } from "@/lib/types"
import { cn } from "@/lib/utils"

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

export function NotesPage() {
  const { state, addNote, updateNote, deleteNote } = useApp()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [currentNote, setCurrentNote] = useState<Note | null>(null)
  const [noteContent, setNoteContent] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [newNote, setNewNote] = useState<Partial<Note>>({
    title: "",
    color: "#fef3c7",
    pinned: false,
  })
  const editorRef = useRef<HTMLDivElement>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const filteredNotes = useMemo(() => {
    if (!searchQuery) return state.notes || []
    const query = searchQuery.toLowerCase()
    return (state.notes || []).filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
    )
  }, [state.notes, searchQuery])

  const pinnedNotes = useMemo(() => {
    return filteredNotes.filter((n) => n.pinned)
  }, [filteredNotes])

  const unpinnedNotes = useMemo(() => {
    return filteredNotes.filter((n) => !n.pinned)
  }, [filteredNotes])

  const handleSaveNote = async () => {
    if (!newNote.title) return

    if (editingNote) {
      const updated = await updateNote({
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
    setCurrentNote(note)
    setNoteContent(note.content)
    setIsEditorOpen(true)
    // Initialiser le contenu une seule fois à l'ouverture
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = note.content || ""
        editorRef.current.focus()
      }
    }, 0)
  }

  const handleEditorInput = () => {
    if (editorRef.current && currentNote) {
      const newContent = editorRef.current.innerHTML
      setNoteContent(newContent)

      // Auto-save après 2 secondes d'inactivité
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
      autoSaveTimeoutRef.current = setTimeout(async () => {
        await updateNote({
          ...currentNote,
          content: newContent,
        })
      }, 2000)
    }
  }

  const closeNoteEditor = async () => {
    // Annuler le timeout en cours
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    
    // Sauvegarder une dernière fois si nécessaire
    if (currentNote && editorRef.current) {
      const finalContent = editorRef.current.innerHTML
      if (finalContent !== currentNote.content) {
        await updateNote({
          ...currentNote,
          content: finalContent,
        })
      }
    }
    
    setIsEditorOpen(false)
    setCurrentNote(null)
    setNoteContent("")
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  const exportToPDF = async () => {
    if (!currentNote || !editorRef.current) return

    try {
      // Dynamically import jsPDF
      const { jsPDF } = await import('jspdf')
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Configuration
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      const maxWidth = pageWidth - 2 * margin
      let yPosition = margin
      const lineHeight = 7
      const fontSize = 12

      // Fonction pour vérifier si nouvelle page nécessaire
      const checkNewPage = (extraSpace = 0) => {
        if (yPosition + lineHeight + extraSpace > pageHeight - margin) {
          doc.addPage()
          yPosition = margin
        }
      }

      // Fonction pour parser et rendre le HTML avec formatage
      const renderFormattedContent = (element: Element | ChildNode) => {
        const children = element.childNodes

        children.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            // Noeud texte simple
            const text = node.textContent || ''
            if (text.trim()) {
              doc.setFontSize(fontSize)
              const lines = doc.splitTextToSize(text, maxWidth)
              lines.forEach((line: string) => {
                checkNewPage()
                doc.text(line, margin, yPosition)
                yPosition += lineHeight
              })
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement
            const tagName = el.tagName.toLowerCase()

            // Gestion des retours à la ligne
            if (tagName === 'br') {
              yPosition += lineHeight * 0.5
              return
            }

            // Gestion des paragraphes et divs
            if (tagName === 'p' || tagName === 'div') {
              // Ajouter un espace avant le paragraphe
              if (yPosition > margin + 20) {
                yPosition += lineHeight * 0.3
              }
              
              // Détecter l'alignement
              const style = el.getAttribute('style') || ''
              let align: 'left' | 'center' | 'right' = 'left'
              if (style.includes('text-align: center') || style.includes('text-align:center')) {
                align = 'center'
              } else if (style.includes('text-align: right') || style.includes('text-align:right')) {
                align = 'right'
              }
              
              // Traiter le contenu du paragraphe avec formatage inline
              renderInlineContent(el, align)
              
              // Espace après le paragraphe
              yPosition += lineHeight * 0.3
              return
            }

            // Récursion pour autres éléments
            renderFormattedContent(node)
          }
        })
      }

      // Fonction pour gérer le contenu inline (bold, italic, underline, alignment)
      const renderInlineContent = (element: HTMLElement, textAlign: 'left' | 'center' | 'right' = 'left') => {
        let currentX = margin
        const lineContent: Array<{text: string, bold: boolean, italic: boolean, underline: boolean}> = []
        
        // Collecter tout le contenu avec ses styles
        const collectContent = (el: Element | ChildNode, styles: {bold: boolean, italic: boolean, underline: boolean}) => {
          el.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent || ''
              if (text) {
                lineContent.push({
                  text,
                  bold: styles.bold,
                  italic: styles.italic,
                  underline: styles.underline
                })
              }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              const childEl = node as HTMLElement
              const tag = childEl.tagName.toLowerCase()
              const newStyles = {
                bold: styles.bold || tag === 'b' || tag === 'strong',
                italic: styles.italic || tag === 'i' || tag === 'em',
                underline: styles.underline || tag === 'u'
              }
              
              if (tag === 'br') {
                lineContent.push({text: '\n', bold: false, italic: false, underline: false})
              } else {
                collectContent(childEl, newStyles)
              }
            }
          })
        }

        collectContent(element, {bold: false, italic: false, underline: false})

        // Rendre le contenu collecté
        let currentLine = ''
        let currentStyles: Array<{text: string, bold: boolean, italic: boolean, underline: boolean}> = []

        const flushLine = () => {
          if (currentStyles.length === 0) return
          
          checkNewPage()
          
          // Calculer la largeur totale de la ligne
          let totalLineWidth = 0
          currentStyles.forEach((segment) => {
            let fontStyle = 'normal'
            if (segment.bold && segment.italic) fontStyle = 'bolditalic'
            else if (segment.bold) fontStyle = 'bold'
            else if (segment.italic) fontStyle = 'italic'
            doc.setFont('helvetica', fontStyle)
            doc.setFontSize(fontSize)
            totalLineWidth += doc.getTextWidth(segment.text)
          })
          
          // Calculer la position X en fonction de l'alignement
          if (textAlign === 'center') {
            currentX = margin + (maxWidth - totalLineWidth) / 2
          } else if (textAlign === 'right') {
            currentX = margin + maxWidth - totalLineWidth
          } else {
            currentX = margin
          }
          
          currentStyles.forEach((segment) => {
            // Définir le style de police
            let fontStyle = 'normal'
            if (segment.bold && segment.italic) {
              fontStyle = 'bolditalic'
            } else if (segment.bold) {
              fontStyle = 'bold'
            } else if (segment.italic) {
              fontStyle = 'italic'
            }
            
            doc.setFontSize(fontSize)
            doc.setFont('helvetica', fontStyle)
            
            const textWidth = doc.getTextWidth(segment.text)
            doc.text(segment.text, currentX, yPosition)
            
            // Dessiner le soulignement
            if (segment.underline) {
              doc.setLineWidth(0.3)
              doc.line(currentX, yPosition + 1, currentX + textWidth, yPosition + 1)
            }
            
            currentX += textWidth
          })
          
          yPosition += lineHeight
          currentStyles = []
        }

        // Traiter chaque segment
        lineContent.forEach((segment) => {
          if (segment.text === '\n') {
            flushLine()
            return
          }

          // Calculer si le texte rentre sur la ligne actuelle
          doc.setFontSize(fontSize)
          const words = segment.text.split(' ')
          
          words.forEach((word, idx) => {
            const wordWithSpace = idx < words.length - 1 ? word + ' ' : word
            const wordWidth = doc.getTextWidth(wordWithSpace)
            const currentLineWidth = currentStyles.reduce((acc, s) => acc + doc.getTextWidth(s.text), 0)
            
            if (currentLineWidth + wordWidth > maxWidth && currentStyles.length > 0) {
              flushLine()
            }
            
            currentStyles.push({
              text: wordWithSpace,
              bold: segment.bold,
              italic: segment.italic,
              underline: segment.underline
            })
          })
        })

        // Flush le reste
        flushLine()
      }

      // Créer un élément temporaire pour parser le HTML
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = editorRef.current.innerHTML

      // Rendre le contenu formaté
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', 'normal')
      renderFormattedContent(tempDiv)

      // Télécharger le PDF
      const fileName = `${currentNote.title.replace(/[^a-z0-9]/gi, '_')}.pdf`
      doc.save(fileName)
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error)
      alert('Erreur lors de la création du PDF')
    }
  }

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
      className="group relative overflow-hidden transition-all hover:shadow-lg cursor-pointer"
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
              <Button variant="ghost" size="icon" className="size-8 bg-background/80">
                <MoreHorizontal className="size-4" />
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
          <Pin className="absolute top-2 left-2 size-4 text-muted-foreground" />
        )}

        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2 pr-16">
            {note.title}
          </h3>
          <div 
            className="text-sm text-muted-foreground line-clamp-6"
            dangerouslySetInnerHTML={{ 
              __html: note.content || "<em>Aucun contenu</em>" 
            }}
          />
        </div>

        <div className="text-xs text-muted-foreground mt-4">
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

        <Button onClick={() => setIsDialogOpen(true)} size="sm" className="sm:size-default w-full sm:w-auto">
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {unpinnedNotes.map(renderNoteCard)}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredNotes.length === 0 && (
        <div className="grid gap-4 grid-cols-1">
          <Card className="border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => setIsDialogOpen(true)}>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <StickyNote className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Note rapide</p>
              <p className="text-xs text-muted-foreground mt-1">Capturez vos idées</p>
              <Button className="mt-4" size="sm">
                <Plus className="size-4 mr-2" />
                Créer
              </Button>
            </CardContent>
          </Card>
        </div>
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

      {/* Note Editor Full Screen */}
      {isEditorOpen && currentNote && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="border-b px-4 py-3 flex items-center justify-between gap-4 bg-background">
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
                <p className="text-xs text-muted-foreground">
                  Dernière modification : {formatDateFr(currentNote.updatedAt, "short")}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPDF}
            >
              <Download className="size-4 mr-2" />
              Export PDF
            </Button>
          </div>

          {/* Toolbar */}
          <div className="border-b px-4 py-2 flex items-center gap-1 bg-background flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => execCommand('bold')}
              title="Gras (Ctrl+B)"
            >
              <Bold className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => execCommand('italic')}
              title="Italique (Ctrl+I)"
            >
              <Italic className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => execCommand('underline')}
              title="Souligné (Ctrl+U)"
            >
              <Underline className="size-4" />
            </Button>
            
            <div className="w-px h-6 bg-border mx-1" />
            
            <select
              className="text-sm border rounded px-2 py-1"
              onChange={(e) => execCommand('fontSize', e.target.value)}
              defaultValue="3"
            >
              <option value="1">Petit</option>
              <option value="3">Normal</option>
              <option value="5">Grand</option>
              <option value="7">Très grand</option>
            </select>

            <div className="w-px h-6 bg-border mx-1" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => execCommand('justifyLeft')}
              title="Aligner à gauche"
            >
              <AlignLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => execCommand('justifyCenter')}
              title="Centrer"
            >
              <AlignCenter className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => execCommand('justifyRight')}
              title="Aligner à droite"
            >
              <AlignRight className="size-4" />
            </Button>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-auto bg-[#f8f1e3] dark:bg-[#1a1a1a]">
            <div className="max-w-4xl mx-auto p-6 sm:p-8">
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                className="min-h-[calc(100vh-240px)] shadow-lg rounded p-8 focus:outline-none text-base leading-relaxed bg-[#fffef5] dark:bg-[#242424] dark:text-gray-100"
                style={{
                  fontSize: '16px',
                  lineHeight: '1.75',
                }}
                suppressContentEditableWarning
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
