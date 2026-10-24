import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DashLife - Dashboard de productivité personnelle",
    short_name: "DashLife",
    description: "Organisez vos journées, suivez vos habitudes et atteignez vos objectifs.",
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f1e5",
    theme_color: "#f7f1e5",
    categories: ["productivity", "lifestyle", "health"],
    icons: [
      { src: "/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Icône pleine pour Android : le système la découpe à sa forme (cercle, carré arrondi…)
      { src: "/favicon/maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/favicon/maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Appui long sur l'icône de l'app installée
    shortcuts: [
      { name: "Mes tâches", url: "/?page=projects&view=tasks", icons: [{ src: "/favicon/android-chrome-192x192.png", sizes: "192x192" }] },
      { name: "Projets", url: "/?page=projects&view=overview", icons: [{ src: "/favicon/android-chrome-192x192.png", sizes: "192x192" }] },
      { name: "Tableau de bord", url: "/?page=dashboard", icons: [{ src: "/favicon/android-chrome-192x192.png", sizes: "192x192" }] },
      { name: "Nutrition", url: "/?page=nutrition", icons: [{ src: "/favicon/android-chrome-192x192.png", sizes: "192x192" }] },
      { name: "Routine", url: "/?page=routine", icons: [{ src: "/favicon/android-chrome-192x192.png", sizes: "192x192" }] },
      { name: "Objectif", url: "/?page=missions", icons: [{ src: "/favicon/android-chrome-192x192.png", sizes: "192x192" }] },
    ],
    // Rouvrir l'app réutilise la fenêtre déjà ouverte (ordinateur)
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
  } as MetadataRoute.Manifest
}
