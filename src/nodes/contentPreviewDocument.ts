import DOMPurify from "dompurify";
import type { ContentFormat } from "../types";

export async function contentPreviewDocument(
  source: string,
  format: Exclude<ContentFormat, "markdown">,
  editable = false,
  autoHeight = false,
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
    const [ts, { default: runtime }] = await Promise.all([
      import("typescript"),
      import("virtual:content-preview-runtime"),
    ]);
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
  if (editable)
    body += `<script nonce="${nonce}">document.addEventListener('dblclick', function(event) {
      if (event.defaultPrevented || !(event.target instanceof Element) || event.target.closest('button, a, input, textarea, select, video, audio, [contenteditable], [role="button"], [role="textbox"]')) return;
      event.preventDefault();
      parent.postMessage({type: 'squeed:content-edit'}, '*');
    });</script>`;
  if (autoHeight)
    body += `<style>body{display:flow-root}</style><script nonce="${nonce}">(() => {
      let previous = 0;
      const report = () => {
        const height = Math.ceil(Math.max(document.body.getBoundingClientRect().height, document.body.scrollHeight));
        if (height > 0 && height !== previous) {
          previous = height;
          parent.postMessage({type: 'squeed:content-size', height}, '*');
        }
      };
      new ResizeObserver(report).observe(document.body);
      window.addEventListener('load', report);
      document.fonts.ready.then(report);
      report();
    })();</script>`;
  const policy = `default-src 'none'; script-src ${format === "jsx" ? `'nonce-${nonce}' 'unsafe-eval'` : editable || autoHeight ? `'nonce-${nonce}'` : "'none'"}; style-src 'unsafe-inline'; img-src data: blob:; media-src https: data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none';`;
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><style>html{color-scheme:light}body{margin:0;padding:0;font:16px/1.5 sans-serif;color:#18181b;background:white;overflow-wrap:anywhere}*{box-sizing:border-box}img{max-width:100%}pre{white-space:pre-wrap}</style></head><body>${body}</body></html>`;
}
