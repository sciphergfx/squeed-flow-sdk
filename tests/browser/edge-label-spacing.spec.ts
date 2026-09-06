import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  for (const direction of ["LR", "RL", "TB", "BT"] as const) {
    test(`long edge labels reserve node clearance at ${width}px ${direction}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 950 });
      await ready(page);
      for (const spacing of [1.3, 0.5]) {
        for (const propertyEdge of [false, true]) {
          await page.evaluate(
            ({ direction, spacing, propertyEdge }) => {
              window.__flowTest.events.length = 0;
              window.__flowTest.configure({
                direction,
                spacing,
                edgeMode: "auto",
              });
              window.__flowTest.replaceGraph({
                nodes: [
                  {
                    data: {
                      id: "source",
                      type: "arrayView",
                      label: "link",
                      config: {
                        icon: "PiDatabase",
                        labelBelow: true,
                        ports: [
                          { id: "output", role: "source", side: "right" },
                        ],
                      },
                      viewProps: { bgColor: "blue.500", borderRadius: 50 },
                    },
                  },
                  {
                    data: {
                      id: "target",
                      type: "arrayView",
                      label: "notify_passed",
                      config: {
                        icon: "PiBell",
                        labelBelow: true,
                        ports: [{ id: "input", role: "target", side: "left" }],
                      },
                      viewProps: { bgColor: "pink.500", borderRadius: 50 },
                    },
                  },
                ],
                edges: [
                  {
                    data: {
                      id: "condition",
                      source: "source",
                      target: "target",
                      label: "{{steps.normalize_status.result}} == 'passed'",
                      ...(propertyEdge
                        ? { sourceProperty: "output", targetProperty: "input" }
                        : {}),
                    },
                  },
                ],
              });
            },
            { direction, spacing, propertyEdge },
          );
          await expect
            .poll(() =>
              page.evaluate(() =>
                window.__flowTest.events.some(
                  (event) => event.name === "layout-complete",
                ),
              ),
            )
            .toBe(true);
          await page.evaluate(() =>
            window.__flowTest.engine!.centerAndFit(70, false),
          );
          const label = page.locator(
            '.flow-sdk-edge-label[data-edge-id="condition"]',
          );
          await expect(label.locator("text")).toContainText(
            "{{steps.normalize_status.result}}",
          );
          await expect
            .poll(() =>
              label.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                return [
                  ...document.querySelectorAll<HTMLElement>(".flow-sdk-node"),
                ]
                  .filter((node) => {
                    const box = node.getBoundingClientRect();
                    return (
                      bounds.left < box.right &&
                      bounds.right > box.left &&
                      bounds.top < box.bottom &&
                      bounds.bottom > box.top
                    );
                  })
                  .map((node) => node.dataset.nodeId);
              }),
            )
            .toEqual([]);
          await page.screenshot({
            path: test
              .info()
              .outputPath(`edge-label-${spacing}-${propertyEdge}.png`),
          });
        }
      }
    });
  }
}
