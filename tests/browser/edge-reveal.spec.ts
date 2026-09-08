import { expect, test, type Page } from "@playwright/test";
import { ready } from "./helpers";

test("graph edge swatches color strokes and labels and reset to theme defaults", async ({
  page,
}) => {
  await ready(page, "custom=1");
  await page.evaluate(() => {
    window.__flowTest.configure({ colorMode: "dark" });
    window.__flowTest.replaceGraph({
      nodes: ["alpha", "beta", "gamma"].map((id) => ({
        data: { id, type: "text" },
      })),
      edges: [
        {
          data: {
            id: "plain",
            source: "alpha",
            target: "beta",
            label: "Plain",
          },
        },
        {
          data: {
            id: "colored",
            source: "beta",
            target: "gamma",
            label: "Colored",
            color: "#ff0000",
          },
        },
      ],
    });
  });
  const stroke = (id: string) =>
    page.locator(`.flow-sdk-edge[data-edge-id="${id}"] > path`).first();
  const label = (id: string) =>
    page.locator(`.flow-sdk-edge-label[data-edge-id="${id}"] text`);
  await expect(stroke("plain")).toHaveAttribute("stroke", "#71717a");
  await expect(label("plain")).toHaveAttribute("fill", "#71717a");
  await expect(stroke("colored")).toHaveAttribute("stroke", "#ff0000");
  const connector = (id: string) =>
    page.locator(
      `.flow-sdk-edge[data-edge-id="${id}"] > path[fill]:not([fill="none"])`,
    );
  const originalConnectorColor = await connector("plain").getAttribute("fill");
  const toolbar = page.getByRole("toolbar", {
    name: "Diagram controls",
    exact: true,
  });
  await toolbar
    .getByRole("button", { name: "Toggle toolbar collapse", exact: true })
    .click();
  await toolbar
    .getByRole("button", { name: "Graph edge color colors", exact: true })
    .click();
  await toolbar
    .getByRole("button", { name: "Graph edge color blue.500", exact: true })
    .click();
  for (const id of ["plain", "colored"]) {
    await expect(stroke(id)).toHaveAttribute("stroke", "#3b82f6");
    await expect(label(id)).toHaveAttribute("fill", "#3b82f6");
    await expect(connector(id)).toHaveAttribute("fill", "#3b82f6");
  }
  await toolbar
    .getByRole("button", { name: "Reset Graph edge color", exact: true })
    .click();
  await expect(connector("plain")).toHaveAttribute(
    "fill",
    originalConnectorColor!,
  );
  await expect(connector("colored")).toHaveAttribute("fill", "#ff0000");
  await expect(stroke("plain")).toHaveAttribute("stroke", "#71717a");
  await expect(label("plain")).toHaveAttribute("fill", "#71717a");
  await expect(stroke("colored")).toHaveAttribute("stroke", "#ff0000");
  await page.evaluate(() =>
    window.__flowTest.configure({ colorMode: "light" }),
  );
  await expect(stroke("plain")).toHaveAttribute("stroke", "#c6c6c6");
  await expect(label("plain")).toHaveAttribute("fill", "#c6c6c6");
  await expect(connector("plain")).toHaveAttribute("fill", "#c6c6c6");
  await expect(stroke("colored")).toHaveAttribute("stroke", "#ff0000");
  await expect(connector("colored")).toHaveAttribute("fill", "#ff0000");
  await toolbar
    .getByRole("button", { name: "Graph edge color colors", exact: true })
    .click();
  const lightBlack = toolbar.getByRole("button", {
    name: "Graph edge color #c6c6c6",
    exact: true,
  });
  await expect(lightBlack).toBeVisible();
  await expect(lightBlack).toHaveCSS("background-color", "rgb(198, 198, 198)");
  await expect(lightBlack).toHaveAttribute("aria-pressed", "true");
  await lightBlack.click();
  for (const id of ["plain", "colored"]) {
    await expect(stroke(id)).toHaveAttribute("stroke", "#c6c6c6");
    await expect(connector(id)).toHaveAttribute("fill", "#c6c6c6");
  }
  await page.screenshot({
    path: test.info().outputPath("light-edge-color.png"),
  });
  await toolbar
    .getByRole("button", { name: "Reset Graph edge color", exact: true })
    .click();
  await expect(stroke("plain")).toHaveAttribute("stroke", "#c6c6c6");
  await expect(stroke("colored")).toHaveAttribute("stroke", "#ff0000");
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeColor: "#00ff00" }),
  );
  for (const id of ["plain", "colored"]) {
    await expect(stroke(id)).toHaveAttribute("stroke", "#00ff00");
    await expect(connector(id)).toHaveAttribute("fill", "#00ff00");
  }
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeColor: "", colorMode: "dark" }),
  );
  await expect(stroke("plain")).toHaveAttribute("stroke", "#71717a");
  await expect(connector("plain")).toHaveAttribute(
    "fill",
    originalConnectorColor!,
  );
});

const setTime = (page: Page, time: number) =>
  page.evaluate((time) => {
    for (const animation of document.getAnimations())
      if (
        animation instanceof CSSAnimation &&
        animation.animationName.startsWith("flow-sdk-edge-reveal")
      )
        animation.currentTime = time;
  }, time);

