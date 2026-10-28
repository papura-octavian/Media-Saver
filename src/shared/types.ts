export type OutputFormat = 'mp3' | 'mp4';
// 'default' lets yt-dlp pick its own client mix, which is what keeps working when YouTube changes things.
export type YoutubeClient = 'default' | 'android' | 'web' | 'ios' | 'tv';
export type CookiesBrowser = 'chrome' | 'edge' | 'firefox' | 'brave';

export type Mp3BitrateKbps = 128 | 192 | 256 | 320;

export type DownloadOptions = {
  destinationDir: string;
  format: OutputFormat;
  mp3BitrateKbps?: Mp3BitrateKbps;
  youtubeClient: YoutubeClient;
  useCookiesFromBrowser: boolean;
  cookiesBrowser?: CookiesBrowser;
  userAgent?: string;
  verbose: boolean;
};

export type Settings = {
  destinationDir: string;
  format: OutputFormat;
  mp3BitrateKbps: Mp3BitrateKbps;
  youtubeClient: YoutubeClient;
  useCookiesFromBrowser: boolean;
  cookiesBrowser: CookiesBrowser;
  userAgent: string;
  verbose: boolean;
};

export type ProgressSnapshot = {
  title?: string;
  percent?: number; // 0..100
  speed?: string; // "1.2MiB/s"
  etaSeconds?: number;
  eta?: string; // "00:32"
  itemIndex?: number; // 1-based
  itemCount?: number;
  // 'processing' while FFmpeg merges, converts or embeds after the download itself reached 100%.
  stage?: 'download' | 'processing';
};

export type JobStatus = 'idle' | 'running' | 'cancelling' | 'cancelled' | 'finished' | 'error';

export type DownloadEvent =
  | { type: 'status'; status: JobStatus; message?: string }
  | { type: 'log'; level: 'debug' | 'info' | 'warn' | 'error'; message: string }
  | { type: 'progress'; progress: ProgressSnapshot }
  | { type: 'finished' }
  | { type: 'error'; message: string };



