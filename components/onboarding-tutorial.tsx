"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CheckCircle2, ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

// Visite guidée : on assombrit la page sauf l'élément à montrer (attribut data-tour), avec des
// flèches autour. Un clic sur l'élément l'active vraiment : s'il ouvre une fenêtre, le tuto
// explique ce qu'elle contient puis demande de la refermer pour continuer.

interface TourSubStep {
  target: string
  title: string
  body: string
}

interface TourStep {
  page: string
  target?: string
  title: string
  body: string
  // false : l'élément n'a rien d'utile à essayer, un clic passe à la suite
  clickable?: boolean
  // Explications à l'intérieur de la fenêtre que le bouton ouvre
  inside?: TourSubStep[]
  // Texte demandant de refermer la fenêtre ouverte
  closeBody?: string
}

const TOUR_STEPS: TourStep[] = [
  {
    page: "dashboard",
    title: "Bienvenue sur DashLife 👋",
    body: "On va faire le tour de l'app ensemble, outil par outil. Les flèches te montrent où appuyer : essaie chaque bouton pour voir ce qu'il fait. Tu peux passer le tuto à tout moment.",
  },
  {
    page: "dashboard",
    target: "sidebar-trigger",
    title: "Le menu",
    body: "Ce bouton ouvre le menu pour passer d'un outil à l'autre : calendrier, objectifs, sport…",
    closeBody: "Voici le menu ! Referme-le (en appuyant à côté) pour continuer le tuto.",
  },
  {
    page: "dashboard",
    target: "dashboard-customize",
    title: "Personnalise ton tableau de bord",
    body: "Appuie sur « Personnaliser » : on va voir ensemble comment ça marche.",
    inside: [
      {
        target: "customize-separate-mobile",
        title: "Ordinateur et mobile",
        body: "Coche « Séparer la version mobile » pour avoir une disposition différente sur téléphone, puis passe de « Desktop » à « Mobile » pour modifier chacune.",
      },
      {
        target: "customize-widgets",
        title: "Les widgets",
        body: "Voici tous les widgets disponibles : routines, objectifs, projets, sport… Glisse-en un sur la grille pour l'ajouter.",
      },
      {
        target: "customize-grid",
        title: "La grille",
        body: "C'est ton tableau de bord en miniature. Glisse un widget pour le déplacer, tire ses bords pour l'agrandir, clique dessus pour le changer ou le supprimer. Tu peux aussi sélectionner des cases vides puis choisir un widget.",
      },
      {
        target: "customize-reset-clear",
        title: "Repartir de zéro",
        body: "« Réinitialiser » remet la disposition d'origine, « Tout effacer » vide la grille.",
      },
      {
        target: "customize-apply",
        title: "Enregistrer",
        body: "Quand ta disposition te plaît, appuie sur « Appliquer ». « Annuler » ferme sans rien changer.",
      },
    ],
    closeBody: "Ferme la fenêtre avec « Annuler » (ou « Appliquer » si tu as fait des changements) pour continuer le tuto.",
  },
  {
    page: "dashboard",
    target: "dashboard-reset",
    title: "Revenir à l'origine",
    body: "Envie de repartir de zéro ? Ce bouton remet le tableau de bord par défaut, après confirmation.",
    closeBody: "Appuie sur « Annuler » pour garder ta disposition et continuer le tuto.",
  },
  {
    page: "dashboard",
    target: "notifications",
    title: "Tes notifications",
    body: "La cloche t'avertit des rappels et des alertes importantes. Un badge = du nouveau.",
    closeBody: "Voici tes notifications. Referme la liste (en appuyant à côté) pour continuer le tuto.",
  },
  {
    page: "dashboard",
    target: "theme-toggle",
    title: "Clair ou sombre",
    body: "Change l'apparence de l'app en un clic.",
  },
  {
    page: "calendar",
    target: "calendar-views",
    title: "Ton calendrier",
    body: "Passe d'une vue à l'autre (jour, semaine, mois) pour organiser tes journées et ajouter tes événements.",
  },
  {
    page: "routine-morning",
    target: "routine-add",
    title: "Routine matinale",
    body: "« Ajouter une action » crée une habitude du matin : boire de l'eau, méditer, faire du sport…",
    closeBody: "C'est ici que tu décris ton habitude. Ferme la fenêtre pour continuer le tuto, tu la rempliras plus tard.",
  },
  {
    page: "routine-morning",
    target: "routine-tabs",
    title: "Suis ta régularité",
    body: "Le calendrier montre les jours où tu as tenu ta routine, les statistiques ta progression.",
  },
  {
    page: "routine-morning",
    target: "routine-switch",
    clickable: false,
    title: "Matin ou soir",
    body: "« Routine » regroupe tes deux routines : passe ici de « Matinale » à « Du soir ». Même principe le soir, pour bien préparer ta nuit.",
  },
  {
    page: "missions",
    target: "missions-add",
    title: "Tes objectifs",
    body: "« Nouvel objectif » crée un objectif à atteindre, découpé en sous-tâches.",
  },
  {
    page: "missions",
    target: "missions-tabs",
    title: "Jour, semaine, mois, année",
    body: "Range tes objectifs selon leur échéance et passe d'un onglet à l'autre.",
  },
  {
    page: "projects",
    target: "projects-add",
    title: "Tes projets",
    body: "Pour tes objectifs à long terme : un projet regroupe ses objectifs et ses tâches, et peut contenir des sous-projets (ex: « Dev » avec chacun de tes projets dev).",
  },
  {
    page: "sport",
    target: "sport-tabs",
    title: "Sport",
    body: "Enregistre tes entraînements, crée des programmes, suis tes records et ton profil sportif.",
  },
  {
    page: "nutrition",
    target: "nutrition-add",
    title: "Nutrition",
    body: "Le « + » ajoute un repas : saisis un plat ou reprends une recette de ta Cuisine avec ses macros.",
  },
  {
    page: "sleep",
    target: "sleep-tabs",
    title: "Sommeil",
    body: "Note tes heures de coucher et de réveil, calcule tes cycles pour te réveiller en forme et consulte tes stats.",
  },
  {
    page: "notes",
    target: "notes-add",
    title: "Bloc-notes",
    body: "« Nouvelle note » te permet de noter une idée en un instant.",
  },
  {
    page: "cuisine",
    target: "cuisine-add",
    title: "Cuisine",
    body: "Enregistre tes recettes et leurs ingrédients pour les retrouver facilement.",
  },
  {
    page: "applications",
    target: "applications-add",
    title: "Suivi de demande",
    body: "Garde une trace de tes candidatures et démarches : où tu as postulé et où en est chaque demande.",
  },
  {
    page: "budget",
    target: "budget-tabs",
    clickable: false,
    title: "Budgets",
    body: "Fixe un budget pour le mois ou la semaine, note tes dépenses, et retrouve tes abonnements (Netflix, Spotify…) dans l'onglet Abonnements.",
  },
  {
    page: "statistics",
    target: "statistics-header",
    clickable: false,
    title: "Statistiques",
    body: "Toute ta progression en un coup d'œil : routines, objectifs, sport et sommeil.",
  },
  {
    page: "ai-agent",
    target: "ai-agent-tabs",
    title: "Agent IA",
    body: "L'agent trie ta boîte mail tout seul. Dans « Automatisations », crée tes propres workflows, étape par étape.",
  },
  {
    page: "settings",
    target: "settings-install",
    title: "Installe l'app",
    body: "Ajoute DashLife sur ton écran d'accueil pour l'ouvrir comme une vraie application.",
  },
  {
    page: "settings",
    target: "settings-menu-order",
    title: "Organise ton menu",
    body: "Change l'ordre des outils dans le menu avec les flèches.",
  },
  {
    page: "settings",
    target: "settings-tour",
    clickable: false,
    title: "Revoir ce tutoriel",
    body: "Tu pourras relancer cette visite guidée à tout moment depuis ce bouton.",
  },
  {
    page: "dashboard",
    title: "C'est parti ! 🚀",
    body: "Tu connais maintenant tous les outils. Commence par personnaliser ton tableau de bord ou créer ta première routine.",
  },
]

