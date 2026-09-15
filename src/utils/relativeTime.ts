import { useSyncExternalStore } from "react";

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "always" });
export function formatTimeAgo(value: string | undefined, now = Date.now()) {
  if (!value) return;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return;
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const units = [[31536000, "year"], [2592000, "month"], [86400, "day"], [3600, "hour"], [60, "minute"]] as const;
  const [size, unit] = units.find(([size]) => seconds >= size)!;
  return relativeTime.format(-Math.floor(seconds / size), unit);
}

let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, 60000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
};
const snapshot = () => now;
const serverSnapshot = () => 0;
export function useTimeAgo(value?: string) {
  const time = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return formatTimeAgo(value, time || Date.now());
}