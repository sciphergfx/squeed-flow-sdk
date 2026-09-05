import { build } from "esbuild";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(join(tmpdir(), "flow-sdk-tests-"));
try {
  const entries = (await readdir(new URL("./", import.meta.url)))
    .filter((name) => name.endsWith(".test.ts"))
    .map((name) => new URL(name, import.meta.url).pathname);
  await build({
    entryPoints: entries,
    bundle: true,
    platform: "node",
    format: "cjs",
    outdir: directory,
    outExtension: { ".js": ".cjs" },
    logLevel: "warning",
  });
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      ...entries.map((entry) =>
        join(directory, `${basename(entry, ".ts")}.cjs`),
      ),
    ],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
