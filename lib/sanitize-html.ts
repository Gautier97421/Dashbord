"use client"

import DOMPurify from "dompurify"

// HTML des notes (éditeur de texte enrichi) nettoyé avant tout affichage ou toute analyse :
// garde la mise en forme (gras, tailles, alignement, listes) et retire scripts, attributs
// on*=, liens javascript: et autres vecteurs d'injection (XSS).
export function sanitizeNoteHtml(html: string | null | undefined): string {
  if (!html) return ""
  // Côté serveur, DOMPurify ne peut pas analyser le HTML : on n'affiche rien plutôt que du HTML brut
  if (typeof window === "undefined" || !DOMPurify.isSupported) return ""
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select", "iframe", "object", "embed"],
    FORBID_ATTR: ["srcset"],
    // Largeur des colonnes de tableau (éditeur) et ouverture des liens dans un nouvel onglet
    ADD_ATTR: ["colwidth", "target"],
  })
}
