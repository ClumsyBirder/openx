import { parseDeviceRef } from './device-ref'
import {
  startAndroidApp,
  stopAndroidApp,
  uninstallAndroidApp,
} from './android/app-control'
import {
  startHarmonyApp,
  stopHarmonyApp,
  uninstallHarmonyApp,
} from './harmony/app-control'

export interface StartDeviceAppOptions {
  packageName: string
  mainAbility?: string
}

export async function startDeviceApp(
  deviceId: string,
  options: StartDeviceAppOptions,
): Promise<void> {
  const ref = parseDeviceRef(deviceId)
  if (!ref) {
    throw new Error(`Invalid device id: ${deviceId}`)
  }

  if (ref.platform === 'android') {
    await startAndroidApp(ref.key, options.packageName)
    return
  }

  if (!options.mainAbility) {
    throw new Error('鸿蒙应用缺少 mainAbility，无法启动')
  }
  await startHarmonyApp(ref.key, options.packageName, options.mainAbility)
}

export async function stopDeviceApp(deviceId: string, packageName: string): Promise<void> {
  const ref = parseDeviceRef(deviceId)
  if (!ref) {
    throw new Error(`Invalid device id: ${deviceId}`)
  }

  if (ref.platform === 'android') {
    await stopAndroidApp(ref.key, packageName)
    return
  }
  await stopHarmonyApp(ref.key, packageName)
}

export async function uninstallDeviceApp(deviceId: string, packageName: string): Promise<void> {
  const ref = parseDeviceRef(deviceId)
  if (!ref) {
    throw new Error(`Invalid device id: ${deviceId}`)
  }

  if (ref.platform === 'android') {
    await uninstallAndroidApp(ref.key, packageName)
    return
  }
  await uninstallHarmonyApp(ref.key, packageName)
}
