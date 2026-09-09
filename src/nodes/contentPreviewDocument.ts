import DOMPurify from "dompurify";
import runtime from "virtual:content-preview-runtime";
import type { ContentFormat } from "../types";

export async function contentPreviewDocument(
  source: string,
  format: Exclude<ContentFormat, "markdown">,
) {
  if (source.length > 100_000)
    throw new Error("Preview source exceeds 100,000 characters.");
  const nonce = crypto.randomUUID();
  let body: string;
  if (format === "html") {
    body = DOMPurify.sanitize(source, {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: ["style"],
      FORBID_TAGS: [
        "script",
        "meta",
        "base",
        "link",
        "iframe",
        "object",
        "embed",
        "form",
      ],
      FORBID_ATTR: ["href", "action", "formaction", "srcset"],
    });
  } else {
    const ts = await import("typescript");
    const result = ts.transpileModule(source, {
      fileName: "preview.tsx",
      reportDiagnostics: true,
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    });
    const errors = result.diagnostics?.filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    if (errors?.length)
      throw new Error(
        errors
          .map((error) =>
            ts.flattenDiagnosticMessageText(error.messageText, "\n"),
          )
          .join("\n"),
      );
    body = `<div id="preview"></div><script type="application/json" id="source">${JSON.stringify(result.outputText).replace(/</g, "\\u003c")}</script><script nonce="${nonce}">${runtime.replace(/<\/script/gi, "<\\/script")}</script>`;
  }
  const policy = `default-src 'none'; script-src ${format === "jsx" ? `'nonce-${nonce}' 'unsafe-eval'` : "'none'"}; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none';`;
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><style>html{color-scheme:light}body{margin:16px;font:16px/1.5 sans-serif;color:#18181b;background:white;overflow-wrap:anywhere}*{box-sizing:border-box}img{max-width:100%}pre{white-space:pre-wrap}</style></head><body>${body}</body></html>`;
}
