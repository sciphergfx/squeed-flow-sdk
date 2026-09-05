# Contributing

Thanks for contributing to @squeed/flow-sdk. Keep changes focused and discuss
large features or breaking API changes in an issue before implementing them.

## Local Setup

Use Node.js 22 LTS and npm. From a clone of this repository:

```bash
npm ci
npx playwright install chromium
npm run build
```

On Linux, Playwright may also require system libraries:
`npx playwright install --with-deps chromium`.

The browser fixture is a standalone development preview; no Backflow app,
account, or credentials are required. Run these in separate terminals:

```bash
npm run dev
```

```bash
npm run test:serve
```

Open http://127.0.0.1:4196. The first command watches and rebuilds the SDK;
the second serves the fixture against the built package. Stop the preview
server before running browser tests, which manage their own server on port 4196.

## Repository Layout

- `src/core`: JSON compilation, immutable document edits, and callback binding.
- `src/engine`: layout, viewport, gestures, and DOM/SVG rendering.
- `src/components`: public diagram components, context, and toolbars.
- `src/nodes`: node views and inline editors.
- `src/types`, `src/theme`, `src/hooks`, `src/utils`: contracts and shared helpers.
- `tests`: unit tests, browser fixtures/tests, and clean-package consumers.
- `scripts`: build finalization; `dist` is generated output.

## Changes And Tests

Reuse nearby components and helpers. Preserve public API compatibility unless
a breaking change has been agreed upon. Add a regression test for bug fixes
and update the README when changing public props, callbacks, or JSON keys.
Respect file-local instructions; AI-assisted changes must not modify the
protected `src/core/createFlowDiagram*.ts` compiler files.

Start with the smallest relevant check:

```bash
npm run typecheck
npm run test:unit
npm run build
npx playwright test tests/browser/node-content.spec.ts
```

Browser tests load `dist`, so rebuild after source changes. Before submitting
a pull request, run the full release checks:

```bash
npm run check:release
npm pack --dry-run
```

These verify unit/browser behavior, ESM and CommonJS types and runtime in a
clean tarball install, and production dependency advisories. Packing runs the
build; it does not publish to npm. Do not commit generated bundles, dependency
directories, browser artifacts, credentials, or unrelated formatting changes.
Include lockfile changes when changing dependencies.

## Issues And Pull Requests

Report ordinary bugs at https://github.com/sciphergfx/flow-sdk/issues with a
minimal reproduction, SDK and peer versions, browser/OS, expected behavior,
and actual behavior. Remove private data from sample documents and logs.

Pull requests should explain the problem, scope, compatibility impact, and
checks run. Include desktop/mobile screenshots for visible UI changes. Note
any tests that could not be run. Do not publish packages or bump versions as
part of unrelated changes; releases are managed separately.

For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of posting
exploit details in public issues. Contributions are provided under the
repository's [AGPL-3.0 license](LICENSE).