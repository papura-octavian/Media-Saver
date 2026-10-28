import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

export type BinaryLocations = {
  ytDlpPath: string;
  ffmpegPath: string;
  ffprobePath?: string;
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function candidatePaths(resourcesPath: string, appPath: string, exeName: string): string[] {
  const rel = path.join('resources', 'bin', exeName);
  return [
    path.join(resourcesPath, 'bin', exeName),
    path.join(resourcesPath, exeName),
    path.join(appPath, 'resources', 'bin', exeName),
    path.join(appPath, rel),
    path.join(process.cwd(), 'resources', 'bin', exeName)
  ];
}

export async function findBinaries(resourcesPath: string, appPath: string): Promise<BinaryLocations> {
  const ytDlpExe = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const ffmpegExe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const ffprobeExe = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';

  const ytCandidates = candidatePaths(resourcesPath, appPath, ytDlpExe);
  const ffCandidates = candidatePaths(resourcesPath, appPath, ffmpegExe);
  const fpCandidates = candidatePaths(resourcesPath, appPath, ffprobeExe);

  const ytDlpPath = (await firstExisting(ytCandidates)) ?? '';
  const ffmpegPath = (await firstExisting(ffCandidates)) ?? '';
  const ffprobePath = (await firstExisting(fpCandidates)) ?? undefined;

  if (!ytDlpPath) {
    throw new Error(
      `yt-dlp not found. Place it at resources/bin/${ytDlpExe} (dev) or bundle via extraResources to ${'${process.resourcesPath}'}/bin/${ytDlpExe}.`
    );
  }
  if (!ffmpegPath) {
    throw new Error(
      `ffmpeg not found. Place it at resources/bin/${ffmpegExe} (dev) or bundle via extraResources to ${'${process.resourcesPath}'}/bin/${ffmpegExe}.`
    );
  }

  return { ytDlpPath, ffmpegPath, ffprobePath };
}

async function firstExisting(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    if (await exists(p)) return p;
  }
  return null;
}

function run(exe: string, args: string[], timeoutMs: number): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(exe, args, { windowsHide: true });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (d) => (out += d.toString('utf-8')));
    child.stderr.on('data', (d) => (out += d.toString('utf-8')));
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ code: null, out });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
  });
}

const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

// YouTube changes often and a yt-dlp that is a few weeks old stops working, so the bundled copy is only a seed:
// we run a writable copy from userData and let it update itself (yt-dlp -U) at most once a day.
// Any failure here falls back to the bundled binary, so downloads never depend on the update succeeding.
export async function prepareYtDlp(
  bundledPath: string,
  userDataPath: string,
  log: (level: 'debug' | 'info', message: string) => void
): Promise<string> {
  if (process.platform !== 'win32' || !userDataPath) return bundledPath;

  const dir = path.join(userDataPath, 'bin');
  const localPath = path.join(dir, 'yt-dlp.exe');
  const stampPath = path.join(dir, 'yt-dlp.last-update');

  try {
    await fs.mkdir(dir, { recursive: true });

    if (!(await exists(localPath))) {
      await fs.copyFile(bundledPath, localPath);
    } else {
      // An app update may ship a newer yt-dlp than the copy we updated earlier (versions are YYYY.MM.DD).
      const [bundled, local] = await Promise.all([run(bundledPath, ['--version'], 20_000), run(localPath, ['--version'], 20_000)]);
      if (local.code !== 0 || (bundled.code === 0 && bundled.out.trim() > local.out.trim())) {
        await fs.copyFile(bundledPath, localPath);
        await fs.rm(stampPath, { force: true });
      }
    }

    const last = Number(await fs.readFile(stampPath, 'utf-8').catch(() => '0'));
    if (Date.now() - last > UPDATE_INTERVAL_MS) {
      log('debug', 'Checking for yt-dlp updates…');
      const res = await run(localPath, ['-U', '--update-to', 'stable'], 60_000);
      const summary = res.out
        .split(/\r?\n/)
        .filter((l) => /updat|latest/i.test(l))
        .at(-1)
        ?.trim();
      if (res.code === 0) {
        await fs.writeFile(stampPath, String(Date.now()), 'utf-8');
        if (summary) log(/Updated yt-dlp/i.test(summary) ? 'info' : 'debug', summary);
      } else {
        log('debug', `yt-dlp update check failed${summary ? `: ${summary}` : ''}`);
        // A failed self-update can leave a half-written exe behind.
        if ((await run(localPath, ['--version'], 20_000)).code !== 0) return bundledPath;
      }
    }
    return localPath;
  } catch (e) {
    log('debug', `yt-dlp self-update skipped: ${e instanceof Error ? e.message : String(e)}`);
    return bundledPath;
  }
}
