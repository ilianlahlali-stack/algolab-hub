import type { MetadataRoute } from "next";

/** Permet « Ajouter à l'écran d'accueil » sur iOS (Safari) et Android (Chrome) : l'app s'ouvre en plein écran, comme une application. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AlgoLab hub · Ministères sociaux",
    short_name: "AlgoLab hub",
    description: "Espace de travail du groupe VisuDSN de l'AlgoLab (Sciences Po)",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f1e5",
    theme_color: "#f7f1e5",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
