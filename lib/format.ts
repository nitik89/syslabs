export function fmtRps(x: number): string {
  if (x >= 10000) return `${(x / 1000).toFixed(x >= 100000 ? 0 : 1)}k`;
  return Math.round(x).toLocaleString("en-US");
}

export function fmtPct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtMs(x: number | null): string {
  if (x === null) return "n/a";
  return x >= 100 ? `${Math.round(x)} ms` : `${x.toFixed(1)} ms`;
}

export function fmtUsd(x: number): string {
  return `$${Math.round(x).toLocaleString("en-US")}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
