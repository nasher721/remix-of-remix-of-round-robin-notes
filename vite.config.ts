import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Dedupe React to prevent multiple instances during HMR
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    // Force pre-bundle React and related packages to avoid HMR issues
    include: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
  },
}));
