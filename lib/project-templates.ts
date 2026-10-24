// Modèles de projets : structure commune aux modèles fournis (ci-dessous) et à ceux enregistrés
// par l'utilisateur. Les dates sont relatives au jour de début choisi à la création.

import type { Priority, ProjectLink, ProjectStatus, Recurrence } from "@/lib/types"

export interface TemplateTask {
  // Référence interne au modèle, pour les dépendances entre tâches
  ref?: string
  title: string
  description?: string
  notes?: string
  priority?: Priority
  // Échéance / début : nombre de jours après le début du projet
  offsetDays?: number
  startOffsetDays?: number
  checklist?: string[]
  recurrence?: Recurrence
  dependsOn?: string[]
  links?: ProjectLink[]
}

export interface TemplateNode {
  title: string
  description?: string
  notes?: string
  category?: string
  priority?: Priority
  status?: ProjectStatus | null
  startOffsetDays?: number
  // Échéance de l'étape : sert de jalon dans le calendrier
  deadlineOffsetDays?: number
  objectives?: string[]
  links?: ProjectLink[]
  tasks?: TemplateTask[]
  children?: TemplateNode[]
}

export interface ProjectTemplateData {
  root: TemplateNode
}

export interface BuiltinTemplate {
  key: string
  name: string
  description: string
  icon: "globe" | "party" | "app" | "wrench" | "user"
  data: ProjectTemplateData
}

