import { build } from "esbuild";
import { fileURLToPath } from "node:url";

export function contentPreviewRuntimePlugin() {
  return {
    name: "content-preview-runtime",
    resolveId: (id) =>
      id === "virtual:content-preview-runtime" ? `\0${id}` : undefined,
    async load(id) {
      if (id !== "\0virtual:content-preview-runtime") return;
      const result = await build({
        entryPoints: [
          fileURLToPath(new URL("../src/nodes/contentPreviewRuntime.tsx", import.meta.url)),
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
  };
}