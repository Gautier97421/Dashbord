"use client"

import { useState } from "react"
import { Code2, Copy, Folder, FolderOpen, Globe, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeleteButton } from "@/components/delete-button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { generateId } from "@/lib/helpers"
import { explorerHref, folderName, isFolderHandlerEnabled, linkKind, localPath, normalizeLinkInput, vscodeHref, webHref } from "@/lib/project-links"
import type { ProjectLink } from "@/lib/types"

/** Ouverture d'un dossier local dans l'Explorateur Windows, et copie de son chemin. */
export function useFolderActions() {
  const { toast } = useToast()

  // Sans l'installation (Paramètres), le navigateur ignorerait le lien sans rien afficher
  const openInExplorer = (path: string) => {
    if (!isFolderHandlerEnabled()) {
      toast({
        title: "Ouverture dans l'Explorateur non activée",
        description: "Active-la une fois dans Paramètres → « Ouvrir les dossiers de projets ». En attendant : VS Code ou copier le chemin.",
      })
      return
    }
    window.location.href = explorerHref(path)
  }

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path)
      toast({ title: "Chemin copié", description: "Colle-le dans la barre d'adresse de l'Explorateur." })
    } catch {
      toast({ title: "Copie impossible", description: path, variant: "destructive" })
    }
  }

  return { openInExplorer, copyPath }
}

/** Nouveau lien saisi : guillemets retirés, et nom du dossier comme libellé par défaut. */
export function makeLink(url: string, label?: string): ProjectLink {
  const clean = normalizeLinkInput(url)
  return { id: generateId(), label: label?.trim() || (linkKind(clean) === "folder" ? folderName(clean) : clean), url: clean }
}

// Liens d'un projet ou d'une tâche : sites web, et dossiers locaux (Explorateur, VS Code, copie du chemin)
export function ResourceLinks({
  links,
  onChange,
  emptyText = "Aucun lien.",
}: {
  links: ProjectLink[]
  // Absent : lecture seule
  onChange?: (links: ProjectLink[]) => void
  emptyText?: string
}) {
  const [label, setLabel] = useState("")
  const [url, setUrl] = useState("")
  const { openInExplorer, copyPath } = useFolderActions()

  const add = () => {
    if (!normalizeLinkInput(url) || !onChange) return
    onChange([...links, makeLink(url, label)])
    setLabel("")
    setUrl("")
  }

  const removeButton = (link: ProjectLink) =>
    onChange && (
      <DeleteButton
        label="Supprimer le lien"
        onDelete={() => onChange(links.filter((l) => l.id !== link.id))}
        confirm={{ title: `Supprimer le lien « ${link.label} » ?`, description: link.url }}
      />
    )

  return (
    <div className="space-y-2">
      {links.length === 0 && !onChange && <p className="text-sm text-muted-foreground">{emptyText}</p>}
      {links.map((link) => {
        if (linkKind(link.url) === "web") {
          return (
            <div key={link.id} className="flex items-center gap-2 rounded-lg border p-2">
              <a href={webHref(link.url)} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
                <Globe className="size-4 shrink-0 text-primary" />
                <span className="shrink-0 text-sm font-medium">{link.label}</span>
                <span className="truncate text-xs text-muted-foreground">{link.url}</span>
              </a>
              {removeButton(link)}
            </div>
          )
        }
        const path = localPath(link.url)
        return (
          <div key={link.id} className="flex items-center gap-2 rounded-lg border p-2">
            <Folder className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{link.label}</p>
              <p className="truncate text-xs text-muted-foreground" title={path}>{path}</p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button variant="ghost" size="icon" className="size-8" onClick={() => openInExplorer(path)} title="Ouvrir dans l'Explorateur" aria-label={`Ouvrir ${link.label} dans l'Explorateur`}>
                <FolderOpen className="size-4" />
              </Button>
              <Button asChild variant="ghost" size="icon" className="size-8">
                <a href={vscodeHref(path)} title="Ouvrir dans VS Code" aria-label={`Ouvrir ${link.label} dans VS Code`}>
                  <Code2 className="size-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => copyPath(path)} title="Copier le chemin" aria-label={`Copier le chemin de ${link.label}`}>
                <Copy className="size-4" />
              </Button>
              {removeButton(link)}
            </div>
          </div>
        )
      })}

      {onChange && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="Nom (ex : Doc)" value={label} onChange={(e) => setLabel(e.target.value)} className="sm:w-32" />
          <div className="flex flex-1 gap-2">
            <Input
              placeholder="https://… ou C:\Users\…\dossier"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            />
            <Button type="button" variant="outline" size="icon" onClick={add} disabled={!url.trim()} aria-label="Ajouter le lien">
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
