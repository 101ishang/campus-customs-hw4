import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = fileURLToPath(new URL(".", import.meta.url));

const authPort = process.env.AUTH_PORT ?? "8001";
const chatApiPort = process.env.CHAT_API_PORT ?? "8000";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: [resolve(frontendDir, ".."), frontendDir] },
    proxy: {
      "/api/auth": {
        target: `http://127.0.0.1:${authPort}`,
        changeOrigin: true,
      },
      "/api/chat": {
        target: `http://127.0.0.1:${chatApiPort}`,
        changeOrigin: true,
      },
    },
  },
});
