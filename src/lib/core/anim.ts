/** Frame-rate independent exponential approach toward `target`. */
export function approach(current: number, target: number, speed: number, deltaMS: number): number {
  const k = 1 - Math.pow(1 - Math.min(0.99, Math.max(0.01, speed)), deltaMS / 16.67);
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 0.001 ? target : next;
}
