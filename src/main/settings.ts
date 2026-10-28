import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Settings } from '../shared/types';

const DEFAULT_SETTINGS: Settings = {
  destinationDir: '',
  format: 'mp3',
  mp3BitrateKbps: 192,
  youtubeClient: 'default',
  useCookiesFromBrowser: false,
  cookiesBrowser: 'chrome',
  userAgent: '',
  verbose: false
};

// Bump when a stored value needs migrating (see readSettingsFile).
const SETTINGS_VERSION = 2;

type StoredSettings = Partial<Settings> & { version?: number };

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

async function readSettingsFile(): Promise<Settings | null> {
  try {
    const p = settingsPath();
    const raw = await fs.readFile(p, 'utf-8');
    const parsed = JSON.parse(raw) as StoredSettings;
    // v1 defaulted to the 'android' client, which YouTube no longer serves formats to.
    if ((parsed.version ?? 1) < 2 && parsed.youtubeClient === 'android') parsed.youtubeClient = 'default';
    delete parsed.version;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return null;
  }
}

// Writes are chained and go through a temp file, so quick successive patches (typing in a field)
// can neither interleave nor leave a half-written settings.json behind.
let writeChain: Promise<void> = Promise.resolve();

function writeSettingsFile(settings: Settings): Promise<void> {
  const next = writeChain.then(async () => {
    const p = settingsPath();
    await fs.mkdir(path.dirname(p), { recursive: true });
    const tmp = `${p}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ ...settings, version: SETTINGS_VERSION }, null, 2), 'utf-8');
    await fs.rename(tmp, p);
  });
  writeChain = next.catch(() => {});
  return next;
}

let cached: Settings | null = null;

export async function getSettings(): Promise<Settings> {
  if (cached) return cached;
  const fromDisk = await readSettingsFile();
  cached = fromDisk ?? DEFAULT_SETTINGS;
  await writeSettingsFile(cached);
  return cached;
}

export async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  cached = { ...current, ...patch };
  await writeSettingsFile(cached);
  return cached;
}
