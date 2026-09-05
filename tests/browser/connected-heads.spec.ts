import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const edgeType of [
  "rounded-orthogonal",
  "orthogonal",
  "straight",
  "bezier",
] as const) {
  test(`${edgeType} squares only heads attached to property rows`, async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate((edgeType) => {
      window.__flowTest.configure({ edgeMode: "properties", edgeType });
      window.__flowTest.replaceGraph({
        nodes: [
          {
            data: {
              id: "alpha",
              type: "objectView",
              headerTitle: "Source",
              description: { output: "value" },
            },
          },
          {
            data: {
              id: "beta",
              type: "objectView",
              headerTitle: "Target",
              description: { input: "value" },
            },
          },
        ],
        edges: [
          {
            data: {
              id: "mapped",
              source: "alpha",
              target: "beta",
              sourceProperty: "output",
              targetProperty: "input",
            },
          },
          {
            data: {
              id: "source-only",
              source: "alpha",
              target: "beta",
              sourceProperty: "output",
            },
          },
          {
            data: {
              id: "target-only",
              source: "alpha",
              target: "beta",
              targetProperty: "input",
            },
          },
          { data: { id: "node-link", source: "alpha", target: "beta" } },
          {
            data: {
              id: "missing-row",
              source: "alpha",
              target: "beta",
              sourceProperty: "output",
              targetProperty: "missing",
            },
          },
          {
            data: {
              id: "inverted-connected",
              source: "alpha",
              target: "beta",
              sourceProperty: "output",
              isInverted: true,
            },
          },
          {
            data: {
              id: "inverted-unconnected",
              source: "alpha",
              target: "beta",
              targetProperty: "input",
              isInverted: true,
            },
          },
        ],
      });
    }, edgeType);
    await expect(
      page.locator('[data-node-id="beta"] [data-flow-property="input"]'),
    ).toBeVisible();
    for (const [id, corners] of [
      ["mapped", 4],
      ["source-only", 2],
      ["target-only", 4],
      ["node-link", 2],
      ["missing-row", 2],
      ["inverted-connected", 4],
      ["inverted-unconnected", 2],
    ] as const) {
      const head = page
        .locator(`.flow-sdk-edge[data-edge-id="${id}"] > path`)
        .nth(1);
      await expect
        .poll(() =>
          head.getAttribute("d").then((path) => path?.match(/L/g)?.length),
        )
        .toBe(corners);
    }
    await page.evaluate(() =>
      window.__flowTest.configure({ edgeMode: "nodes" }),
    );
    for (const id of ["mapped", "target-only", "inverted-connected"]) {
      const head = page
        .locator(`.flow-sdk-edge[data-edge-id="${id}"] > path`)
        .nth(1);
      await expect
        .poll(() =>
          head.getAttribute("d").then((path) => path?.match(/L/g)?.length),
        )
        .toBe(2);
    }
  });
}
