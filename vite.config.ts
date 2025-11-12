import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Get base path from environment variable, default to "/"
  // Supports both VITE_APP_BASE env var and --base CLI flag (CLI flag takes precedence)
  // Vite expects base to start with "/" and end with "/" (except root which is "/")
  const envBase = process.env.VITE_APP_BASE;
  let base = "/";
  
  if (envBase) {
    // Normalize: ensure it starts with "/" and ends with "/"
    base = envBase.startsWith("/") ? envBase : `/${envBase}`;
    base = base === "/" ? "/" : (base.endsWith("/") ? base : `${base}/`);
  }
  
  return {
    base,
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
