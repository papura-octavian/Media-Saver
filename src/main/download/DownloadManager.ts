import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import type { DownloadEvent, DownloadOptions } from '../../shared/types';
import type { ChildPidMessage } from './worker';

type Ctx = {
  appPath: string;
  resourcesPath: string;
  userDataPath: string;
  onEvent: (evt: DownloadEvent) => void;
};

type WorkerCommand =
  | { type: 'startSingle'; url: string; options: DownloadOptions }
  | { type: 'startBatch'; urls: string[]; options: DownloadOptions }
  | { type: 'cancel' };

export class DownloadManager {
  private readonly ctx: Ctx;
  private worker: Worker | null = null;
  private running = false;
  private childPid: number | null = null;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  // Start the worker early: it resolves binaries and refreshes yt-dlp in the background.
  warmUp() {
    this.ensureWorker();
  }

  async startSingle(url: string, options: DownloadOptions) {
    if (this.running) throw new Error('A job is already running.');
    this.ensureWorker();
    this.running = true;
    this.ctx.onEvent({ type: 'status', status: 'running', message: 'Starting download…' });
    this.worker!.postMessage({ type: 'startSingle', url, options } satisfies WorkerCommand);
  }

  async startBatch(urls: string[], options: DownloadOptions) {
    if (this.running) throw new Error('A job is already running.');
    this.ensureWorker();
    this.running = true;
    this.ctx.onEvent({ type: 'status', status: 'running', message: `Starting batch (${urls.length} items)…` });
    this.worker!.postMessage({ type: 'startBatch', urls, options } satisfies WorkerCommand);
  }

  async cancelCurrent() {
    if (!this.worker || !this.running) return;
    this.ctx.onEvent({ type: 'status', status: 'cancelling', message: 'Cancelling…' });
    this.worker.postMessage({ type: 'cancel' } satisfies WorkerCommand);
  }

  // Called on quit. Child processes outlive the app on Windows, so yt-dlp (and the ffmpeg it started)
  // would keep downloading in the background without this.
  dispose() {
    if (this.childPid && process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(this.childPid), '/T', '/F'], { windowsHide: true });
    }
    this.childPid = null;
    void this.worker?.terminate();
    this.worker = null;
  }

  private ensureWorker() {
    if (this.worker) return;
    const workerPath = this.ctx.appPath.endsWith('.asar')
      ? path.join(this.ctx.resourcesPath, 'app.asar.unpacked', 'dist-electron', 'main', 'download', 'worker.cjs')
      : path.join(this.ctx.appPath, 'dist-electron', 'main', 'download', 'worker.cjs');
    const worker = new Worker(workerPath, {
      workerData: {
        appPath: this.ctx.appPath,
        resourcesPath: this.ctx.resourcesPath,
        userDataPath: this.ctx.userDataPath
      }
    });
    this.worker = worker;
    worker.on('message', (evt: DownloadEvent | ChildPidMessage) => {
      if (evt.type === 'childPid') {
        this.childPid = evt.pid;
        return;
      }
      if (evt.type === 'finished' || evt.type === 'error') this.running = false;
      this.ctx.onEvent(evt);
    });
    worker.on('error', (err) => {
      this.running = false;
      this.ctx.onEvent({ type: 'error', message: err.message });
    });
    worker.on('exit', (code) => {
      if (this.worker !== worker) return; // disposed
      this.worker = null;
      if (code !== 0 && this.running) {
        this.ctx.onEvent({ type: 'error', message: `Worker exited unexpectedly (code ${code}).` });
      }
      this.running = false;
    });
  }
}
