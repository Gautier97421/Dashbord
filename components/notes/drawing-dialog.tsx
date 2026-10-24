"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Eraser, Highlighter, Loader2, PenLine, Redo2, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

type Tool = "pen" | "highlighter" | "eraser"

const COLORS = ["#111827", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#2563eb", "#7c3aed", "#db2777", "#ffffff"]
const MAX_HISTORY = 40

/**
 * Zone de dessin à la souris, au doigt ou au stylet (pression prise en compte). Le dessin est rendu
 * en PNG puis inséré dans la note comme une image.
 */
export function DrawingDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; onSave: (file: File) => Promise<void> | void }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<{ x: number; y: number; midX: number; midY: number } | null>(null)
  const history = useRef<ImageData[]>([])
  const future = useRef<ImageData[]>([])
  const [tool, setTool] = useState<Tool>("pen")
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(4)
  const [whiteBackground, setWhiteBackground] = useState(true)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)

  // Taille du dessin = taille de la zone à l'ouverture, en pixels réels de l'écran (net sur mobile)
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const { width, height } = wrapper.getBoundingClientRect()
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    history.current = []
    future.current = []
    setCanUndo(false)
    setCanRedo(false)
    setIsEmpty(true)
  }, [])

  useEffect(() => {
    if (!open) return
    // Après l'animation d'ouverture : la zone a sa taille définitive
    const timer = setTimeout(setupCanvas, 220)
    return () => clearTimeout(timer)
  }, [open, setupCanvas])

  const ctx = () => canvasRef.current?.getContext("2d") ?? null

  const snapshot = () => {
    const c = canvasRef.current
    const context = ctx()
    if (!c || !context) return
    history.current.push(context.getImageData(0, 0, c.width, c.height))
    if (history.current.length > MAX_HISTORY) history.current.shift()
    future.current = []
    setCanUndo(true)
    setCanRedo(false)
  }

  const restore = (from: React.MutableRefObject<ImageData[]>, to: React.MutableRefObject<ImageData[]>) => {
    const c = canvasRef.current
    const context = ctx()
    const image = from.current.pop()
    if (!c || !context || !image) return
    to.current.push(context.getImageData(0, 0, c.width, c.height))
    context.putImageData(image, 0, 0)
    setCanUndo(history.current.length > 0)
    setCanRedo(future.current.length > 0)
  }

  const point = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const lineWidth = (e: React.PointerEvent) => {
    const base = tool === "highlighter" ? size * 4 : tool === "eraser" ? size * 3 : size
    // Stylet : le trait suit la pression (souris et doigt envoient 0,5)
    return e.pointerType === "pen" && e.pressure > 0 ? base * (0.4 + e.pressure * 1.2) : base
  }

  const applyStyle = (context: CanvasRenderingContext2D, e: React.PointerEvent) => {
    context.globalCompositeOperation = tool === "eraser" ? "destination-out" : tool === "highlighter" ? "multiply" : "source-over"
    context.globalAlpha = tool === "highlighter" ? 0.35 : 1
    context.strokeStyle = tool === "eraser" ? "#000" : color
    context.fillStyle = context.strokeStyle
    context.lineWidth = lineWidth(e)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const context = ctx()
    if (!context || (e.pointerType === "mouse" && e.button !== 0)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    snapshot()
    const { x, y } = point(e)
    applyStyle(context, e)
    // Un simple appui laisse un point
    context.beginPath()
    context.arc(x, y, context.lineWidth / 2, 0, Math.PI * 2)
    context.fill()
    drawing.current = { x, y, midX: x, midY: y }
    setIsEmpty(false)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const context = ctx()
    const last = drawing.current
    if (!context || !last) return
    // Points intermédiaires reçus entre deux images : trait plus fluide
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent]
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const rect = canvasRef.current!.getBoundingClientRect()
      const x = ev.clientX - rect.left
      const y = ev.clientY - rect.top
      const midX = (last.x + x) / 2
      const midY = (last.y + y) / 2
      applyStyle(context, e)
      // Courbe passant par les milieux : pas d'angles entre les points
      context.beginPath()
      context.moveTo(last.midX, last.midY)
      context.quadraticCurveTo(last.x, last.y, midX, midY)
      context.stroke()
      Object.assign(last, { x, y, midX, midY })
    }
  }

  const onPointerUp = () => {
    drawing.current = null
  }

  const clear = () => {
    const c = canvasRef.current
    const context = ctx()
    if (!c || !context) return
    snapshot()
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, c.width, c.height)
    context.restore()
    setIsEmpty(true)
  }

  const save = async () => {
    const c = canvasRef.current
    if (!c) return
    setSaving(true)
    try {
      // Fond blanc ajouté à l'export (le dessin reste lisible en mode sombre)
      const out = document.createElement("canvas")
      out.width = c.width
      out.height = c.height
      const outCtx = out.getContext("2d")
      if (!outCtx) return
      if (whiteBackground) {
        outCtx.fillStyle = "#ffffff"
        outCtx.fillRect(0, 0, out.width, out.height)
      }
      outCtx.drawImage(c, 0, 0)
      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"))
      if (!blob) return
      await onSave(new File([blob], `dessin-${Date.now()}.png`, { type: "image/png" }))
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-none w-screen max-w-none flex-col gap-2 rounded-none p-2 sm:h-[90vh] sm:w-[95vw] sm:max-w-6xl sm:rounded-lg sm:p-4">
        <DialogHeader className="pr-8">
          <DialogTitle>Dessin</DialogTitle>
          <DialogDescription className="hidden sm:block">Dessine à la souris, au doigt ou au stylet. Le dessin est ajouté à la note comme une image.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" variant="outline" size="sm" value={tool} onValueChange={(v) => v && setTool(v as Tool)} aria-label="Outil">
            <ToggleGroupItem value="pen" aria-label="Stylo" title="Stylo">
              <PenLine className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="highlighter" aria-label="Surligneur" title="Surligneur">
              <Highlighter className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="eraser" aria-label="Gomme" title="Gomme">
              <Eraser className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex flex-wrap items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c)
                  if (tool === "eraser") setTool("pen")
                }}
                className={cn("size-6 rounded-full border transition-transform hover:scale-110", color === c && tool !== "eraser" && "ring-2 ring-primary ring-offset-1")}
                style={{ backgroundColor: c }}
                aria-label={`Couleur ${c}`}
              />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-6 cursor-pointer rounded-full border bg-transparent" aria-label="Autre couleur" />
          </div>

          <div className="flex w-36 items-center gap-2">
            <span className="text-xs text-muted-foreground">Taille</span>
            <Slider value={[size]} min={1} max={30} step={1} onValueChange={([v]) => setSize(v)} aria-label="Épaisseur du trait" />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => restore(history, future)} disabled={!canUndo} aria-label="Annuler" title="Annuler">
              <Undo2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => restore(future, history)} disabled={!canRedo} aria-label="Rétablir" title="Rétablir">
              <Redo2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={clear} disabled={isEmpty} aria-label="Tout effacer" title="Tout effacer">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div ref={wrapperRef} className={cn("relative min-h-0 flex-1 overflow-hidden rounded-lg border", whiteBackground ? "bg-white" : "bg-muted/30")}>
          <canvas
            ref={canvasRef}
            // Le doigt dessine au lieu de faire défiler la page
            className={cn("absolute inset-0 touch-none", tool === "eraser" ? "cursor-cell" : "cursor-crosshair")}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Switch checked={whiteBackground} onCheckedChange={setWhiteBackground} />
            Fond blanc
          </Label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={save} disabled={isEmpty || saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Insérer dans la note
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
