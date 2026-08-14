import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy libraries into their own chunks so they are cached
        // separately and only fetched when a route that uses them loads.
        manualChunks: {
          recharts: ["recharts"],
          pdf: ["jspdf", "html2canvas"],
          amplify: ["aws-amplify"],
        },
      },
    },
  },
});