export function countTemplate(node: TemplateNode): { phases: number; tasks: number } {
  const children = node.children || []
  return children.reduce(
    (acc, child) => {
      const c = countTemplate(child)
      return { phases: acc.phases + 1 + c.phases, tasks: acc.tasks + c.tasks }
    },
    { phases: 0, tasks: (node.tasks || []).length }
  )
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    key: "website",
    name: "Lancement d'un site web",
    description: "Du cadrage à la mise en ligne : maquettes, intégration, référencement, tests.",
    icon: "globe",
    data: {
      root: {
        title: "Lancement du site web",
        category: "Travail",
        status: "not_started",
        deadlineOffsetDays: 45,
        objectives: ["Site en ligne et responsive", "Référencement de base en place"],
        children: [
          {
            title: "Cadrage",
            deadlineOffsetDays: 7,
            tasks: [
              { title: "Définir les objectifs et le public visé", offsetDays: 2 },
              { title: "Lister les pages et les contenus", offsetDays: 4 },
              { title: "Choisir le nom de domaine et l'hébergement", offsetDays: 6 },
            ],
          },
          {
            title: "Design",
            startOffsetDays: 7,
            deadlineOffsetDays: 18,
            tasks: [
              { title: "Charte graphique (couleurs, polices, logo)", offsetDays: 12 },
              { ref: "mockups", title: "Maquettes des pages principales", offsetDays: 15, checklist: ["Accueil", "À propos", "Contact"] },
              { ref: "mockups-ok", title: "Valider les maquettes", offsetDays: 18, priority: "high", dependsOn: ["mockups"] },
            ],
          },
          {
            title: "Développement",
            startOffsetDays: 18,
            deadlineOffsetDays: 35,
            tasks: [
              { title: "Mettre en place le projet et l'hébergement", offsetDays: 21 },
              { ref: "pages", title: "Intégrer les pages", offsetDays: 30, dependsOn: ["mockups-ok"] },
              { title: "Formulaire de contact", offsetDays: 32 },
              { title: "Optimiser le référencement (SEO)", offsetDays: 34, checklist: ["Titres et méta-descriptions", "Plan du site (sitemap)", "Images optimisées"] },
            ],
          },
          {
            title: "Lancement",
            startOffsetDays: 35,
            deadlineOffsetDays: 45,
            tasks: [
              { ref: "tests", title: "Tester sur mobile et navigateurs", offsetDays: 40, dependsOn: ["pages"], checklist: ["Chrome", "Safari", "Firefox", "Mobile"] },
              { title: "Mise en ligne", offsetDays: 43, priority: "high", dependsOn: ["tests"] },
              { title: "Annoncer le lancement", offsetDays: 45 },
            ],
          },
        ],
      },
    },
  },
  {
    key: "event",
    name: "Organisation d'un événement",
    description: "Budget, lieu, invités, logistique et communication jusqu'au jour J.",
    icon: "party",
    data: {
      root: {
        title: "Organisation de l'événement",
        category: "Perso",
        status: "not_started",
        deadlineOffsetDays: 60,
        children: [
          {
            title: "Préparation",
            deadlineOffsetDays: 10,
            tasks: [
              { title: "Définir le budget", offsetDays: 3 },
              { ref: "date", title: "Fixer la date et le lieu", offsetDays: 7, priority: "high" },
              { title: "Établir la liste des invités", offsetDays: 10 },
            ],
          },
          {
            title: "Logistique",
            startOffsetDays: 7,
            deadlineOffsetDays: 45,
            tasks: [
              { ref: "venue", title: "Réserver le lieu", offsetDays: 14, priority: "high", dependsOn: ["date"] },
              { title: "Traiteur et boissons", offsetDays: 30, dependsOn: ["venue"] },
              { title: "Matériel", offsetDays: 40, checklist: ["Son", "Décoration", "Tables et chaises"] },
            ],
          },
          {
            title: "Communication",
            startOffsetDays: 14,
            deadlineOffsetDays: 52,
            tasks: [
              { ref: "invites", title: "Envoyer les invitations", offsetDays: 21, dependsOn: ["venue"] },
              { title: "Relancer les invités", offsetDays: 45, dependsOn: ["invites"] },
              { title: "Confirmer les présences", offsetDays: 52 },
            ],
          },
          {
            title: "Jour J",
            startOffsetDays: 52,
            deadlineOffsetDays: 60,
            tasks: [
              { title: "Programme de la journée", offsetDays: 55 },
              { title: "Installation", offsetDays: 60, priority: "urgent" },
              { title: "Bilan et remerciements", offsetDays: 62 },
            ],
          },
        ],
      },
    },
  },
  {
    key: "app",
    name: "Développement d'une application",
    description: "Spécifications, design, MVP, tests et publication.",
    icon: "app",
    data: {
      root: {
        title: "Développement de l'application",
        category: "Travail",
        status: "not_started",
        deadlineOffsetDays: 90,
        objectives: ["Publier un MVP utilisable", "Recueillir les premiers retours"],
        children: [
          {
            title: "Spécifications",
            deadlineOffsetDays: 12,
            tasks: [
              { ref: "specs", title: "Rédiger le cahier des charges", offsetDays: 7 },
              { ref: "mvp", title: "Définir le périmètre du MVP", offsetDays: 10, dependsOn: ["specs"] },
              { title: "Choisir la stack technique", offsetDays: 12 },
            ],
          },
          {
            title: "Design",
            startOffsetDays: 10,
            deadlineOffsetDays: 25,
            tasks: [
              { title: "Parcours utilisateur", offsetDays: 18, dependsOn: ["mvp"] },
              { ref: "ui", title: "Maquettes des écrans", offsetDays: 25 },
            ],
          },
          {
            title: "Développement du MVP",
            startOffsetDays: 25,
            deadlineOffsetDays: 65,
            tasks: [
              { title: "Mettre en place le dépôt et l'intégration continue", offsetDays: 28 },
              { title: "Authentification", offsetDays: 40 },
              { title: "API et base de données", offsetDays: 55 },
              { ref: "features", title: "Fonctionnalités principales", offsetDays: 65, dependsOn: ["ui"] },
            ],
          },
          {
            title: "Tests",
            startOffsetDays: 65,
            deadlineOffsetDays: 85,
            tasks: [
              { title: "Tests automatisés", offsetDays: 75 },
              { ref: "user-tests", title: "Tests utilisateurs", offsetDays: 80, dependsOn: ["features"] },
              { ref: "bugs", title: "Corriger les bugs", offsetDays: 85, priority: "high", dependsOn: ["user-tests"] },
            ],
          },
          {
            title: "Publication",
            startOffsetDays: 85,
            deadlineOffsetDays: 90,
            tasks: [
              { title: "Préparer la mise en production", offsetDays: 88 },
              { title: "Publier", offsetDays: 90, priority: "high", dependsOn: ["bugs"] },
              { title: "Suivi après lancement", offsetDays: 97 },
            ],
          },
        ],
      },
    },
  },
  {
    key: "maintenance",
    name: "Maintenance",
    description: "Tâches récurrentes : sauvegardes, mises à jour, sécurité, surveillance.",
    icon: "wrench",
    data: {
      root: {
        title: "Maintenance",
        category: "Travail",
        status: "in_progress",
        tasks: [
          { title: "Vérifier les sauvegardes", offsetDays: 7, recurrence: "weekly" },
          { title: "Relire les journaux d'erreurs", offsetDays: 7, recurrence: "weekly" },
          { title: "Mettre à jour les dépendances", offsetDays: 30, recurrence: "monthly" },
          { title: "Contrôle de sécurité", offsetDays: 30, recurrence: "monthly", checklist: ["Mots de passe et accès", "Certificats", "Alertes de sécurité"] },
          { title: "Surveiller les performances", offsetDays: 30, recurrence: "monthly" },
        ],
      },
    },
  },
  {
    key: "personal",
    name: "Projet personnel",
    description: "Un objectif découpé en étapes, avec un point d'étape et un bilan.",
    icon: "user",
    data: {
      root: {
        title: "Projet personnel",
        category: "Perso",
        status: "not_started",
        deadlineOffsetDays: 30,
        tasks: [
          { ref: "goal", title: "Définir l'objectif", offsetDays: 1 },
          { ref: "steps", title: "Découper en étapes", offsetDays: 3, dependsOn: ["goal"], checklist: ["Étape 1", "Étape 2", "Étape 3"] },
          { title: "Faire le premier pas", offsetDays: 7, dependsOn: ["steps"] },
          { title: "Point d'étape", offsetDays: 15 },
          { title: "Bilan", offsetDays: 30 },
        ],
      },
    },
  },
]
