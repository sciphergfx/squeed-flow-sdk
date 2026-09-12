import { expect, test } from "@playwright/test";
import { ready } from "./helpers";

for (const width of [1440, 390]) {
  test(`Fill entry keeps zoom and resizing coordinated at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, 'custom=1');
    await page.evaluate(() => {
      window.__flowTest.replaceGraph({ nodes: ['alpha', 'beta'].map(id => ({ data: {
        id, type: 'text', label: id, viewProps: { width: 800, height: 400 },
      } })), edges: [] });
    });
    await expect.poll(() => page.evaluate(() => window.__flowTest.engine!.getNodeBox('alpha')?.w)).toBe(800);
    const motion = await page.evaluate(() => new Promise<{ zoomProgress: number; sizeProgress: number; ideal: number }[]>(resolve => {
      const engine = window.__flowTest.engine!;
      engine.setNodeGridMode(true, { fill: false, gaps: 0, animate: false });
      engine.zoom(0.5);
      engine.pan({ x: 100, y: 80 });
      const fromWidth = engine.getNodeBox('alpha')!.w;
      const targetWidth = document.querySelector<HTMLElement>('.flow-sdk-canvas')!.clientWidth / 2;
      const options = { fill: true, columns: 2, gaps: 0, animate: true };
      const samples: { zoomProgress: number; sizeProgress: number; ideal: number }[] = [];
      const start = performance.now();
      engine.setNodeGridMode(true, options);
      setTimeout(() => engine.arrangeNodesInGrid(options), 90);
      setTimeout(() => engine.arrangeNodesInGrid(options), 180);
      const sample = () => {
        const elapsed = performance.now() - start;
        const progress = Math.min(1, elapsed / 300);
        samples.push({ zoomProgress: (engine.zoom() - 0.5) / 0.5,
          sizeProgress: (engine.getNodeBox('alpha')!.w - fromWidth) / (targetWidth - fromWidth),
          ideal: progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2 });
        if (elapsed > 650) resolve(samples);
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }));
    expect(motion.filter(sample => sample.zoomProgress > 0 && sample.zoomProgress < 1).length).toBeGreaterThan(3);
    expect(Math.max(...motion.map(sample => Math.abs(sample.zoomProgress - sample.sizeProgress)))).toBeLessThan(0.02);
    expect(Math.max(...motion.map(sample => Math.abs(sample.ideal - sample.sizeProgress)))).toBeLessThan(0.15);
  });
  for (const hidden of [false, true]) {
    test(`Fill allocates before content mounts at ${width}px, hidden=${hidden}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await ready(page, "custom=1");
      await page.evaluate(() => window.__flowTest.mount(false));
      await expect(page.locator('.flow-sdk-canvas')).toHaveCount(0);
      await page.evaluate(({ hidden }) => {
        const { createElement } = window.__flowTest;
        const state = window as typeof window & { fillMounts: { id: string; width: number; height: number; fill: boolean }[]; naturalRenders: number };
        state.fillMounts = [];
        state.naturalRenders = 0;
        const Natural = ({ data }) => {
          state.naturalRenders++;
          return createElement('div', { style: { width: 260, height: 180 } }, data.label);
        };
        const Filled = ({ data }) => createElement('div', {
          'data-fill-probe': data.id,
          style: { width: '100%', height: '100%' },
          ref: element => {
            if (!element) return;
            const host = element.closest('.flow-sdk-node');
            state.fillMounts.push({ id: data.id, width: host.offsetWidth, height: host.offsetHeight, fill: host.hasAttribute('data-grid-fill') });
          },
        }, data.label);
        const holder = document.querySelector<HTMLElement>('[data-testid="diagram"]')!;
        if (hidden) holder.style.display = 'none';
        window.__flowTest.replaceGraph({
          nodes: ['first', 'second', 'third'].map(id => ({ data: { id, type: 'text', label: id } })), edges: [],
        });
        window.__flowTest.configure({ customViews: { text: Natural, fillNode: Filled },
          nodeGrid: { enabled: true, options: { fill: true, columns: 2, gaps: 12,
            adjustment: { sections: { canvas: { rows: [2, 1], columns: [[1, 3], [1]] } } } } },
          initialViewport: { zoom: 1, pan: { x: 0, y: 0 } },
        });
        window.__flowTest.mount(true);
      }, { hidden });
      await expect(page.locator('.flow-sdk-canvas')).toBeAttached();
      if (hidden) {
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        expect(await page.evaluate(() => ({ natural: (window as any).naturalRenders, fills: (window as any).fillMounts.length }))).toEqual({ natural: 0, fills: 0 });
        await page.locator('[data-testid="diagram"]').evaluate((element: HTMLElement) => { element.style.display = ''; });
      }
      await expect(page.locator('[data-fill-probe]')).toHaveCount(3);
      expect(await page.evaluate(() => (window as any).naturalRenders)).toBe(0);
      const mounts = await page.evaluate(() => (window as any).fillMounts);
      expect(mounts.length).toBeGreaterThanOrEqual(3);
      expect(mounts.every(mount => mount.width > 1 && mount.height > 1 && mount.fill)).toBe(true);
      const geometry = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLElement>('.flow-sdk-canvas')!;
        const expected = window.__flowTest.arrangeNodesInGrid({
          nodes: ['first', 'second', 'third'].map(id => ({ id })),
          positions: new Map(['first', 'second', 'third'].map(id => [id, { x: 0, y: 0 }])),
          sizes: new Map(), padding: () => 0, fixedIds: new Set(), viewportSize: { w: canvas.clientWidth, h: canvas.clientHeight },
        }, { fill: true, columns: 2, gaps: 12,
          adjustment: { sections: { canvas: { rows: [2, 1], columns: [[1, 3], [1]] } } } });
        return [...expected.sizes].map(([id, size]) => ({ actual: window.__flowTest.engine!.getNodeBox(id), expected: { ...expected.positions.get(id), ...size } }));
      });
      for (const { actual, expected } of geometry) for (const key of ['x', 'y', 'w', 'h']) expect(actual[key]).toBeCloseTo(expected[key], 1);
      await page.screenshot({ path: test.info().outputPath('destination-fill.png') });
      await page.evaluate(() => window.__flowTest.engine!.setNodeGridMode(true, { fill: false, gaps: 12, animate: false }));
      await expect(page.locator('[data-fill-probe]')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => window.__flowTest.engine!.getNodeBox('first')?.w)).toBe(260);
      await expect.poll(() => page.evaluate(() => window.__flowTest.engine!.getNodeBox('first')?.h)).toBe(180);
    });
  }
  for (const animate of [false, true]) {
    test(`collision entry centers with 80px padding at ${width}px, animate=${animate}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await ready(page, "custom=1");
      await page.evaluate(() => {
        window.__flowTest.events.length = 0;
        window.__flowTest.replaceGraph({
          nodes: Array.from({ length: 8 }, (_, index) => ({
            data: { id: `node-${index}`, type: "text", label: `Node ${index + 1}`, viewProps: { width: 260, height: 180 } },
          })),
          edges: [],
        });
      });
      await page.waitForFunction(() => window.__flowTest.events.some((event) => event.name === "layout-complete"));
      const previous = await page.evaluate((animate) => {
        const engine = window.__flowTest.engine!;
        engine.zoom(0.2);
        engine.pan({ x: 900, y: -700 });
        const previous = { zoom: engine.zoom(), pan: engine.pan() };
        engine.setNodeGridMode(true, { gaps: 15, animate });
        return previous;
      }, animate);
      await expect.poll(() => page.evaluate(() => {
        const canvas = document.querySelector(".flow-sdk-canvas")!.getBoundingClientRect();
        const boxes = [...document.querySelectorAll(".flow-sdk-node")].map((node) => node.getBoundingClientRect());
        const left = Math.min(...boxes.map((box) => box.left)) - canvas.left;
        const right = canvas.right - Math.max(...boxes.map((box) => box.right));
        const top = Math.min(...boxes.map((box) => box.top)) - canvas.top;
        const bottom = canvas.bottom - Math.max(...boxes.map((box) => box.bottom));
        return Math.max(Math.abs(left - right), Math.abs(top - bottom), Math.abs(Math.min(left, right, top, bottom) - 80));
      })).toBeLessThan(1);
      const centered = await page.evaluate(() => ({ zoom: window.__flowTest.engine!.zoom(), pan: window.__flowTest.engine!.pan() }));
      await page.evaluate(() => window.__flowTest.engine!.setNodeGridMode(true, { gaps: 30, animate: false }));
      expect(await page.evaluate(() => ({ zoom: window.__flowTest.engine!.zoom(), pan: window.__flowTest.engine!.pan() }))).toEqual(centered);
      await page.evaluate(() => window.__flowTest.engine!.setNodeGridMode(false, { animate: false }));
      const restored = await page.evaluate(() => ({ zoom: window.__flowTest.engine!.zoom(), pan: window.__flowTest.engine!.pan() }));
      expect(restored.zoom).toBeCloseTo(previous.zoom, 8);
      expect(restored.pan.x).toBeCloseTo(previous.pan.x, 8);
      expect(restored.pan.y).toBeCloseTo(previous.pan.y, 8);
    });
  }
}