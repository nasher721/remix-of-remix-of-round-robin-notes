import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
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
          'vendor-router': ['react-router', 'react-router-dom'],
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
        },
      },
    },
    // Minification settings
    minify: mode === 'production' ? 'esbuild' : false,
    // Generate sourcemaps for production debugging
    sourcemap: mode === 'production',
  },
}));
