export async function exportSvg(canvas: HTMLElement): Promise<string> {
  const { toSvg } = await import("html-to-image");
  await document.fonts.ready;
  const dataUrl = await toSvg(canvas, {
    filter: (node) =>
      !(node instanceof Element) ||
      !node.matches(
        "button, iframe, [role=tooltip], .flow-sdk-handle, .flow-sdk-property-port, .flow-sdk-edge-hit, .flow-sdk-ghost, .flow-sdk-node-animation",
      ),
  });
  const svg = new DOMParser().parseFromString(
    decodeURIComponent(dataUrl.slice(dataUrl.indexOf(",") + 1)),
    "image/svg+xml",
  );
  svg
    .querySelectorAll(
      ".flow-sdk-edge-hit, .flow-sdk-handle, .flow-sdk-property-port, .flow-sdk-ghost",
    )
    .forEach((element) => element.remove());
  svg.querySelectorAll("[data-flow-preview-source]").forEach((element) => {
    element.setAttribute(
      "style",
      "display:block;white-space:pre-wrap;font:16px/1.5 monospace;overflow-wrap:anywhere",
    );
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
}

export async function downloadSvg(
  canvas: HTMLElement,
  filename = "squeed.svg",
): Promise<void> {
  const link = document.createElement("a");
  link.href = await exportSvg(canvas);
  link.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  link.click();
}
