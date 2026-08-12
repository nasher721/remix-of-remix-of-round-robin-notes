import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

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
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (mode === "production") {
    const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"].filter(
      (key) => !env[key]?.trim(),
    );
    if (missing.length > 0) {
      throw new Error(`Production build blocked: missing ${missing.join(", ")}`);
    }
  }

  return {
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
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      // Code splitting and chunk optimization
      rollupOptions: {
        output: {
          // Manual vendor chunk splits for better caching
          manualChunks(moduleId) {
            const normalizedId = moduleId.replaceAll("\\", "/");
            const groups: Record<string, string[]> = {
              "vendor-react": ["react", "react-dom"],
              "vendor-router": ["react-router", "react-router-dom"],
              "vendor-query": ["@tanstack/react-query"],
              "vendor-ui": [
                "@radix-ui/react-dialog",
                "@radix-ui/react-dropdown-menu",
                "@radix-ui/react-popover",
                "@radix-ui/react-select",
                "@radix-ui/react-tabs",
                "@radix-ui/react-tooltip",
                "@radix-ui/react-slot",
              ],
              "vendor-charts": ["recharts"],
              "vendor-date": ["date-fns"],
              "vendor-icons": ["lucide-react"],
              "vendor-animation": ["framer-motion"],
              // Document export is heavy and only loaded when exporting.
              "vendor-export": ["xlsx", "jspdf", "html2pdf.js"],
            };

            for (const [chunkName, packages] of Object.entries(groups)) {
              if (packages.some((packageName) => (
                normalizedId.includes(`/node_modules/${packageName}/`)
              ))) {
                return chunkName;
              }
            }

            return undefined;
          },
        },
      },
      // Minification settings
      minify: mode === "production" ? "oxc" : false,
      // Clinical application source maps are not published with production assets.
      sourcemap: false,
    },
  };
});
