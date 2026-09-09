/** requestAnimationFrame timestamps can precede a performance.now() startup sample. */
export function advanceFrameClock(now: number, last: number) {
  const timestamp = Number.isFinite(now) ? Math.max(last, now) : last;
  const delta =
    last === 0 ? 0.016 : Math.max(0, Math.min(0.05, (timestamp - last) / 1000));
  return { timestamp, delta };
}