for (const direction of ["LR", "RL", "TB", "BT"] as const) {
  for (const inverted of [false, true]) {
    test(`edge reveals toward its arrow in ${direction}, inverted=${inverted}`, async ({
      page,
    }) => {
      await ready(page, "custom=1");
      await page.evaluate(
        ({ direction, inverted }) => {
          window.__flowTest.configure({
            direction,
            edgeColor: "#e60000",
            edgeType: "straight",
            edgeReveal: { durationMs: 1000, paused: true },
          });
          window.__flowTest.replaceGraph({
            nodes: [
              { data: { id: "alpha", type: "text", label: "Source" } },
              { data: { id: "beta", type: "text", label: "Target" } },
            ],
            edges: [
              {
                data: {
                  id: "reveal",
                  source: "alpha",
                  target: "beta",
                  isInverted: inverted,
                },
              },
            ],
          });
        },
        { direction, inverted },
      );
      const mask = page.locator(
        '.flow-sdk-edge[data-edge-id="reveal"] .flow-sdk-edge-reveal',
      );
      await expect(mask).toBeAttached();
      await expect(mask).toHaveCSS(
        "stroke-dashoffset",
        inverted ? "-100px" : "100px",
      );
      await setTime(page, 500);
      await expect(mask).toHaveCSS(
        "stroke-dashoffset",
        inverted ? "-50px" : "50px",
      );
      const edge = page.locator('.flow-sdk-edge[data-edge-id="reveal"]');
      await expect(
        edge.locator(":scope > .flow-sdk-edge-reveal-end"),
      ).toHaveCSS("opacity", "0");
      await page.locator('[data-node-id="alpha"]').screenshot();
      const image = await page.screenshot({
        path: test.info().outputPath("half-revealed.png"),
      });
      const points = await mask.evaluate((element: SVGPathElement) =>
        [0.15, 0.85].map((fraction) => {
          const point = element.getPointAtLength(
            element.getTotalLength() * fraction,
          );
          const screen = new DOMPoint(point.x, point.y).matrixTransform(
            element.getScreenCTM()!,
          );
          return { x: screen.x, y: screen.y };
        }),
      );
      const painted = await page.evaluate(
        async ({ image, points }) => {
          const pixels = Uint8Array.from(atob(image), (character) =>
            character.charCodeAt(0),
          );
          const bitmap = await createImageBitmap(
            new Blob([pixels], { type: "image/png" }),
          );
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext("2d")!;
          context.drawImage(bitmap, 0, 0);
          return points.map((point) => {
            const data = context.getImageData(
              Math.round(point.x) - 2,
              Math.round(point.y) - 2,
              5,
              5,
            ).data;
            for (let offset = 0; offset < data.length; offset += 4)
              if (
                data[offset] > 150 &&
                data[offset + 1] < 90 &&
                data[offset + 2] < 90
              )
                return true;
            return false;
          });
        },
        { image: image.toString("base64"), points },
      );
      expect(painted).toEqual(inverted ? [false, true] : [true, false]);
      await setTime(page, 1000);
      await expect(mask).toHaveCSS("stroke-dashoffset", "0px");
      await expect(
        edge.locator(":scope > .flow-sdk-edge-reveal-end"),
      ).toHaveCSS("opacity", "1");
      await page.evaluate(() => window.__flowTest.resizeNode(260));
      await expect(mask).toHaveCSS("stroke-dashoffset", "0px");
    });
  }
}

test("reveal preserves dashes, pauses, resumes and respects reduced motion", async ({
  page,
}) => {
  await ready(page, "custom=1");
  await expect(page.locator(".flow-sdk-edge-reveal")).toHaveCount(0);
  await page.evaluate(() => {
    window.__flowTest.configure({ edgeReveal: { durationMs: 10000 } });
    window.__flowTest.replaceGraph({
      nodes: [
        { data: { id: "alpha", type: "text" } },
        { data: { id: "beta", type: "text" } },
      ],
      edges: [
        {
          data: {
            id: "dashed",
            source: "alpha",
            target: "beta",
            isEdgeDashed: true,
            label: "Order",
          },
        },
      ],
    });
  });
  const mask = page.locator(".flow-sdk-edge-reveal");
  await expect(mask).toBeAttached();
  await expect(page.locator("g[mask] > path").first()).toHaveAttribute(
    "stroke-dasharray",
    "32 18",
  );
  await setTime(page, 2000);
  const offset = await mask.evaluate(
    (element) => getComputedStyle(element).strokeDashoffset,
  );
  await expect
    .poll(() =>
      mask.evaluate((element) => getComputedStyle(element).strokeDashoffset),
    )
    .not.toBe(offset);
  await page.evaluate(() =>
    window.__flowTest.configure({
      edgeReveal: { durationMs: 10000, paused: true },
    }),
  );
  await expect(mask).toHaveCSS("animation-play-state", "paused");
  const paused = await mask.evaluate(
    (element) => getComputedStyle(element).strokeDashoffset,
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const next = () => {
          if (++frames === 12) resolve();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      }),
  );
  await expect(mask).toHaveCSS("stroke-dashoffset", paused);
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeReveal: { durationMs: 10000 } }),
  );
  await expect
    .poll(() =>
      mask.evaluate((element) => getComputedStyle(element).strokeDashoffset),
    )
    .not.toBe(paused);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(mask).toHaveCSS("animation-name", "none");
  await expect(mask).toHaveCSS("stroke-dashoffset", "0px");
  await expect(page.locator(".flow-sdk-edge-label")).toHaveCSS("opacity", "1");
  await page.evaluate(() =>
    window.__flowTest.configure({ edgeReveal: undefined }),
  );
  await expect(mask).toHaveCount(0);
  await expect(
    page.locator('.flow-sdk-edge[data-edge-id="dashed"] > path').first(),
  ).toHaveAttribute("stroke-dasharray", "32 18");
});
