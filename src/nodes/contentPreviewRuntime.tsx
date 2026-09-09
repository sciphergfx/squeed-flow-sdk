import * as React from "react";
import { createRoot } from "react-dom/client";

const container = document.getElementById("preview");
const showError = (error: unknown) => {
  const message = document.createElement("pre");
  message.setAttribute("role", "alert");
  message.style.whiteSpace = "pre-wrap";
  message.textContent = error instanceof Error ? error.message : String(error);
  container.replaceChildren(message);
};
window.addEventListener("error", (event) =>
  showError(event.error ?? event.message),
);
window.addEventListener("unhandledrejection", (event) =>
  showError(event.reason),
);

class PreviewBoundary extends React.Component<
  React.PropsWithChildren,
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <pre role="alert" style={{ whiteSpace: "pre-wrap" }}>
        {this.state.error}
      </pre>
    ) : (
      this.props.children
    );
  }
}

try {
  const source = JSON.parse(document.getElementById("source").textContent);
  const module = { exports: {} as { default?: React.ComponentType } };
  const require = (name: string) => {
    if (name === "react") return React;
    throw new Error(`Unsupported import: ${name}. Only react is available.`);
  };
  new Function("require", "module", "exports", "React", source)(
    require,
    module,
    module.exports,
    React,
  );
  if (!module.exports.default)
    throw new Error("Export a React component as default.");
  createRoot(container).render(
    <PreviewBoundary>
      {React.createElement(module.exports.default)}
    </PreviewBoundary>,
  );
} catch (error) {
  showError(error);
}
