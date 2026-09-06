import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createJsonPlayback,
  type JsonPlaybackState,
} from "../src/core/jsonStream";
import { projectJsonPlaybackPreview } from "../src/core/jsonPlaybackPreview";

test("partial playback metadata cannot leak incomplete state references to renderers", () => {
  const document = {
    task: {
      $label: { $state: "root.title" },
      $form: { type: "Task" },
      value: "Ready",
    },
  };
  assert.deepEqual(
    projectJsonPlaybackPreview({ task: { $label: { $stat: "" } } }, document),
    { task: {} },
  );
  assert.deepEqual(
    projectJsonPlaybackPreview(
      {
        task: { $label: { $state: "root.t" }, $form: null, value: "Re" },
        ta: {},
      },
      document,
    ),
    { task: { value: "Re" } },
  );
  assert.deepEqual(projectJsonPlaybackPreview(document, document), document);
});

test("playback pauses, seeks backwards, resumes to the exact end and replays", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const source = JSON.stringify({
    first: { label: "First" },
    last: { label: "Last" },
  });
  let state: JsonPlaybackState;
  const commits: unknown[] = [];
  const snapshots: string[] = [];
  const player = createJsonPlayback({
    source,
    durationMs: 1000,
    tickMs: 100,
    parse: JSON.parse,
    repair: (partial) => {
      snapshots.push(partial);
      return "{}";
    },
    preview: () => {},
    commit: (value) => commits.push(value),
    onChange: (next) => {
      state = next;
    },
    onError: (error) => {
      throw error;
    },
  });
  player.play();
  context.mock.timers.tick(100);
  assert.ok(state!.position > 0 && state!.position < source.length);
  player.pause();
  const paused = state!.position;
  context.mock.timers.tick(500);
  assert.equal(state!.position, paused);
  player.seek(2);
  assert.equal(snapshots.at(-1), source.slice(0, 2));
  assert.equal(state!.playing, false);
  player.play();
  for (let tick = 0; tick < 20; tick++) context.mock.timers.tick(100);
  assert.deepEqual(commits, [JSON.parse(source)]);
  assert.deepEqual(state!, {
    position: source.length,
    total: source.length,
    playing: false,
  });
  player.play();
  assert.equal(state!.position, 0);
  player.dispose();
  context.mock.timers.tick(500);
  assert.equal(commits.length, 1);
});

test("playback validates full input and reports completion failures", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const errors: unknown[] = [];
  const options = {
    source: "{}",
    parse: JSON.parse,
    repair: (value: string) => value,
    preview: () => {},
    commit: () => {
      throw new Error("Commit rejected");
    },
    onChange: () => {},
    onError: (error: unknown) => errors.push(error),
  };
  assert.throws(() => createJsonPlayback({ ...options, source: "{" }));
  assert.throws(
    () => createJsonPlayback({ ...options, maxBytes: 1 }),
    /size limit/,
  );
  assert.throws(() => createJsonPlayback({ ...options, tickMs: 0 }), /timing/);
  const player = createJsonPlayback(options);
  player.seek(2);
  assert.equal((errors[0] as Error).message, "Commit rejected");
  player.dispose();
});
