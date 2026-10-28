import type { ProgressSnapshot } from '../../shared/types';

// Every line we care about comes from our own --print / --progress-template arguments (see worker.ts),
// so the format is fixed instead of scraped from yt-dlp's human-readable output.
export type ParsedLine =
  | { kind: 'item'; title: string; playlistIndex?: number; playlistCount?: number }
  | { kind: 'progress'; progress: Partial<ProgressSnapshot>; tmpFile?: string }
  | { kind: 'postprocess'; name: string; status: string }
  | { kind: 'saved'; filePath: string };

function num(v: string | undefined): number | undefined {
  if (v == null || v === '' || v === 'NA' || v === 'None') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function formatSpeed(bytesPerSec: number): string {
  const kib = bytesPerSec / 1024;
  if (kib < 1024) return `${kib.toFixed(0)} KiB/s`;
  return `${(kib / 1024).toFixed(1)} MiB/s`;
}

export function formatEta(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function parseLine(line: string): ParsedLine | null {
  const l = line.trim();

  if (l.startsWith('[dl] ')) {
    const [done, total, estimate, speed, eta, tmpFile] = l.slice(5).split('|');
    const doneBytes = num(done);
    const totalBytes = num(total) ?? num(estimate);
    const speedBps = num(speed);
    const etaSec = num(eta);
    const progress: Partial<ProgressSnapshot> = { stage: 'download' };
    if (doneBytes != null && totalBytes) progress.percent = Math.min(100, (doneBytes / totalBytes) * 100);
    if (speedBps != null) progress.speed = formatSpeed(speedBps);
    if (etaSec != null) {
      progress.etaSeconds = etaSec;
      progress.eta = formatEta(etaSec);
    }
    return { kind: 'progress', progress, tmpFile: tmpFile && tmpFile !== 'NA' ? tmpFile : undefined };
  }

  if (l.startsWith('[item] ')) {
    const rest = l.slice(7);
    const m = rest.match(/^(\d*)\/(\d*) (.*)$/);
    if (!m) return { kind: 'item', title: rest };
    return { kind: 'item', title: m[3]!.trim(), playlistIndex: num(m[1]), playlistCount: num(m[2]) };
  }

  if (l.startsWith('[pp] ')) {
    const [name = '', status = ''] = l.slice(5).split('|');
    return { kind: 'postprocess', name, status };
  }

  if (l.startsWith('[saved] ')) {
    return { kind: 'saved', filePath: l.slice(8).trim() };
  }

  return null;
}
