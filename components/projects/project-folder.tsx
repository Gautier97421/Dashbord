"use client"

import { useEffect, useState } from "react"
import { Code2, FolderOpen, FolderSymlink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useApp } from "@/lib/store-api"
import { cn } from "@/lib/utils"
import { folderName, isFolderHandlerEnabled, linkKind, normalizeLinkInput, projectFolder, vscodeHref } from "@/lib/project-links"
import type { Project } from "@/lib/types"
import { makeLink, useFolderActions } from "./resource-links"

/** Ouvre le dossier lié au projet dans l'Explorateur ; rien si le projet n'a pas de dossier. */
export function ProjectFolderButton({ project, className }: { project: Project; className?: string }) {
  const { openInExplorer } = useFolderActions()
  const folder = projectFolder(project.links)
  if (!folder) return null
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-7 shrink-0 text-muted-foreground hover:text-foreground", className)}
      onClick={(e) => {
        e.stopPropagation()
        openInExplorer(folder)
      }}
      title={`Ouvrir le dossier : ${folder}`}
      aria-label={`Ouvrir le dossier de ${project.title}`}
    >
      <FolderOpen className="size-4" />
    </Button>
  )
}

/** Boutons du détail d'un projet : ouvrir son dossier (Explorateur, VS Code), ou en lier un. */
export function ProjectFolderActions({ project }: { project: Project }) {
  const { openInExplorer } = useFolderActions()
  const [linking, setLinking] = useState(false)
  const folder = projectFolder(project.links)

  return (
    <>
      {folder ? (
        <div className="flex shrink-0 items-center rounded-md border">
          <Button variant="ghost" size="sm" className="rounded-r-none" onClick={() => openInExplorer(folder)} title={folder}>
            <FolderOpen className="size-4" />
            <span className="hidden sm:inline">Dossier</span>
          </Button>
          <Button asChild variant="ghost" size="icon" className="size-8 rounded-l-none border-l">
            <a href={vscodeHref(folder)} title="Ouvrir dans VS Code" aria-label="Ouvrir le dossier dans VS Code">
              <Code2 className="size-4" />
            </a>
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setLinking(true)}>
          <FolderSymlink className="size-4" />
          <span className="hidden sm:inline">Lier un dossier</span>
        </Button>
      )}
      <LinkFolderDialog project={project} open={linking} onOpenChange={setLinking} />
    </>
  )
}

/** Lie un dossier de l'ordinateur au projet (il rejoint ses liens, dans l'onglet Ressources). */
export function LinkFolderDialog({ project, open, onOpenChange }: { project: Project; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { updateProject } = useApp()
  const { toast } = useToast()
  const [path, setPath] = useState("")
  const clean = normalizeLinkInput(path)
  const valid = !!clean && linkKind(clean) === "folder"

  useEffect(() => {
    if (open) setPath("")
  }, [open])

  const save = async () => {
    if (!valid) return
    try {
      await updateProject({ ...project, links: [...(project.links || []), makeLink(clean)] })
      onOpenChange(false)
      toast({
        title: "Dossier lié",
        description: isFolderHandlerEnabled()
          ? `« ${folderName(clean)} » s'ouvre maintenant depuis le projet.`
          : "Pour l'ouvrir dans l'Explorateur, active une fois « Ouvrir les dossiers de projets » dans Paramètres.",
      })
    } catch {
      toast({ title: "Dossier non lié", variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lier un dossier de l&apos;ordinateur</DialogTitle>
          <DialogDescription>Le dossier de « {project.title} » s&apos;ouvrira d&apos;un clic depuis le projet (Explorateur ou VS Code).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 rounded-lg bg-muted/50 p-3 pl-7 text-sm text-muted-foreground">
            <li>Dans l&apos;Explorateur, fais <strong className="text-foreground">Maj + clic droit</strong> sur le dossier</li>
            <li>Choisis <strong className="text-foreground">« Copier en tant que chemin d&apos;accès »</strong></li>
            <li>Colle le chemin ci-dessous</li>
          </ol>
          <div className="space-y-1.5">
            <Label htmlFor="folder-path">Chemin du dossier</Label>
            <Input
              id="folder-path"
              autoFocus
              placeholder="C:\Users\…\mon-projet"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}
            />
            {path && !valid && <p className="text-xs text-destructive">Ce n&apos;est pas un chemin de dossier (ex. C:\Users\toi\Documents\projet).</p>}
            {valid && <p className="text-xs text-muted-foreground">Dossier « {folderName(clean)} »</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={!valid}>
            Lier le dossier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
