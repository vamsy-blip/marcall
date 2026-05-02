import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const BUILD_TIME = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(BUILD_TIME),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split heavy third-party deps out of the route chunks so the initial
        // marketing payload stays small and shared vendor code is cached across
        // routes. Anything not matched here ends up in the per-route chunk.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          // Order matters: check most-specific deps first, lowest-level utils last.
          if (id.includes('recharts') || id.includes('victory-vendor') || /[\\/]node_modules[\\/]d3-/.test(id)) {
            return 'charts-vendor';
          }
          if (id.includes('@sentry')) return 'sentry-vendor';
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n-vendor';
          if (id.includes('@tanstack')) return 'query-vendor';
          if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('cmdk') || id.includes('vaul')) {
            return 'ui-vendor';
          }
          // Low-level utilities used everywhere — keep with react-vendor so they
          // don't accidentally pull a heavy chunk into the eager graph.
          if (id.includes('react-dom') || /[\\/]node_modules[\\/]react[\\/]/.test(id) || id.includes('wouter') || id.includes('scheduler') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