const DEFAULT_CLOSE_BODY = "Voilà ce que fait ce bouton ! Ferme la fenêtre (croix ou « Annuler ») pour continuer le tuto."

// Site colours: --primary is the app's brown (light) / warm gold (dark)
const TOUR_CSS = `
@keyframes tourPulse {
  0% { box-shadow: 0 0 0 0 color-mix(in oklch, var(--primary) 70%, transparent) }
  100% { box-shadow: 0 0 0 16px color-mix(in oklch, var(--primary) 0%, transparent) }
}
`

const PAD = 8
const CARD_W = 340
const OVERLAY = "rgba(0, 0, 0, 0.65)"

// Radix layers (dialogs, alert dialogs, sheets, dropdown menus) expose data-state="open"
const OPEN_LAYER_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]'

function findOpenLayer(): HTMLElement | null {
  const layers = Array.from(document.querySelectorAll<HTMLElement>(OPEN_LAYER_SELECTOR))
  return layers[layers.length - 1] ?? null
}

function isOpenLayer(el: HTMLElement | null): boolean {
  return !!el && el.isConnected && el.getAttribute("data-state") === "open"
}

// First visible element carrying data-tour="target" (pages can render mobile + desktop variants)
function findTarget(target: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`))
  return (
    els.find((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }) ?? null
  )
}

// Visible part of an element: a long list inside a scrolling panel must not be spotlighted
// beyond that panel (it would cover the window's header), nor beyond the screen
function visibleRect(el: HTMLElement): DOMRect {
  const r = el.getBoundingClientRect()
  let left = r.left
  let top = r.top
  let right = r.right
  let bottom = r.bottom
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p)
    if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) {
      const pr = p.getBoundingClientRect()
      left = Math.max(left, pr.left)
      top = Math.max(top, pr.top)
      right = Math.min(right, pr.right)
      bottom = Math.min(bottom, pr.bottom)
    }
  }
  left = Math.max(left, 0)
  top = Math.max(top, 0)
  right = Math.min(right, window.innerWidth)
  bottom = Math.min(bottom, window.innerHeight)
  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top))
}

// Thin, long, slightly curved arrow drawn pointing right; its tip is at (TIP_X, TIP_Y)
const ARROW_W = 116
const ARROW_H = 44
const TIP_X = 110
const TIP_Y = 28
const ARROW_GAP = 10

interface ArrowSpec {
  tipX: number
  tipY: number
  rotate: number
  mirror: boolean
  scale: number
}

function TourArrow({ tipX, tipY, rotate, mirror, scale }: ArrowSpec) {
  return (
    <svg
      width={ARROW_W}
      height={ARROW_H}
      viewBox={`0 0 ${ARROW_W} ${ARROW_H}`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="absolute pointer-events-none overflow-visible"
      style={{
        left: tipX - TIP_X,
        top: tipY - TIP_Y,
        transformOrigin: `${TIP_X}px ${TIP_Y}px`,
        transform: `rotate(${rotate}deg) scaleX(${mirror ? -1 : 1}) scale(${scale})`,
      }}
    >
      <path d="M6 34 C 40 10, 80 10, 110 28" strokeWidth={3} style={{ stroke: "var(--primary)" }} />
      <path d="M103.2 15.8 L110 28 L96 27.8" strokeWidth={3} style={{ stroke: "var(--primary)" }} />
    </svg>
  )
}

// Shrink the arrow when space is tight, hide it when there is really no room
function arrowScale(room: number): number {
  const needed = ARROW_W + ARROW_GAP + 14
  if (room >= needed) return 1
  const scale = (room - ARROW_GAP - 14) / ARROW_W
  return scale >= 0.5 ? scale : 0
}

type Phase = "main" | "inside" | "close"

interface OnboardingTutorialProps {
  open: boolean
  onComplete: () => void
  onNavigate: (page: string) => void
  canNav: (page: string) => boolean
}

export function OnboardingTutorial({ open, onComplete, onNavigate, canNav }: OnboardingTutorialProps) {
  const steps = useMemo(() => TOUR_STEPS.filter((s) => canNav(s.page)), [canNav])
  const [index, setIndex] = useState(0)
  // main: the step's button · inside: explaining the window it opened · close: waiting for it to be closed
  const [phase, setPhase] = useState<Phase>("main")
  const [subIndex, setSubIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [searching, setSearching] = useState(false)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [cardH, setCardH] = useState(220)
  const cardRef = useRef<HTMLDivElement>(null)
  const navigateRef = useRef(onNavigate)
  const targetRef = useRef<HTMLElement | null>(null)
  const layerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    navigateRef.current = onNavigate
  }, [onNavigate])

  useEffect(() => {
    if (!open) return
    setIndex(0)
    setPhase("main")
    setSubIndex(0)
    layerRef.current = null
  }, [open])

  const step = steps[Math.min(index, steps.length - 1)]
  const isLast = index >= steps.length - 1
  const insideSteps = step?.inside ?? []

  const finish = () => {
    // Close anything the tour left open
    if (findOpenLayer()) document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    layerRef.current = null
    navigateRef.current("dashboard")
    onComplete()
  }

  const goNextMain = () => {
    layerRef.current = null
    setPhase("main")
    setSubIndex(0)
    if (isLast) finish()
    else setIndex((i) => i + 1)
  }

  const advanceInside = () => {
    if (phase !== "inside" || !isOpenLayer(layerRef.current)) return
    if (subIndex < insideSteps.length - 1) setSubIndex((s) => s + 1)
    else setPhase("close")
  }

  // Called after a real click on the spotlighted element
  const onTargetClick = () => {
    if (phase === "main") {
      setTimeout(() => {
        const layer = findOpenLayer()
        if (!layer) return handlers.current.goNextMain()
        layerRef.current = layer
        setSubIndex(0)
        setPhase(insideSteps.length ? "inside" : "close")
      }, 350)
    } else if (phase === "inside") {
      setTimeout(() => handlers.current.advanceInside(), 250)
    }
  }

  // DOM listeners and timers always call the latest handlers
  const handlers = useRef({ goNextMain, advanceInside, onTargetClick })
  handlers.current = { goNextMain, advanceInside, onTargetClick }

  const next = () => {
    if (phase === "inside") return advanceInside()
    // Steps that explain a window: open it for the user
    if (insideSteps.length && targetRef.current) return targetRef.current.click()
    goNextMain()
  }

  const prev = () => {
    if (phase === "inside") return setSubIndex((s) => Math.max(0, s - 1))
    setIndex((i) => Math.max(0, i - 1))
  }

  // Find the element to spotlight (navigating to its page first) and listen for a real click
  useEffect(() => {
    if (!open || !step) return
    setRect(null)
    targetRef.current = null

    if (phase === "close") {
      const layer = layerRef.current
      setSearching(false)
      if (!layer) return
      const measure = () => setRect(layer.getBoundingClientRect())
      const timer = setTimeout(measure, 250)
      window.addEventListener("resize", measure)
      return () => {
        clearTimeout(timer)
        window.removeEventListener("resize", measure)
      }
    }

    if (phase === "main") navigateRef.current(step.page)
    const target = phase === "inside" ? insideSteps[subIndex]?.target : step.target
    setSearching(!!target)
    if (!target) return

    const clickable = phase === "inside" || step.clickable !== false
    let cancelled = false
    let el: HTMLElement | null = null
    let timer: ReturnType<typeof setTimeout>
    const started = Date.now()

    const measure = () => {
      if (el && !cancelled) setRect(visibleRect(el))
    }
    const onClick = () => handlers.current.onTargetClick()
    const find = () => {
      if (cancelled) return
      el = findTarget(target)
      if (el) {
        targetRef.current = el
        if (clickable) el.addEventListener("click", onClick)
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" })
        timer = setTimeout(() => {
          measure()
          setSearching(false)
        }, 400)
      } else if (Date.now() - started < 3000) {
        timer = setTimeout(find, 100)
      } else {
        // Target not found (e.g. still loading): show the bubble centered
        setSearching(false)
      }
    }
    timer = setTimeout(find, 80)

    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      cancelled = true
      clearTimeout(timer)
      el?.removeEventListener("click", onClick)
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, phase, subIndex])

  // Once the opened window is closed (Annuler, croix, Appliquer…), move on to the next step
  useEffect(() => {
    if (!open || phase === "main") return
    const id = setInterval(() => {
      if (layerRef.current && !isOpenLayer(layerRef.current)) handlers.current.goNextMain()
    }, 150)
    return () => clearInterval(id)
  }, [open, phase])

  useEffect(() => {
    if (!open) return
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [open])

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
  }, [index, phase, subIndex, rect, searching, viewport.w])

  useEffect(() => {
    if (!open || phase === "close") return
    const onKey = (e: KeyboardEvent) => {
      if (!e.isTrusted) return
      if (e.key === "ArrowRight") next()
      else if (e.key === "ArrowLeft") prev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // Keep clicks on the tour from counting as "outside" clicks that would close an open window
  const stopOutsidePointer = useCallback((node: HTMLDivElement | null) => {
    node?.addEventListener("pointerdown", (e) => e.stopPropagation())
  }, [])

  if (!open || !step || typeof document === "undefined") return null

  const view =
    phase === "inside"
      ? { ...insideSteps[subIndex], clickable: true }
      : phase === "close"
        ? { title: "Referme pour continuer", body: step.closeBody ?? DEFAULT_CLOSE_BODY, clickable: true }
        : { title: step.title, body: step.body, clickable: step.clickable !== false }

  const { w: vw, h: vh } = viewport
  const cardW = Math.min(CARD_W, vw - 32)
  const hole = rect
    ? { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null

  let cardStyle: React.CSSProperties = { top: "50%", left: "50%", width: cardW, transform: "translate(-50%, -50%)" }
  const arrows: ArrowSpec[] = []

  if (hole && phase === "close") {
    // The window is big: bubble in a corner, no arrows
    cardStyle = { left: 16, bottom: 16, width: cardW }
  } else if (hole) {
    const right = hole.left + hole.width
    const bottom = hole.top + hole.height
    const cx = hole.left + hole.width / 2
    const cy = hole.top + hole.height / 2

    // Arrows on the left and right of the element when there is room…
    const sL = arrowScale(hole.left)
    const sR = arrowScale(vw - right)
    if (sL) arrows.push({ tipX: hole.left - ARROW_GAP, tipY: cy, rotate: 0, mirror: false, scale: sL })
    if (sR) arrows.push({ tipX: right + ARROW_GAP, tipY: cy, rotate: 0, mirror: true, scale: sR })

    // …otherwise above or below it, on the side the bubble does not use
    let gapBelow = 16
    let gapAbove = 16
    if (arrows.length === 0) {
      const sT = arrowScale(hole.top)
      const sB = arrowScale(vh - bottom)
      const cardFitsBelow = bottom + 16 + cardH <= vh - 16
      if (cardFitsBelow && sT) {
        arrows.push({ tipX: cx, tipY: hole.top - ARROW_GAP, rotate: 90, mirror: false, scale: sT })
      } else if (!cardFitsBelow && sB) {
        arrows.push({ tipX: cx, tipY: bottom + ARROW_GAP, rotate: -90, mirror: false, scale: sB })
      } else if (sB) {
        arrows.push({ tipX: cx, tipY: bottom + ARROW_GAP, rotate: -90, mirror: false, scale: sB })
        gapBelow = ARROW_W * sB + ARROW_GAP + 14
      } else if (sT) {
        arrows.push({ tipX: cx, tipY: hole.top - ARROW_GAP, rotate: 90, mirror: false, scale: sT })
        gapAbove = ARROW_W * sT + ARROW_GAP + 14
      }
    }

    const below = bottom + gapBelow
    const above = hole.top - gapAbove - cardH
    const sideTop = Math.min(Math.max(16, cy - cardH / 2), vh - cardH - 16)
    if (below + cardH <= vh - 16) {
      cardStyle = { top: below, left: Math.min(Math.max(16, cx - cardW / 2), vw - cardW - 16), width: cardW }
    } else if (above >= 16) {
      cardStyle = { top: above, left: Math.min(Math.max(16, cx - cardW / 2), vw - cardW - 16), width: cardW }
    } else if (vw - right >= cardW + 32) {
      // Tall element (e.g. a list): bubble beside it rather than on top of it, without the arrow on that side
      cardStyle = { top: sideTop, left: right + 16, width: cardW }
      arrows.splice(0, arrows.length, ...arrows.filter((a) => !(a.rotate === 0 && a.mirror)))
    } else if (hole.left >= cardW + 32) {
      cardStyle = { top: sideTop, left: hole.left - cardW - 16, width: cardW }
      arrows.splice(0, arrows.length, ...arrows.filter((a) => !(a.rotate === 0 && !a.mirror)))
    } else {
      cardStyle = { top: Math.max(16, vh - cardH - 16), left: Math.min(Math.max(16, cx - cardW / 2), vw - cardW - 16), width: cardW }
    }
  }

  // Click blockers around the hole keep the rest of the page inert. While waiting for a window to
  // be closed there are none, so the user can close it however they like.
  const blockers: React.CSSProperties[] =
    phase === "close"
      ? []
      : hole
        ? [
            { left: 0, top: 0, width: vw, height: Math.max(0, hole.top) },
            { left: 0, top: hole.top + hole.height, width: vw, height: Math.max(0, vh - hole.top - hole.height) },
            { left: 0, top: hole.top, width: Math.max(0, hole.left), height: hole.height },
            {
              left: hole.left + hole.width,
              top: hole.top,
              width: Math.max(0, vw - hole.left - hole.width),
              height: hole.height,
            },
          ]
        : [{ left: 0, top: 0, width: vw, height: vh, background: OVERLAY }]

  const counter =
    phase === "inside" ? `Étape ${index + 1} / ${steps.length} · ${subIndex + 1}/${insideSteps.length}` : `Étape ${index + 1} / ${steps.length}`

  return createPortal(
    <div ref={stopOutsidePointer} className="fixed inset-0 z-[100] pointer-events-none">
      <style>{TOUR_CSS}</style>

      {blockers.map((style, i) => (
        <div key={i} className="absolute pointer-events-auto" style={style} />
      ))}

      {hole && (
        <div
          className="absolute rounded-xl border-2 border-primary transition-all duration-300"
          style={{ ...hole, boxShadow: `0 0 0 9999px ${OVERLAY}` }}
        >
          <span className="absolute inset-0 rounded-xl" style={{ animation: "tourPulse 1.4s ease-out infinite" }} />
          {/* Elements with nothing to try: a click simply moves on */}
          {!view.clickable && (
            <button
              type="button"
              aria-label="Suivant"
              onClick={next}
              className="absolute inset-0 rounded-xl cursor-pointer pointer-events-auto"
            />
          )}
        </div>
      )}

      {arrows.map((a, i) => (
        <TourArrow key={i} {...a} />
      ))}

      {!searching && (
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          className="absolute pointer-events-auto rounded-2xl border bg-card text-card-foreground shadow-2xl p-4 space-y-3 transition-all duration-300"
          style={cardStyle}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{counter}</span>
            <button type="button" onClick={finish} className="flex items-center gap-1 hover:text-foreground">
              Passer le tuto <X className="size-3.5" />
            </button>
          </div>
          <Progress value={((index + 1) / steps.length) * 100} className="h-1.5" />
          <div>
            <h3 id="tour-title" className="text-lg font-bold leading-tight">
              {view.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{view.body}</p>
          </div>

          {phase === "main" && hole && view.clickable && (
            <p className="text-xs font-medium text-primary">👆 Appuie sur le bouton entouré pour l'essayer</p>
          )}

          {phase !== "close" && (
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prev}
                disabled={phase === "inside" ? subIndex === 0 : index === 0}
              >
                <ChevronLeft className="size-4 mr-1" />
                Précédent
              </Button>
              <Button size="sm" onClick={next}>
                {isLast && phase === "main" ? (
                  <>
                    <CheckCircle2 className="size-4 mr-1" />
                    Terminer
                  </>
                ) : (
                  <>
                    Suivant
                    <ChevronRight className="size-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}
