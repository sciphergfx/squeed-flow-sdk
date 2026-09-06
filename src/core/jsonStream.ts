export interface JsonStreamOptions<Document> {
  parse: (source: string) => Document;
  repair: (source: string) => string;
  preview: (document: Document) => void;
  commit: (document: Document) => void;
  intervalMs?: number;
  maxBytes?: number;
}

export function createJsonStream<Document>(
  options: JsonStreamOptions<Document>,
) {
  let source = "";
  let closed = false;
  let lastPreview = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const flush = () => {
    clear();
    if (closed || !source.trim()) return;
    try {
      const value = options.parse(options.repair(source));
      const signature = JSON.stringify(value);
      if (signature === lastPreview) return;
      options.preview(value);
      lastPreview = signature;
    } catch {}
  };
  const snapshot = (text: string) => {
    if (closed) return;
    if (
      new TextEncoder().encode(text).byteLength >
      (options.maxBytes ?? 1024 * 1024)
    ) {
      closed = true;
      clear();
      throw new Error("JSON stream exceeds the size limit.");
    }
    source = text;
    if (!timer) timer = setTimeout(flush, options.intervalMs ?? 150);
  };
  return {
    snapshot,
    append(chunk: string) {
      snapshot(source + chunk);
    },
    flush,
    finish() {
      if (closed) throw new Error("JSON stream is closed.");
      closed = true;
      clear();
      const value = options.parse(source);
      options.commit(value);
      return value;
    },
    cancel() {
      closed = true;
      clear();
      source = "";
    },
  };
}

export interface JsonPlaybackState {
  position: number;
  total: number;
  playing: boolean;
}

export function createJsonPlayback<Document>(
  options: JsonStreamOptions<Document> & {
    source: string;
    durationMs?: number;
    tickMs?: number;
    onChange: (state: JsonPlaybackState) => void;
    onError: (error: unknown) => void;
  },
) {
  const { source } = options;
  const tickMs = options.tickMs ?? 50;
  const durationMs = options.durationMs ?? 8000;
  if (
    !Number.isFinite(tickMs) ||
    tickMs <= 0 ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0
  )
    throw new Error("Playback timing must be positive.");
  if (
    new TextEncoder().encode(source).byteLength >
    (options.maxBytes ?? 1024 * 1024)
  )
    throw new Error("JSON stream exceeds the size limit.");
  options.parse(source);
  let stream = createJsonStream(options);
  let position = 0;
  let playing = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const chunkSize = Math.max(
    1,
    Math.ceil((source.length * tickMs) / durationMs),
  );
  const notify = () =>
    options.onChange({ position, total: source.length, playing });
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const render = (flush = false) => {
    stream.snapshot(source.slice(0, position));
    if (position === source.length) {
      playing = false;
      clear();
      stream.finish();
    } else if (flush) stream.flush();
  };
  const fail = (error: unknown) => {
    playing = false;
    clear();
    stream.cancel();
    notify();
    options.onError(error);
  };
  const tick = () => {
    timer = undefined;
    if (!playing || disposed) return;
    position = Math.min(source.length, position + chunkSize);
    try {
      render();
    } catch (error) {
      fail(error);
      return;
    }
    notify();
    if (playing) timer = setTimeout(tick, tickMs);
  };
  return {
    play() {
      if (disposed || playing) return;
      if (position === source.length) {
        stream.cancel();
        stream = createJsonStream(options);
        position = 0;
      }
      playing = true;
      notify();
      timer = setTimeout(tick, tickMs);
    },
    pause() {
      if (disposed) return;
      playing = false;
      clear();
      stream.flush();
      notify();
    },
    seek(next: number) {
      if (disposed) return;
      if (!Number.isFinite(next))
        throw new Error("Playback position must be finite.");
      clear();
      position = Math.max(0, Math.min(source.length, Math.round(next)));
      stream.cancel();
      stream = createJsonStream(options);
      try {
        render(true);
      } catch (error) {
        fail(error);
        return;
      }
      notify();
      if (playing) timer = setTimeout(tick, tickMs);
    },
    dispose() {
      disposed = true;
      playing = false;
      clear();
      stream.cancel();
    },
  };
}
