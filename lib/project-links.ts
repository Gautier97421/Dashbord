// Liens des projets : adresse web (app, documentation, dépôt…) ou dossier local.
// Un navigateur ne peut pas ouvrir un dossier local (file:// est bloqué depuis une page web) :
// on propose VS Code (vscode://file/…), la copie du chemin, et l'Explorateur Windows via un
// petit protocole "dashlife-open:" à installer une fois (voir FOLDER_HANDLER_INSTALLER).

export type LinkKind = "folder" | "web"

const LOCAL_PATH = /^([a-zA-Z]:[\\/]|\\\\|file:\/\/|~[\\/]|\/(?!\/))/

export function linkKind(url: string): LinkKind {
  return LOCAL_PATH.test(url.trim()) ? "folder" : "web"
}

/** Chemin local lisible : "file:///C:/Dev/app" -> "C:\Dev\app". */
export function localPath(url: string): string {
  let path = url.trim()
  if (/^file:\/\//i.test(path)) {
    path = decodeURIComponent(path.replace(/^file:\/\/\/?/i, ""))
    if (/^[a-zA-Z]:\//.test(path)) path = path.replace(/\//g, "\\")
  }
  return path
}

/** Saisie d'un lien : "Copier en tant que chemin d'accès" de l'Explorateur ajoute des guillemets. */
export function normalizeLinkInput(url: string): string {
  return url.trim().replace(/^["']+|["']+$/g, "").trim()
}

/** Nom du dossier ("C:\Dev\mon-site" -> "mon-site"). */
export function folderName(path: string): string {
  return localPath(path).replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path
}

/** Premier dossier local parmi les liens d'un projet (le dossier du projet). */
export function projectFolder(links: { url: string }[] | undefined): string | null {
  const link = (links || []).find((l) => linkKind(l.url) === "folder")
  return link ? localPath(link.url) : null
}

/** Adresse web cliquable ("monapp.fr" -> "https://monapp.fr"). */
export function webHref(url: string): string {
  const trimmed = url.trim()
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export const explorerHref = (path: string) => `dashlife-open:${encodeURIComponent(path)}`
export const vscodeHref = (path: string) => `vscode://file/${path.replace(/\\/g, "/")}`

// Préférence locale : l'ouverture dans l'Explorateur a été installée sur cet ordinateur
export const FOLDER_HANDLER_KEY = "dashlife:folderHandler"

export function isFolderHandlerEnabled(): boolean {
  try {
    return localStorage.getItem(FOLDER_HANDLER_KEY) === "1"
  } catch {
    return false
  }
}

export function setFolderHandlerEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(FOLDER_HANDLER_KEY, "1")
    else localStorage.removeItem(FOLDER_HANDLER_KEY)
  } catch {
    /* ignore */
  }
}

// Script exécuté par Windows pour un lien "dashlife-open:<chemin encodé>". Le chemin est passé en
// argument (jamais évalué comme du code) ; un dossier est ouvert, un fichier seulement montré.
const HANDLER_SCRIPT = [
  "param([string]$Uri)",
  "# Opens the folder of a DashLife project link (dashlife-open:<encoded path>) in File Explorer.",
  "# A file is never opened or run: its location is only shown.",
  "$path = [Uri]::UnescapeDataString(($Uri -replace '^dashlife-open:/*', ''))",
  "if (Test-Path -LiteralPath $path -PathType Container) {",
  "  Start-Process -FilePath 'explorer.exe' -ArgumentList ('\"' + $path + '\"')",
  "} elseif (Test-Path -LiteralPath $path -PathType Leaf) {",
  "  Start-Process -FilePath 'explorer.exe' -ArgumentList ('/select,\"' + $path + '\"')",
  "}",
].join("\r\n")

/** Installateur PowerShell (compte courant, sans droits administrateur). */
export const FOLDER_HANDLER_INSTALLER = [
  "# DashLife - open project folders in Windows File Explorer.",
  "# Installs for the current user only (no administrator rights needed).",
  "# Uninstall:",
  "#   Remove-Item -Recurse 'HKCU:\\Software\\Classes\\dashlife-open'",
  "#   Remove-Item -Recurse \"$env:LOCALAPPDATA\\DashLife\"",
  "$ErrorActionPreference = 'Stop'",
  "$dir = Join-Path $env:LOCALAPPDATA 'DashLife'",
  "New-Item -ItemType Directory -Force -Path $dir | Out-Null",
  "$handler = Join-Path $dir 'open-folder.ps1'",
  "$handlerCode = @'",
  HANDLER_SCRIPT,
  "'@",
  "Set-Content -LiteralPath $handler -Value $handlerCode -Encoding UTF8",
  "$key = 'HKCU:\\Software\\Classes\\dashlife-open'",
  "New-Item -Path ($key + '\\shell\\open\\command') -Force | Out-Null",
  "Set-Item -Path $key -Value 'URL:DashLife - open a folder'",
  "New-ItemProperty -Path $key -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null",
  "Set-Item -Path ($key + '\\shell\\open\\command') -Value ('powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"' + $handler + '\" \"%1\"')",
  "Write-Host 'Done: DashLife project folders now open in File Explorer.'",
  "Read-Host 'Press Enter to close'",
].join("\r\n")
