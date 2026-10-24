"use client"

import { Lottie } from "@/components/lottie"
import { cn } from "@/lib/utils"

// Cloche de public/No Notification.json : un PNG (cloche jaune, visage triste) qui se balance.
// Le texte "No Notifications" de l'animation est retiré, le visage est agrandi, et la version
// "contente" retourne la bouche (la moue devient un sourire).

const FACE_ZOOM = 1.4

const withoutText = (data: any) => {
  data.layers = data.layers.filter((l: any) => l.ty !== 5)
  delete data.fonts
  delete data.chars
  return data
}

type Box = { x: number; y: number; w: number; h: number }

// Éléments sombres du visage (yeux, bouche), chacun dans son rectangle, de haut en bas
function findFeatures(px: Uint8ClampedArray, w: number, h: number): Box[] {
  const dark = (x: number, y: number) => {
    const i = (y * w + x) * 4
    return px[i + 3] > 128 && px[i] + px[i + 1] + px[i + 2] < 300
  }
  const rows: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dark(x, y)) {
        rows.push(y)
        break
      }
    }
  }
  const bands: number[][] = []
  for (const y of rows) {
    const last = bands.at(-1)
    if (last && y - last[last.length - 1] <= 1) last.push(y)
    else bands.push([y])
  }
  const boxes: Box[] = []
  for (const band of bands) {
    const y0 = band[0]
    const y1 = band[band.length - 1]
    // Dans une bande (ex. les deux yeux), un rectangle par élément séparé horizontalement
    const cols: number[] = []
    for (let x = 0; x < w; x++) {
      for (let y = y0; y <= y1; y++) {
        if (dark(x, y)) {
          cols.push(x)
          break
        }
      }
    }
    let start = cols[0]
    for (let i = 1; i <= cols.length; i++) {
      if (i === cols.length || cols[i] - cols[i - 1] > 1) {
        boxes.push({ x: start, y: y0, w: cols[i - 1] - start + 1, h: y1 - y0 + 1 })
        start = cols[i]
      }
    }
  }
  return boxes
}

async function redrawFace(dataUrl: string, happy: boolean): Promise<string> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const canvas = document.createElement("canvas")
  const w = (canvas.width = img.naturalWidth)
  const h = (canvas.height = img.naturalHeight)
  const ctx = canvas.getContext("2d")
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0)
  const boxes = findFeatures(ctx.getImageData(0, 0, w, h).data, w, h)
  if (boxes.length < 2) return dataUrl
  const mouth = boxes[boxes.length - 1]

  for (const box of boxes) {
    // Une marge de 2 pixels garde l'anticrénelage et recouvre l'élément d'origine une fois agrandi
    const bx = Math.max(0, box.x - 2)
    const by = Math.max(0, box.y - 2)
    const bw = Math.min(w, box.x + box.w + 2) - bx
    const bh = Math.min(h, box.y + box.h + 2) - by
    const part = document.createElement("canvas")
    part.width = bw
    part.height = bh
    const partCtx = part.getContext("2d")
    if (!partCtx) continue
    if (happy && box === mouth) {
      partCtx.translate(0, bh)
      partCtx.scale(1, -1)
    }
    partCtx.drawImage(canvas, bx, by, bw, bh, 0, 0, bw, bh)
    const cx = bx + bw / 2
    const cy = by + bh / 2
    ctx.drawImage(part, cx - (bw * FACE_ZOOM) / 2, cy - (bh * FACE_ZOOM) / 2, bw * FACE_ZOOM, bh * FACE_ZOOM)
  }
  return canvas.toDataURL("image/png")
}

const faces = new Map<string, Promise<string>>()

const bellVariant = (happy: boolean) => async (data: any) => {
  withoutText(data)
  const asset = data.assets?.find((a: any) => typeof a.p === "string" && a.p.startsWith("data:image"))
  if (asset) {
    const key = happy ? "happy" : "sad"
    if (!faces.has(key)) faces.set(key, redrawFace(asset.p, happy).catch(() => asset.p))
    asset.p = await faces.get(key)!
  }
  return data
}
const sadBell = bellVariant(false)
const happyBell = bellVariant(true)

/** Cloche de l'en-tête : triste sans notification, contente sinon, qui se balance en continu. */
export function BellAnimation({ happy, className }: { happy: boolean; className?: string }) {
  return (
    <Lottie
      src="/animations/utilisees/No Notification.json"
      mode="loop"
      zoom={3.8}
      transform={happy ? happyBell : sadBell}
      transformKey={happy ? "happy" : "sad"}
      // Contour discret : la cloche jaune reste visible sur le fond clair
      className={cn("size-7 [filter:drop-shadow(0_0_0.6px_rgb(120_80_0/0.9))_drop-shadow(0_1px_1px_rgb(0_0_0/0.2))] dark:[filter:none]", className)}
    />
  )
}
