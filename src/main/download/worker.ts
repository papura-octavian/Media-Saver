import { parentPort, workerData } from 'node:worker_threads';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { DownloadEvent, DownloadOptions, ProgressSnapshot } from '../../shared/types';
import { findBinaries, prepareYtDlp, type BinaryLocations } from './binaries';
import { parseLine } from './progressParse';

type WorkerData = { appPath: string; resourcesPath: string; userDataPath: string };
const ctx = workerData as WorkerData;

type Command =
  | { type: 'startSingle'; url: string; options: DownloadOptions }
  | { type: 'startBatch'; urls: string[]; options: DownloadOptions }
  | { type: 'cancel' };

// Internal message for DownloadManager: the running yt-dlp's pid, so the app can kill it on quit.
export type ChildPidMessage = { type: 'childPid'; pid: number | null };

function emit(evt: DownloadEvent) {
  parentPort?.postMessage(evt);
}

function setChild(child: ChildProcessWithoutNullStreams | null) {
  currentChild = child;
  parentPort?.postMessage({ type: 'childPid', pid: child?.pid ?? null } satisfies ChildPidMessage);
}

let cancelRequested = false;
let currentChild: ChildProcessWithoutNullStreams | null = null;

async function killProcessTree(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
    });
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {}
}

function classify(line: string): 'debug' | 'info' | 'warn' | 'error' {
  const l = line.toLowerCase();
  if (l.includes('error:')) return 'error';
  if (l.includes('warning:')) return 'warn';
  return 'debug';
}

// Resolve binaries and refresh yt-dlp as soon as the worker starts, so it is ready by the time the user hits Start.
const binariesReady: Promise<BinaryLocations> = (async () => {
  const bins = await findBinaries(ctx.resourcesPath, ctx.appPath);
  const ytDlpPath = await prepareYtDlp(bins.ytDlpPath, ctx.userDataPath, (level, message) =>
    emit({ type: 'log', level, message })
  );
  return { ...bins, ytDlpPath };
})();
binariesReady.catch(() => {}); // surfaced when a job awaits it

// yt-dlp needs a JavaScript runtime for YouTube. Electron is one: with ELECTRON_RUN_AS_NODE it behaves like Node.
const jsRuntime = process.versions.electron && Number(process.versions.node.split('.')[0]) >= 22 ? process.execPath : null;

function buildArgs(options: DownloadOptions, ffmpegPath: string, url: string): string[] {
  const args: string[] = [];
  args.push('--no-color', '--newline', '--encoding', 'utf-8', '--windows-filenames', '--no-mtime');
  args.push('--ffmpeg-location', path.dirname(ffmpegPath));
  args.push('--concurrent-fragments', '4');
  if (jsRuntime) args.push('--js-runtimes', `node:${jsRuntime}`);
  if (options.youtubeClient && options.youtubeClient !== 'default') {
    args.push('--extractor-args', `youtube:player_client=${options.youtubeClient}`);
  }

  if (options.useCookiesFromBrowser) {
    if (!options.cookiesBrowser) throw new Error('Cookies browser not set.');
    args.push('--cookies-from-browser', options.cookiesBrowser);
  }
  if (options.userAgent?.trim()) {
    args.push('--user-agent', options.userAgent.trim());
  }
  args.push(options.verbose ? '--verbose' : '--no-warnings');

  // Machine-readable status lines, parsed in progressParse.ts. --print implies --quiet, --progress keeps the bar.
  args.push(
    '--print', 'before_dl:[item] %(playlist_index|)s/%(n_entries|)s %(title)s',
    '--print', 'after_move:[saved] %(filepath)s',
    '--progress',
    '--progress-template',
    'download:[dl] %(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(progress.tmpfilename)s',
    '--progress-template', 'postprocess:[pp] %(progress.postprocessor)s|%(progress.status)s'
  );

  // Playlists land in their own folder; for single videos playlist_title is empty and the extra separator is harmless.
  args.push('--output-na-placeholder', '', '-o', path.join(options.destinationDir, '%(playlist_title)s', '%(title)s.%(ext)s'));
  // Keep going past unavailable/private entries in a playlist instead of aborting the rest.
  args.push('--ignore-errors');

  // A video opened from an auto-generated Mix (list=RD…) means "this song", not 50 more.
  if (/[?&]v=/.test(url) && /[?&]list=RD/i.test(url)) args.push('--no-playlist');

  if (options.format === 'mp3') {
    const br = options.mp3BitrateKbps ?? 192;
    args.push('--extract-audio', '--audio-format', 'mp3', '--audio-quality', `${br}K`, '--embed-thumbnail', '--embed-metadata');
  } else {
    args.push(
      '-f',
      'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/bestvideo[height<=1080]+bestaudio/best',
      '--merge-output-format',
      'mp4',
      '--embed-thumbnail',
      '--embed-metadata',
      '--embed-chapters'
    );
  }

  args.push('--', url);
  return args;
}

