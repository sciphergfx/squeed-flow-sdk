import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "flow-sdk-consumer-"));
function run(command, args, cwd = directory, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed: ${result.stderr ?? result.status}`);
  return result.stdout;
}

try {
  const [pack] = JSON.parse(
    run(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", directory],
      root,
      true,
    ),
  );
  const files = pack.files.map((file) => file.path);
  for (const file of [
    "LICENSE",
    "README.md",
    "THIRD_PARTY_NOTICES.txt",
    "dist/index.js",
    "dist/index.cjs",
    "dist/index.d.ts",
    "dist/index.d.cts",
  ])
    assert.ok(files.includes(file), `Missing ${file}`);
  assert.ok(!files.some((file) => file.startsWith("tests/")));

  run("npm", [
    "install",
    "--prefix",
    directory,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    join(directory, pack.filename),
    "react@18",
    "react-dom@18",
    "@types/react@18",
    "@types/react-dom@18",
  ]);
  const manifest = JSON.parse(
    await readFile(
      join(directory, "node_modules/@squeed/flow-sdk/package.json"),
      "utf8",
    ),
  );
  const expected = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  assert.equal(manifest.version, expected.version);
  assert.equal(typeof manifest.peerDependencies["markdown-to-jsx"], "string");
  assert.equal(
    manifest.peerDependencies["markdown-to-jsx"],
    expected.peerDependencies["markdown-to-jsx"],
  );
  assert.ok(!("markdown-to-jsx" in manifest.dependencies));
  for (const format of ["js", "cjs"]) {
    const map = JSON.parse(
      await readFile(join(root, `dist/index.${format}.map`), "utf8"),
    );
    assert.ok(
      !map.sources.some((source) => source.includes("markdown-to-jsx")),
      `Markdown was bundled into ${format}`,
    );
  }
  assert.ok(
    !Object.keys(manifest.dependencies).some((name) =>
      name.includes("cytoscape"),
    ),
  );

  for (const format of ["mts", "cts"])
    await copyFile(
      join(root, `tests/package/consumer.${format}`),
      join(directory, `consumer.${format}`),
    );
  run(process.execPath, [
    join(root, "node_modules/typescript/bin/tsc"),
    "--module",
    "Node16",
    "--moduleResolution",
    "Node16",
    "--target",
    "ES2020",
    "--strict",
    "--skipLibCheck",
    "--outDir",
    "compiled",
    "consumer.mts",
    "consumer.cts",
  ]);
  run(process.execPath, ["compiled/consumer.mjs"]);
  run(process.execPath, ["compiled/consumer.cjs"]);
  console.log(
    `${pack.id}: ${files.length} files, ${(pack.size / 1000).toFixed(1)} kB tarball; clean install passed`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
