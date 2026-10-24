// Fonctionnalités activables par l'administrateur (partagé client + serveur)

export interface FeatureDef {
  label: string
  description: string
  // Valeur tant que l'admin n'a rien choisi. Désactivée = réservée à l'admin.
  defaultEnabled: boolean
  // Pages du menu qui dépendent de cette fonctionnalité
  navKeys: string[]
}

export const FEATURES = {
  "ai-agent": {
    label: "Agent IA",
    description: "Agent IA, workflows automatisés et actions « À valider »",
    defaultEnabled: false,
    navKeys: ["ai-agent", "validation"],
  },
} satisfies Record<string, FeatureDef>

export type FeatureKey = keyof typeof FEATURES

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[]

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && value in FEATURES
}

export function featureForNavKey(navKey: string): FeatureKey | undefined {
  return FEATURE_KEYS.find((key) => (FEATURES[key].navKeys as string[]).includes(navKey))
}
