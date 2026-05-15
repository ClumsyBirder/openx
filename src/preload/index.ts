import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '../shared/ipc-channels'
import type {
  AppActionResult,
  AppsListResult,
  ListAppsOptions,
  ScreencapResult,
  StartAppPayload,
} from '../shared/device-app'
import type { ShellExecResult } from '../shared/shell'
import type { UnifiedDevice } from '../shared/unified-device'

// Custom APIs for renderer
const api = {
  window: {
    minimize: () => ipcRenderer.send(IPC.window.minimize),
    maximize: () => ipcRenderer.send(IPC.window.maximize),
    close: () => ipcRenderer.send(IPC.window.close),
    isMaximized: () => ipcRenderer.invoke(IPC.window.isMaximized)
  },
  devices: {
    list: (): Promise<UnifiedDevice[]> => ipcRenderer.invoke(IPC.devices.list),
    onListChanged: (cb: (devices: UnifiedDevice[]) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, devices: UnifiedDevice[]): void => {
        cb(devices)
      }
      ipcRenderer.on(IPC.devices.listChanged, listener)
      return () => {
        ipcRenderer.removeListener(IPC.devices.listChanged, listener)
      }
    }
  },
  shell: {
    exec: (deviceId: string, cmd: string): Promise<ShellExecResult> =>
      ipcRenderer.invoke(IPC.shell.exec, deviceId, cmd)
  },
  apps: {
    list: (deviceId: string, options?: ListAppsOptions): Promise<AppsListResult> =>
      ipcRenderer.invoke(IPC.apps.list, deviceId, options),
    start: (deviceId: string, payload: StartAppPayload): Promise<AppActionResult> =>
      ipcRenderer.invoke(IPC.apps.start, deviceId, payload),
    stop: (deviceId: string, packageName: string): Promise<AppActionResult> =>
      ipcRenderer.invoke(IPC.apps.stop, deviceId, packageName),
    uninstall: (deviceId: string, packageName: string): Promise<AppActionResult> =>
      ipcRenderer.invoke(IPC.apps.uninstall, deviceId, packageName),
  },
  screencap: {
    capture: (deviceId: string): Promise<ScreencapResult> =>
      ipcRenderer.invoke(IPC.screencap.capture, deviceId)
  },
  log: {
    getPath: (): Promise<string> => ipcRenderer.invoke(IPC.log.getPath)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
