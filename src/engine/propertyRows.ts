export interface PropertyRow {
  property: string;
  top: number;
  height: number;
  role?: "source" | "target";
}

export function measurePropertyRows(host: HTMLElement): PropertyRow[] {
  const bounds = host.getBoundingClientRect();
  const scale = bounds.height / host.offsetHeight;
  if (!Number.isFinite(scale) || scale <= 0) return [];
  return [
    ...host.querySelectorAll<HTMLElement>("[data-flow-property]"),
  ].flatMap((element) => {
    if (element.closest(".flow-sdk-node") !== host) return [];
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    return [
      {
        property: element.getAttribute("data-flow-property")!,
        top: Math.round(((rect.top - bounds.top) / scale) * 1000) / 1000,
        height: Math.round((rect.height / scale) * 1000) / 1000,
        ...(element.dataset.flowPortRole === "source" || element.dataset.flowPortRole === "target" ? { role: element.dataset.flowPortRole } : {}),
      },
    ];
  });
}
