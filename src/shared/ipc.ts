import type { DownloadEvent, DownloadOptions, Settings } from './types';

export type IpcStartSingleArgs = { url: string; options: DownloadOptions };
export type IpcStartBatchArgs = { urls: string[]; options: DownloadOptions };

export type IpcChooseTxtResult =
  | { cancelled: true }
  | { cancelled: false; filePath: string; urls: string[] };

export type IpcChooseFolderResult =
  | { cancelled: true }
  | { cancelled: false; folderPath: string };

export type IpcApi = {
  chooseDestinationFolder(): Promise<IpcChooseFolderResult>;
  chooseTxtFile(): Promise<IpcChooseTxtResult>;
  startSingle(args: IpcStartSingleArgs): Promise<void>;
  startBatch(args: IpcStartBatchArgs): Promise<void>;
  cancelCurrent(): Promise<void>;
  openFolder(folderPath: string): Promise<void>;

  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;

  // Window controls (custom titlebar)
  windowMinimize(): Promise<void>;
  windowToggleMaximize(): Promise<void>;
  windowClose(): Promise<void>;
  windowIsMaximized(): Promise<boolean>;

  onEvent(handler: (evt: DownloadEvent) => void): () => void;
};



