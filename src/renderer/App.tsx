import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppShell,
  Stack,
  Transition
} from '@mantine/core';
import type { DownloadEvent, JobStatus, ProgressSnapshot, Settings } from '@shared/types';
import { TitleBar } from './components/TitleBar';
import { ActionCard, type Mode } from './components/ActionCard';
import { ProgressCard } from './components/ProgressCard';
import { LogsCard, type UiLogLine } from './components/LogsCard';
import styles from './AppShellLayout.module.css';

const defaultSettings: Settings = {
  destinationDir: '',
  format: 'mp3',
  mp3BitrateKbps: 192,
  youtubeClient: 'default',
  useCookiesFromBrowser: false,
  cookiesBrowser: 'chrome',
  userAgent: '',
  verbose: false
};

// Long playlists produce thousands of lines; keeping them all makes every update re-render a huge list.
const MAX_LOG_LINES = 500;

let logSeq = 0;
function appendLog(lines: UiLogLine[], level: string, message: string): UiLogLine[] {
  const next = lines.length >= MAX_LOG_LINES ? lines.slice(lines.length - MAX_LOG_LINES + 1) : lines.slice();
  next.push({ id: String(++logSeq), level, message });
  return next;
}

export function App() {
  const api = window.mediaSaver;
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const [url, setUrl] = useState('');
  const [batchLabel, setBatchLabel] = useState<string | null>(null);
  const [batchFile, setBatchFile] = useState<{ filePath: string; urls: string[] } | null>(null);
  const [mode, setMode] = useState<Mode>('single');
  const [status, setStatus] = useState<JobStatus>('idle');
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressSnapshot>({});
  const [logs, setLogs] = useState<UiLogLine[]>([]);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [destError, setDestError] = useState<string | null>(null);
  const [progressPulse, setProgressPulse] = useState(false);

  const lastErrorRef = useRef<string | null>(null);
  const log = (level: string, message: string) => setLogs((l) => appendLog(l, level, message));

  const verbose = settings.verbose;

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => setSettings(defaultSettings));
  }, []);

  useEffect(() => {
    return api.onEvent((evt: DownloadEvent) => {
      if (evt.type === 'status') {
        setStatus(evt.status);
        if (evt.message) log('info', evt.message);
        if (evt.status === 'finished') setDoneMessage(evt.message ?? null);
        if (evt.status === 'running') {
          setProgressPulse(true);
          setTimeout(() => setProgressPulse(false), 1000);
        }
      } else if (evt.type === 'log') {
        log(evt.level, evt.message);
      } else if (evt.type === 'progress') {
        setProgress((p) => ({ ...p, ...evt.progress }));
        const { itemIndex, itemCount } = evt.progress;
        if (itemIndex && itemCount) setBatchLabel(`Item ${itemIndex}/${itemCount}`);
      } else if (evt.type === 'finished') {
        // The worker already sent the final status ('finished' or 'cancelled'); only fill in if it did not.
        setStatus((s) => (s === 'running' || s === 'cancelling' ? 'finished' : s));
      } else if (evt.type === 'error') {
        setStatus('error');
        lastErrorRef.current = evt.message;
        log('error', evt.message);
      }
    });
  }, [api]);

  const filteredLogs = useMemo(() => {
    if (verbose) return logs;
    return logs.filter((l) => l.level !== 'debug');
  }, [logs, verbose]);

  const busy = status === 'running' || status === 'cancelling';

  async function updateSettings(patch: Partial<Settings>) {
    // Update the UI right away; waiting for the IPC round trip makes text inputs drop keystrokes.
    setSettings((s) => ({ ...s, ...patch }));
    try {
      await api.setSettings(patch);
    } catch (e) {
      log('error', `Could not save settings: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function chooseDestination() {
    const res = await api.chooseDestinationFolder();
    if (!res.cancelled) await updateSettings({ destinationDir: res.folderPath });
    setDestError(null);
  }

  async function pasteUrl() {
    const clip = await navigator.clipboard?.readText();
    if (clip != null) setUrl(clip.trim());
    setUrlError(null);
  }

  function resetRun() {
    setLogs([]);
    setProgress({});
    setDoneMessage(null);
    lastErrorRef.current = null;
  }

  async function start(run: () => Promise<void>) {
    try {
      await run();
    } catch (e) {
      const message = e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e);
      setStatus('error');
      lastErrorRef.current = message;
      log('error', message);
    }
  }

  async function startSingle() {
    if (busy) return;
    if (!settings.destinationDir) {
      setDestError('Choose a destination folder first.');
      log('error', 'Please choose a destination folder first.');
      return;
    }
    if (!url.trim()) {
      setUrlError('Paste a link to begin.');
      return;
    }
    resetRun();
    setBatchLabel(null);
    setMode('single');
    await start(() => api.startSingle({ url: url.trim(), options: { ...settings } }));
  }

  async function chooseTxt() {
    if (!settings.destinationDir) {
      setDestError('Choose a destination folder first.');
      log('error', 'Please choose a destination folder first.');
      return;
    }
    const res = await api.chooseTxtFile();
    if (res.cancelled) return;
    if (res.urls.length === 0) {
      log('error', 'No URLs found in TXT file.');
      return;
    }
    setBatchFile({ filePath: res.filePath, urls: res.urls });
    setMode('batch');
    log('info', `Loaded ${res.urls.length} URLs from ${res.filePath}`);
  }

  async function startBatch() {
    if (busy) return;
    if (!batchFile) {
      log('error', 'Choose a TXT file first.');
      return;
    }
    resetRun();
    setBatchLabel(`Item 1/${batchFile.urls.length}`);
    setMode('batch');
    await start(() => api.startBatch({ urls: batchFile.urls, options: { ...settings } }));
  }

  async function cancel() {
    await api.cancelCurrent();
  }

  async function copyErrorDetails() {
    const tail = filteredLogs.slice(-120).map((l) => `[${l.level.toUpperCase()}] ${l.message}`).join('\n');
    const text = `Media Saver error\nStatus: ${status}\nDestination: ${settings.destinationDir}\n\nLast error: ${lastErrorRef.current ?? 'n/a'}\n\nLogs:\n${tail}\n`;
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // ignore
    }
  }

  async function copyAllLogs() {
    const text = filteredLogs.map((l) => `[${l.level.toUpperCase()}] ${l.message}`).join('\n');
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // ignore
    }
  }

  function clearLogs() {
    setLogs([]);
  }

  return (
    <AppShell
      className={styles.root}
      padding={0}
      styles={{
        main: {
          height: '100vh',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }
      }}
    >
      <AppShell.Main>
        <TitleBar status={status} batchLabel={batchLabel} />
        <div className={styles.content}>
          <Transition mounted transition="pop" duration={200} timingFunction="ease">
            {(tStyles) => (
              <div className={styles.page} style={tStyles}>
                <Stack gap={16}>
                  <ActionCard
                    settings={settings}
                    busy={busy}
                    url={url}
                    mode={mode}
                    batchFile={batchFile}
                    urlError={urlError}
                    destError={destError}
                    onModeChange={(m) => setMode(m)}
                    onUrlChange={(v) => {
                      setUrl(v);
                      setUrlError(null);
                    }}
                    onPatchSettings={updateSettings}
                    onChooseDestination={chooseDestination}
                    onPasteUrl={pasteUrl}
                    onStartSingle={startSingle}
                    onChooseTxt={chooseTxt}
                    onStartBatch={startBatch}
                    onCancel={cancel}
                  />

                  <div className={styles.grid2}>
                    <ProgressCard
                      status={status}
                      progress={progress}
                      pulse={progressPulse}
                      destinationDir={settings.destinationDir}
                      doneMessage={doneMessage}
                      errorSummary={lastErrorRef.current}
                      onCopyErrorDetails={status === 'error' ? copyErrorDetails : undefined}
                      onOpenFolder={settings.destinationDir ? () => api.openFolder(settings.destinationDir) : undefined}
                    />
                    <LogsCard verbose={verbose} lines={filteredLogs} onClear={clearLogs} onCopyAll={copyAllLogs} />
                  </div>
                </Stack>
              </div>
            )}
          </Transition>
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
