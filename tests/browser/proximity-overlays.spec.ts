import { test, expect } from "@playwright/test";
import { buildSync } from "esbuild";
import { fileURLToPath } from "node:url";

const bundle = buildSync({
  stdin: {
    contents: `
      import React, { useRef, useState } from "react";
      import { createRoot } from "react-dom/client";
      import { createPortal } from "react-dom";
      import { useEdgeProximity } from "./src/hooks/useEdgeProximity";
      function Fixture() {
        const bounds = useRef(null);
        const [enabled, setEnabled] = useState(true);
        const [open, setOpen] = useState(false);
        const top = useEdgeProximity({ edge: "top", enabled, bounds });
        const bottom = useEdgeProximity({ edge: "bottom", enabled, bounds });
        return <div ref={bounds} style={{position:"fixed",inset:0}}>
          <output id="top" data-visible={top} />
          <output id="bottom" data-visible={bottom} />
          <div style={{position:"absolute",top:"40%",left:"40%"}}>
            <button id="native" onClick={() => document.getElementById("dropdown").showPopover()}>Native dropdown</button>
            <button id="portal" onClick={() => setOpen(true)}>Portal dropdown</button>
            <button id="disable" onClick={() => setEnabled(false)}>Disable</button>
          </div>
          <div id="dropdown" popover="auto" role="listbox" style={{padding:40}}>
            <button id="close-native" onClick={() => document.getElementById("dropdown").hidePopover()}>Close</button>
          </div>
          <div role="menu" hidden>Hidden menu</div>
          {open && createPortal(<div role="menu" data-state="open" style={{position:"fixed",top:"60%",left:"40%",padding:30}}>
            <button id="close-portal" onClick={() => setOpen(false)}>Close</button>
          </div>, document.body)}
        </div>;
      }
      createRoot(document.getElementById("root")).render(<Fixture />);
    `,
    loader: "tsx",
    resolveDir: fileURLToPath(new URL("../../", import.meta.url)),
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
}).outputFiles[0].text;

test.beforeEach(async ({ page }) => {
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle });
});

for (const kind of ["native", "portal"]) {
  test(`${kind} dropdown holds both bars until closed`, async ({ page }) => {
    await expect(page.locator("#top")).toHaveAttribute("data-visible", "false");
    await expect(page.locator("#bottom")).toHaveAttribute("data-visible", "false");
    await page.locator(`#${kind}`).focus();
    await page.keyboard.press("Enter");
    await page.mouse.move(100, 400);
    await expect(page.locator("#top")).toHaveAttribute("data-visible", "true");
    await expect(page.locator("#bottom")).toHaveAttribute("data-visible", "true");
    await page.locator(`#close-${kind}`).click();
    await expect(page.locator("#top")).toHaveAttribute("data-visible", "false");
    await expect(page.locator("#bottom")).toHaveAttribute("data-visible", "false");
  });
}

test("proximity resumes after closing and disabled hooks stay inactive", async ({ page }) => {
  await page.mouse.move(100, 10);
  await expect(page.locator("#top")).toHaveAttribute("data-visible", "true");
  await page.mouse.move(100, 890);
  await expect(page.locator("#top")).toHaveAttribute("data-visible", "false");
  await expect(page.locator("#bottom")).toHaveAttribute("data-visible", "true");
  await page.locator("#portal").click();
  await page.locator("#disable").click();
  await expect(page.locator("#top")).toHaveAttribute("data-visible", "false");
  await expect(page.locator("#bottom")).toHaveAttribute("data-visible", "false");
});