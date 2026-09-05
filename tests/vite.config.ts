import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./browser/fixture", import.meta.url)),
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "@chakra-ui/react"],
    alias: {
      "@squeed/flow-sdk": fileURLToPath(
        new URL("../dist/index.js", import.meta.url),
      ),
    },
  },
});
