import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "SqueedFlowSDK",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: (id) => {
        return [
          "react", "react-dom", "react/jsx-runtime",
          "@chakra-ui/react", "@chakra-ui/icons",
          "@emotion/react", "@emotion/styled",
          "framer-motion",
        ].includes(id) || id.startsWith("react-icons");
      },
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "@chakra-ui/react": "ChakraUI",
        },
      },
    },
    sourcemap: true,
  },
});
