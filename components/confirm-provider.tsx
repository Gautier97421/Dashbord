"use client"

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  // Bouton rouge (suppression)
  destructive?: boolean
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>

// Hors du fournisseur (ne devrait pas arriver) : confirmation native du navigateur
const ConfirmContext = createContext<Confirm>(async (o) => window.confirm(o.description ? `${o.title}\n\n${o.description}` : o.title))

/** Demande de confirmation avant une action (suppression…) : `if (await confirm({ title })) …` */
export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback<Confirm>((next) => {
    // Une demande encore ouverte est considérée comme refusée
    resolver.current?.(false)
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!options} onOpenChange={(open) => !open && close(false)}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            {options?.description && <AlertDialogDescription>{options.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={options?.destructive === false ? undefined : "bg-destructive text-white hover:bg-destructive/90"}
              onClick={() => close(true)}
            >
              {options?.confirmLabel || "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}
