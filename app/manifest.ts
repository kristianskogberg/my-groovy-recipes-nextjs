import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "My Groovy Recipes",
    short_name: "Groovy Recipes",
    description: "Save and discover your favorite recipes",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbf4e7",
    theme_color: "#fbf4e7",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
