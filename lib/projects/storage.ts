// Fichiers joints aux projets et tâches, rangés sur le disque du serveur.
// En Docker, UPLOAD_DIR est un volume (/app/uploads) pour survivre aux reconstructions de l'image.

import { randomUUID } from "crypto"
import { mkdir, readFile, unlink, writeFile } from "fs/promises"
import path from "path"

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_USER_STORAGE_BYTES = 500 * 1024 * 1024

const uploadDir = () => process.env.UPLOAD_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads")

// Clé générée par le serveur uniquement : jamais de chemin construit à partir d'une saisie.
// Les accès disque portent "turbopackIgnore" : ces fichiers arrivent à l'exécution, le build ne doit pas les suivre
const SAFE_KEY = /^[0-9a-f-]{36}$/

function filePath(storageKey: string): string {
  if (!SAFE_KEY.test(storageKey)) throw new Error("Invalid storage key")
  return path.join(/*turbopackIgnore: true*/ uploadDir(), storageKey)
}

export async function storeFile(data: Buffer): Promise<string> {
  const storageKey = randomUUID()
  await mkdir(/*turbopackIgnore: true*/ uploadDir(), { recursive: true })
  await writeFile(/*turbopackIgnore: true*/ filePath(storageKey), data)
  return storageKey
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  return readFile(/*turbopackIgnore: true*/ filePath(storageKey))
}

export async function removeStoredFiles(storageKeys: string[]) {
  await Promise.all(
    storageKeys.map((key) =>
      unlink(/*turbopackIgnore: true*/ filePath(key)).catch(() => {
        /* déjà absent */
      })
    )
  )
}

// Types affichés directement dans le navigateur ; tout le reste est téléchargé
// (un SVG ou un HTML ouvert sur le domaine de l'app pourrait exécuter du code)
export const INLINE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain"])
