import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

/**
 * Sentry release + in-app version: env override, else package.json@git short sha on Vercel, else semver from package.json.
 */
function resolveAppVersion(): string {
  if (process.env.VITE_APP_VERSION?.trim()) {
    return process.env.VITE_APP_VERSION.trim();
  }
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  if (sha) {
    return `${pkg.version}+${sha}`;
  }
  return pkg.version;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(resolveAppVersion()),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    // Code splitting and chunk optimization
    rollupOptions: {
      output: {
        // Manual vendor chunk splits for better caching
        manualChunks: {
          // React core - rarely changes
          'vendor-react': ['react', 'react-dom'],
          // React Router - occasionally changes
          'vendor-router': ['react-router-dom'],
          // TanStack Query - occasionally changes
          'vendor-query': ['@tanstack/react-query'],
          // UI components (shadcn/ui primitives)
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-slot',
          ],
          // Charts and visualization
          'vendor-charts': ['recharts'],
          // Date handling
          'vendor-date': ['date-fns'],
          // Icons
          'vendor-icons': ['lucide-react'],
          // Animation libraries
          'vendor-animation': ['framer-motion'],
          // Document export (heavy — only loaded when exporting)
          'vendor-export': ['xlsx', 'jspdf', 'html2pdf.js'],
        },
      },
    },
    // Minification settings
    minify: mode === 'production' ? 'esbuild' : false,
    // Generate sourcemaps for production debugging
    sourcemap: mode === 'production',
  },
}));
