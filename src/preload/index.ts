import { contextBridge, ipcRenderer } from 'electron';
import type { IpcApi, IpcChooseFolderResult, IpcChooseTxtResult, IpcStartBatchArgs, IpcStartSingleArgs } from '../shared/ipc';
import type { DownloadEvent, Settings } from '../shared/types';

const api: IpcApi = {
  chooseDestinationFolder: () => ipcRenderer.invoke('ui:chooseDestinationFolder') as Promise<IpcChooseFolderResult>,
  chooseTxtFile: () => ipcRenderer.invoke('ui:chooseTxtFile') as Promise<IpcChooseTxtResult>,

  startSingle: (args: IpcStartSingleArgs) => ipcRenderer.invoke('ui:startSingle', args) as Promise<void>,
  startBatch: (args: IpcStartBatchArgs) => ipcRenderer.invoke('ui:startBatch', args) as Promise<void>,
  cancelCurrent: () => ipcRenderer.invoke('ui:cancelCurrent') as Promise<void>,
  openFolder: (folderPath: string) => ipcRenderer.invoke('ui:openFolder', folderPath) as Promise<void>,

  getSettings: () => ipcRenderer.invoke('ui:getSettings') as Promise<Settings>,
  setSettings: (patch: Partial<Settings>) => ipcRenderer.invoke('ui:setSettings', patch) as Promise<Settings>,

  windowMinimize: () => ipcRenderer.invoke('win:minimize') as Promise<void>,
  windowToggleMaximize: () => ipcRenderer.invoke('win:toggleMaximize') as Promise<void>,
  windowClose: () => ipcRenderer.invoke('win:close') as Promise<void>,
  windowIsMaximized: () => ipcRenderer.invoke('win:isMaximized') as Promise<boolean>,

  onEvent: (handler: (evt: DownloadEvent) => void) => {
    const listener = (_: unknown, evt: DownloadEvent) => handler(evt);
    ipcRenderer.on('dm:event', listener);
    return () => ipcRenderer.removeListener('dm:event', listener);
  }
};

contextBridge.exposeInMainWorld('mediaSaver', api);

declare global {
  interface Window {
    mediaSaver: IpcApi;
  }
}



