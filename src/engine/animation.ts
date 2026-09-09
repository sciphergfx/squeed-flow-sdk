export function motionEnabled(animate: boolean, disabled = false): boolean {
  return (
    animate &&
    !disabled &&
    typeof requestAnimationFrame !== "undefined" &&
    !(
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
  );
}

export function animateTransition(
  animate: boolean,
  update: (progress: number) => void,
  complete: () => void = () => {},
  duration = 300,
): () => void {
  let frame: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
  const finish = () => {
    if (cancelled) return;
    cancel();
    update(1);
    complete();
  };
  if (!motionEnabled(animate)) {
    finish();
    return cancel;
  }
  const start = performance.now();
  const step = (now: number) => {
    if (cancelled) return;
    const progress = Math.max(0, Math.min(1, (now - start) / duration));
    if (progress >= 1) return finish();
    update(
      progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2,
    );
    if (!cancelled) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  timer = setTimeout(finish, duration + 100);
  return cancel;
}
