import { useEffect, useState } from "react";
import type { ContentFormat } from "../types";

export function ContentPreview({
  content,
  format,
}: {
  content: string;
  format: Exclude<ContentFormat, "markdown">;
}) {
  const [preview, setPreview] = useState<{
    content: string;
    format: string;
    document?: string;
    error?: string;
  }>();
  useEffect(() => {
    let cancelled = false;
    import("./contentPreviewDocument")
      .then(({ contentPreviewDocument }) =>
        contentPreviewDocument(content, format),
      )
      .then(
        (document) => {
          if (!cancelled) setPreview({ content, format, document });
        },
        (error) => {
          if (!cancelled)
            setPreview({
              content,
              format,
              error: error instanceof Error ? error.message : String(error),
            });
        },
      );
    return () => {
      cancelled = true;
    };
  }, [content, format]);
  const current =
    preview?.content === content && preview.format === format
      ? preview
      : undefined;
  return (
    <div
      data-flow-content-preview=""
      style={{ width: "100%", height: 360, fontSize: 16, overflow: "auto" }}
    >
      <pre
        data-flow-preview-source=""
        style={{ display: "none", whiteSpace: "pre-wrap" }}
      >
        {content}
      </pre>
      {current?.error ? (
        <pre role="alert" style={{ whiteSpace: "pre-wrap" }}>
          {current.error}
        </pre>
      ) : current?.document ? (
        <iframe
          title={`${format.toUpperCase()} content preview`}
          sandbox={format === "jsx" ? "allow-scripts" : ""}
          referrerPolicy="no-referrer"
          srcDoc={current.document}
          style={{
            width: "100%",
            height: "100%",
            border: 0,
            display: "block",
            background: "white",
          }}
        />
      ) : (
        <span role="status">Loading preview...</span>
      )}
    </div>
  );
}
