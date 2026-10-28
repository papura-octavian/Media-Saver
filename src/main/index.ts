import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { DownloadManager } from './download/DownloadManager';
import { getSettings, patchSettings } from './settings';
import type { IpcChooseFolderResult, IpcChooseTxtResult, IpcStartBatchArgs, IpcStartSingleArgs } from '../shared/ipc';
import type { DownloadEvent } from '../shared/types';

const isDev = !app.isPackaged;
const TITLEBAR_HEIGHT = 48;

let mainWindow: BrowserWindow | null = null;
let downloadManager: DownloadManager | null = null;

function sendToRenderer(evt: DownloadEvent) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('dm:event', evt);
}

async function createMainWindow() {
  const iconPath = isDev
    ? path.join(process.cwd(), 'build', 'icon.ico')
    : path.join(process.resourcesPath, 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 860,
    minHeight: 640,
    backgroundColor: '#0b1020',
    show: false,
    icon: iconPath,
    autoHideMenuBar: true,
    frame: false, // fully custom titlebar (renderer draws it)
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(app.getAppPath(), 'dist-electron', 'preload', 'index.cjs')
    }
  });

  // Remove the default application menu (File/Edit/View/Window/Help).
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('ready-to-show', () => mainWindow?.show());

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173/');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexHtml = path.join(app.getAppPath(), 'dist-renderer', 'index.html');
    await mainWindow.loadFile(indexHtml);
  }
}

function parseUrlsFromTxt(contents: string): string[] {
  return contents
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

async function registerIpc() {
  ipcMain.handle('win:minimize', async () => {
    mainWindow?.minimize();
  });
  ipcMain.handle('win:toggleMaximize', async () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('win:isMaximized', async () => {
    return !!mainWindow?.isMaximized();
  });
  ipcMain.handle('win:close', async () => {
    mainWindow?.close();
  });

  ipcMain.handle('ui:chooseDestinationFolder', async (): Promise<IpcChooseFolderResult> => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: 'Choose destination folder',
      properties: ['openDirectory', 'createDirectory']
    });
    if (res.canceled || res.filePaths.length === 0) return { cancelled: true };
    return { cancelled: false, folderPath: res.filePaths[0]! };
  });

  ipcMain.handle('ui:chooseTxtFile', async (): Promise<IpcChooseTxtResult> => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: 'Choose TXT file',
      properties: ['openFile'],
      filters: [{ name: 'Text files', extensions: ['txt'] }]
    });
    if (res.canceled || res.filePaths.length === 0) return { cancelled: true };
    const filePath = res.filePaths[0]!;
    const contents = await fs.readFile(filePath, 'utf-8');
    const urls = parseUrlsFromTxt(contents);
    return { cancelled: false, filePath, urls };
  });

  ipcMain.handle('ui:startSingle', async (_evt, args: IpcStartSingleArgs) => {
    await downloadManager!.startSingle(args.url, args.options);
  });

  ipcMain.handle('ui:startBatch', async (_evt, args: IpcStartBatchArgs) => {
    await downloadManager!.startBatch(args.urls, args.options);
  });

  ipcMain.handle('ui:cancelCurrent', async () => {
    await downloadManager!.cancelCurrent();
  });

  ipcMain.handle('ui:openFolder', async (_evt, folderPath: string) => {
    if (folderPath) await shell.openPath(folderPath);
  });

  ipcMain.handle('ui:getSettings', async () => getSettings());
  ipcMain.handle('ui:setSettings', async (_evt, patch) => patchSettings(patch));
}

async function main() {
  await app.whenReady();

  // App user model id helps Windows show the right icon/grouping.
  app.setAppUserModelId('com.skipit.media-saver');
  Menu.setApplicationMenu(null);

  downloadManager = new DownloadManager({
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    userDataPath: app.getPath('userData'),
    onEvent: sendToRenderer
  });

  // Handlers must exist before the renderer loads, or its first getSettings() call fails and the saved
  // destination folder is silently replaced by the defaults.
  await registerIpc();
  await createMainWindow();
  downloadManager.warmUp();

  app.on('will-quit', () => downloadManager?.dispose());

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

// Ensure single instance (optional but nice on Windows).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  void main();
}