type ItemResult = { saved: number };

// After a cancel, remove what yt-dlp left half-done: "X.f137.mp4.part", its "-FragN"/".ytdl" companions,
// and the "X.webp" thumbnail it fetched for embedding. Only names derived from files it reported are touched.
async function removePartials(tmpFiles: Set<string>) {
  for (const tmp of tmpFiles) {
    const dir = path.dirname(tmp);
    // Without ".part" so an already finished "X.f137.mp4" that was waiting to be merged goes too.
    const name = path.basename(tmp).replace(/\.part$/, '');
    const base = name.replace(/(\.f[\w-]+)?\.[^.]+$/, '');
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }
    const thumbs = new Set(['webp', 'jpg', 'jpeg', 'png'].map((e) => `${base}.${e}`));
    for (const e of entries) {
      if (e.startsWith(name) || thumbs.has(e)) await fs.rm(path.join(dir, e), { force: true }).catch(() => {});
    }
  }
}

async function downloadOne(
  bins: BinaryLocations,
  url: string,
  options: DownloadOptions,
  outerItemIndex?: number,
  outerItemCount?: number
): Promise<ItemResult> {
  if (!/^https?:\/\//i.test(url)) throw new Error(`Invalid URL: ${url}`);
  await fs.mkdir(options.destinationDir, { recursive: true });

  const args = buildArgs(options, bins.ffmpegPath, url);
  emit({ type: 'log', level: 'info', message: `Starting: ${url}` });
  if (options.verbose) emit({ type: 'log', level: 'debug', message: `Args: ${args.join(' ')}` });

  const outer = outerItemIndex && outerItemCount ? { itemIndex: outerItemIndex, itemCount: outerItemCount } : {};

  // yt-dlp can print dozens of progress lines per second; the UI only needs a few updates.
  let pending: Partial<ProgressSnapshot> | null = null;
  let lastFlush = 0;
  const flush = () => {
    if (!pending) return;
    emit({ type: 'progress', progress: { ...pending, ...outer } });
    pending = null;
    lastFlush = Date.now();
  };
  const queueProgress = (p: Partial<ProgressSnapshot>, immediate = false) => {
    pending = { ...(pending ?? {}), ...p };
    if (immediate || Date.now() - lastFlush >= 200) flush();
  };

  let saved = 0;
  const tail: string[] = [];
  const tmpFiles = new Set<string>();

  return await new Promise<ItemResult>((resolve, reject) => {
    const child = spawn(bins.ytDlpPath, args, {
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    });
    setChild(child);

    const handleLine = (line: string) => {
      const parsed = parseLine(line);
      if (parsed?.kind === 'progress') {
        if (parsed.tmpFile) tmpFiles.add(parsed.tmpFile);
        queueProgress(parsed.progress);
        return;
      }
      if (parsed?.kind === 'item') {
        const playlist =
          !outerItemCount && parsed.playlistIndex && parsed.playlistCount
            ? { itemIndex: parsed.playlistIndex, itemCount: parsed.playlistCount }
            : {};
        queueProgress({ title: parsed.title, percent: 0, speed: undefined, eta: undefined, stage: 'download', ...playlist }, true);
        const pos = parsed.playlistIndex && parsed.playlistCount ? ` (${parsed.playlistIndex}/${parsed.playlistCount})` : '';
        emit({ type: 'log', level: 'info', message: `Downloading: ${parsed.title}${pos}` });
        return;
      }
      if (parsed?.kind === 'postprocess') {
        if (parsed.status === 'started' && parsed.name !== 'MoveFiles') queueProgress({ stage: 'processing', percent: 100 }, true);
        emit({ type: 'log', level: 'debug', message: `${parsed.name}: ${parsed.status}` });
        return;
      }
      if (parsed?.kind === 'saved') {
        saved++;
        tmpFiles.clear();
        emit({ type: 'log', level: 'info', message: `Saved: ${path.basename(parsed.filePath)}` });
        return;
      }

      emit({ type: 'log', level: classify(line), message: line });
      tail.push(line);
      if (tail.length > 40) tail.shift();
    };

    const pipeLines = (stream: NodeJS.ReadableStream) => {
      let buf = '';
      stream.setEncoding('utf-8');
      stream.on('data', (chunk: string) => {
        buf += chunk;
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() ?? '';
        for (const line of lines) if (line.trim()) handleLine(line);
      });
      stream.on('end', () => {
        if (buf.trim()) handleLine(buf);
      });
    };
    pipeLines(child.stdout);
    pipeLines(child.stderr);

    child.on('error', (err) => {
      setChild(null);
      reject(err);
    });
    child.on('close', (code) => {
      setChild(null);
      flush();
      if (cancelRequested) {
        // taskkill returns before Windows releases the file handles.
        setTimeout(() => void removePartials(tmpFiles).finally(() => resolve({ saved })), 500);
        return;
      }
      if (code === 0) {
        resolve({ saved });
        return;
      }
      const hint = tail.findLast((l) => /error:/i.test(l)) ?? tail.at(-1);
      if (saved > 0) {
        // Playlist with some unavailable entries: keep what we got and say so.
        emit({ type: 'log', level: 'warn', message: `Some items could not be downloaded. ${hint ?? ''}`.trim() });
        resolve({ saved });
        return;
      }
      reject(new Error(hint ? hint.replace(/^ERROR:\s*/i, '') : `yt-dlp exited with code ${code}.`));
    });
  });
}

parentPort?.on('message', async (cmd: Command) => {
  if (cmd.type === 'cancel') {
    cancelRequested = true;
    emit({ type: 'log', level: 'warn', message: 'Cancel requested…' });
    if (currentChild?.pid) await killProcessTree(currentChild.pid);
    return;
  }

  cancelRequested = false;
  try {
    const bins = await binariesReady;
    if (cancelRequested) throw new Error('cancelled');
    emit({ type: 'log', level: 'debug', message: `yt-dlp: ${bins.ytDlpPath}` });
    emit({ type: 'log', level: 'debug', message: `ffmpeg: ${bins.ffmpegPath}` });

    let saved = 0;
    const failures: string[] = [];

    if (cmd.type === 'startSingle') {
      saved = (await downloadOne(bins, cmd.url, cmd.options)).saved;
    } else {
      const urls = cmd.urls.filter((u) => u.trim().length > 0);
      for (let i = 0; i < urls.length && !cancelRequested; i++) {
        emit({ type: 'progress', progress: { itemIndex: i + 1, itemCount: urls.length, percent: 0, title: undefined } });
        try {
          saved += (await downloadOne(bins, urls[i]!, cmd.options, i + 1, urls.length)).saved;
        } catch (e) {
          // One bad link should not throw away the rest of the batch.
          const message = e instanceof Error ? e.message : String(e);
          failures.push(urls[i]!);
          emit({ type: 'log', level: 'error', message: `Failed (${i + 1}/${urls.length}) ${urls[i]}: ${message}` });
        }
      }
      if (!cancelRequested && failures.length === urls.length) {
        throw new Error(`None of the ${urls.length} links could be downloaded. See logs for details.`);
      }
    }

    if (cancelRequested) {
      emit({ type: 'status', status: 'cancelled', message: 'Cancelled.' });
    } else {
      const files = `${saved} file${saved === 1 ? '' : 's'} saved`;
      const message = failures.length ? `Done: ${files}, ${failures.length} link(s) failed.` : `Done: ${files}.`;
      emit({ type: 'status', status: 'finished', message });
    }
    emit({ type: 'finished' });
  } catch (e) {
    if (cancelRequested) {
      emit({ type: 'status', status: 'cancelled', message: 'Cancelled.' });
      emit({ type: 'finished' });
      return;
    }
    emit({ type: 'error', message: e instanceof Error ? e.message : 'Unknown worker error' });
  }
});
