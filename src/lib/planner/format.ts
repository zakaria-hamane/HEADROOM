import type { Gpu } from "@/lib/engine";

/** Number formatting used across the planner (same rules as the original tool). */
export function nf(x: number, d: number): string {
  if (x === Infinity) return "∞";
  if (!isFinite(x)) return "–";
  return x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function gb(x: number): string {
  return nf(x, Math.abs(x) >= 10 ? 1 : 2) + " GB";
}
export function spd(v: number): string {
  return nf(v, v >= 100 ? 0 : v >= 1 ? 1 : 2);
}
export function tm(t: number): string {
  if (!isFinite(t)) return "–";
  if (t < 1) return nf(t * 1000, 0) + " ms";
  if (t < 10) return nf(t, 2) + " s";
  if (t < 120) return nf(t, 1) + " s";
  return nf(t / 60, 1) + " min";
}
export function ms(t: number): string {
  return nf(t * 1000, t < 0.01 ? 2 : t < 1 ? 1 : 0) + " ms";
}
export function pc(x: number, d = 0): string {
  return nf(x * 100, d) + "%";
}
export function money(x: number | null | undefined): string {
  return x == null || !isFinite(x) ? "–" : "$" + (x >= 100 ? nf(x, 0) : nf(x, 2));
}
export function fmtP(b: number): string {
  return b >= 100 ? nf(b, 0) + "B" : b >= 10 ? nf(b, 1) + "B" : nf(b, 2) + "B";
}
export function gpuLabel(g: Pick<Gpu, "name">): string {
  return (g.name || "GPU").replace(/^NVIDIA /, "").replace(/^AMD /, "");
}
export function duration(seconds: number): string {
  if (!isFinite(seconds)) return "–";
  if (seconds < 3600) return nf(seconds / 60, 0) + " min";
  if (seconds < 86400 * 3) return nf(seconds / 3600, 1) + " h";
  return nf(seconds / 86400, 1) + " days";
}
export function compact(x: number): string {
  if (!isFinite(x)) return "–";
  if (Math.abs(x) >= 1e9) return nf(x / 1e9, 1) + "B";
  if (Math.abs(x) >= 1e6) return nf(x / 1e6, 1) + "M";
  if (Math.abs(x) >= 1e4) return nf(x / 1e3, 0) + "K";
  return nf(x, 0);
}
