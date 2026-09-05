export const SVG_DATA_PREFIX = "data:image/svg+xml;base64,";

export function isIconImage(name: string): boolean {
  if (name.startsWith(SVG_DATA_PREFIX)) return true;
  try {
    const url = new URL(name);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export async function svgIconDataUrl(file: File): Promise<string> {
  if (file.size > 256 * 1024) throw new Error("SVG must be 256 KB or smaller.");
  const source = await file.text();
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  if (
    document.doctype ||
    document.querySelector("parsererror") ||
    document.documentElement.localName !== "svg" ||
    document.documentElement.namespaceURI !== "http://www.w3.org/2000/svg"
  ) {
    throw new Error("Choose a valid SVG file.");
  }
  if (
    document.querySelector("script, foreignObject") ||
    [...document.querySelectorAll("*")].some((element) =>
      [...element.attributes].some((attribute) => /^on/i.test(attribute.name)),
    )
  ) {
    throw new Error("SVG scripts and event handlers are not allowed.");
  }
  const bytes = new TextEncoder().encode(source);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return SVG_DATA_PREFIX + btoa(binary);
}
