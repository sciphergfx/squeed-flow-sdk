import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { build } from "esbuild";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "content-preview-runtime",
      resolveId: (id) =>
        id === "virtual:content-preview-runtime" ? `\0${id}` : undefined,
      async load(id) {
        if (id !== "\0virtual:content-preview-runtime") return;
        const result = await build({
          entryPoints: [
            resolve(__dirname, "src/nodes/contentPreviewRuntime.tsx"),
          ],
          bundle: true,
          write: false,
          minify: true,
          format: "iife",
          platform: "browser",
          define: { "process.env.NODE_ENV": '"production"' },
        });
        return `export default ${JSON.stringify(result.outputFiles[0].text)}`;
      },
    },
    dts({ rollupTypes: true }),
  ],
  resolve: {
    // The compiler imports from "lodash" (CJS, not tree-shakeable); bundle the ESM build instead
    alias: [{ find: /^lodash$/, replacement: "lodash-es" }],
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "SqueedFlowSDK",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: (id) => {
        return (
          [
            "react",
            "react-dom",
            "react/jsx-runtime",
            "@chakra-ui/react",
            "@emotion/react",
            "@emotion/styled",
            "framer-motion",
            "typescript",
          ].includes(id) ||
          id.startsWith("react-icons") ||
          id === "markdown-to-jsx" ||
          id.startsWith("markdown-to-jsx/")
        );
      },
      output: {
        interop: "auto",
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
