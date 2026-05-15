import type { IpcMainInvokeEvent } from 'electron'
import type {
  AppActionResult,
  AppsListResult,
  ListAppsOptions,
  StartAppPayload,
} from '../../../shared/device-app'
import { listDeviceApps } from '../../devices/apps'
import {
  startDeviceApp,
  stopDeviceApp,
  uninstallDeviceApp,
} from '../../devices/app-control'
import { logErr } from '../../devices/device-ref'
import { createLogger } from '../../lib/log'

const logger = createLogger('ipc:apps')

export async function handleAppsList(
  _event: IpcMainInvokeEvent,
  deviceId: string,
  options?: ListAppsOptions,
): Promise<AppsListResult> {
  try {
    const apps = await listDeviceApps(deviceId, options)
    return { ok: true, apps }
  } catch (e) {
    logger.warn('apps:list failed', { deviceId, error: logErr(e).errMessage })
    return { ok: false, error: logErr(e).errMessage }
  }
}

export async function handleAppsStart(
  _event: IpcMainInvokeEvent,
  deviceId: string,
  payload: StartAppPayload,
): Promise<AppActionResult> {
  try {
    await startDeviceApp(deviceId, payload)
    return { ok: true }
  } catch (e) {
    logger.warn('apps:start failed', { deviceId, payload, error: logErr(e).errMessage })
    return { ok: false, error: logErr(e).errMessage }
  }
}

export async function handleAppsStop(
  _event: IpcMainInvokeEvent,
  deviceId: string,
  packageName: string,
): Promise<AppActionResult> {
  try {
    await stopDeviceApp(deviceId, packageName)
    return { ok: true }
  } catch (e) {
    logger.warn('apps:stop failed', { deviceId, packageName, error: logErr(e).errMessage })
    return { ok: false, error: logErr(e).errMessage }
  }
}

export async function handleAppsUninstall(
  _event: IpcMainInvokeEvent,
  deviceId: string,
  packageName: string,
): Promise<AppActionResult> {
  try {
    await uninstallDeviceApp(deviceId, packageName)
    return { ok: true }
  } catch (e) {
    logger.warn('apps:uninstall failed', { deviceId, packageName, error: logErr(e).errMessage })
    return { ok: false, error: logErr(e).errMessage }
  }
}
