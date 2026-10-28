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
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Vendors estables en chunks propios para que los despliegues no invaliden su caché.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id)) return "vendor-react";
          if (id.includes("node_modules/@supabase/")) return "vendor-supabase";
          if (id.includes("node_modules/@tanstack/")) return "vendor-query";
          return undefined;
        },
      },
    },
  },
}));
