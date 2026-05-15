import { Adb } from '@devicefarmer/adbkit'
import type { Client } from '@devicefarmer/adbkit'
import type { Device } from '@devicefarmer/adbkit'
import type { UnifiedDevice, UnifiedDeviceState } from './types'
import { resolveAdbExecutable } from './toolkit-paths'

let adbClient: Client | null = null

function getAdbClient(): Client {
  if (!adbClient) {
    adbClient = Adb.createClient({ bin: resolveAdbExecutable() })
  }
  return adbClient
}

function mapAdbType(type: Device['type']): UnifiedDeviceState {
  switch (type) {
    case 'device':
    case 'emulator':
      return 'online'
    case 'offline':
      return 'offline'
    case 'unauthorized':
      return 'unauthorized'
    default:
      return 'unknown'
  }
}

/** 参考 AYA：优先各厂商市场名属性，否则 manufacturer + model */
function getAndroidDisplayName(properties: Record<string, string>): string {
  const marketKeys = [
    'ro.oppo.market.name',
    'ro.config.marketing_name',
    'ro.vendor.oplus.market.enname',
    'ro.vivo.market.name',
    'ro.product.marketname',
    'ro.asus.product.mkt_name',
  ]
  for (const key of marketKeys) {
    const v = properties[key]
    if (v?.trim()) {
      return v.trim()
    }
  }
  const manufacturer = (properties['ro.product.manufacturer'] ?? '').trim()
  const model = (properties['ro.product.model'] ?? '').trim()
  const combined = `${manufacturer} ${model}`.trim()
  if (combined) {
    return combined
  }
  return (properties['ro.product.name'] ?? '').trim() || 'Android 设备'
}

function buildAndroidLabel(
  displayName: string,
  serial: string,
  androidVersion?: string,
  sdkVersion?: string,
): string {
  const ver =
    androidVersion && sdkVersion
      ? `Android ${androidVersion} · API ${sdkVersion}`
      : androidVersion
        ? `Android ${androidVersion}`
        : sdkVersion
          ? `API ${sdkVersion}`
          : ''
  const tail = ver ? ` · ${ver}` : ''
  return `${displayName} (${serial})${tail}`
}

export function mapAdbDeviceFallback(device: Device): UnifiedDevice {
  const typeLabel =
    device.type === 'emulator' ? '模拟器' : device.type === 'device' ? '设备' : device.type
  const serial = device.id
  return {
    id: `android:${serial}`,
    platform: 'android',
    state: mapAdbType(device.type),
    displayName: serial,
    connectionKey: serial,
    label: `${serial} · ${typeLabel}`,
  }
}

async function enrichAndroidDevice(device: Device): Promise<UnifiedDevice> {
  const base = mapAdbDeviceFallback(device)
  if (device.type !== 'device' && device.type !== 'emulator') {
    return base
  }
  try {
    const props = await Promise.resolve(getAdbClient().getDevice(device.id).getProperties())
    const displayName = getAndroidDisplayName(props)
    const androidVersion = props['ro.build.version.release']?.trim() || undefined
    const sdkVersion = props['ro.build.version.sdk']?.trim() || undefined
    return {
      ...base,
      displayName,
      androidVersion,
      sdkVersion,
      label: buildAndroidLabel(displayName, device.id, androidVersion, sdkVersion),
    }
  } catch {
    return base
  }
}

export async function listAndroidDevices(): Promise<UnifiedDevice[]> {
  const list = await Promise.resolve(getAdbClient().listDevices())
  return Promise.all(list.map((d) => enrichAndroidDevice(d)))
}

export async function startAndroidTracking(onEvent: () => void): Promise<{ stop: () => void }> {
  const tracker = await Promise.resolve(getAdbClient().trackDevices())
  const notify = (): void => {
    onEvent()
  }
  tracker.on('add', notify)
  tracker.on('remove', notify)
  tracker.on('change', notify)
  tracker.on('changeSet', notify)
  tracker.on('error', () => {
    notify()
  })
  notify()
  return {
    stop: () => {
      tracker.removeAllListeners()
      tracker.end()
    },
  }
}
