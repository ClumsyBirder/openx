import { Hdc } from 'hdckit'
import type { Client } from 'hdckit'
import type { UnifiedDevice } from './types'
import { resolveHdcExecutable } from './toolkit-paths'

let hdcClient: Client | null = null

function getHdcClient(): Client {
  if (!hdcClient) {
    hdcClient = Hdc.createClient({ bin: resolveHdcExecutable() })
  }
  return hdcClient
}

/** 参考 ECHO hdc：从 `const.product.software.version` 中解析 OpenHarmony 版本段 */
function parseOhosVersion(softwareVersion: string): string {
  const s = softwareVersion.trim()
  if (!s) {
    return ''
  }
  const parts = s.split(/\s+/)
  if (parts.length < 2) {
    return s
  }
  let ver = parts[1]
  const idx = ver.indexOf('(')
  if (idx !== -1) {
    ver = ver.slice(0, idx)
  }
  return ver.trim()
}

function buildHarmonyLabel(
  displayName: string,
  connectKey: string,
  ohosVersion?: string,
  sdkVersion?: string,
): string {
  const ver =
    ohosVersion && sdkVersion
      ? `OpenHarmony ${ohosVersion} · API ${sdkVersion}`
      : ohosVersion
        ? `OpenHarmony ${ohosVersion}`
        : sdkVersion
          ? `API ${sdkVersion}`
          : ''
  const tail = ver ? ` · ${ver}` : ''
  return `${displayName} (${connectKey})${tail}`
}

export function mapHarmonyTargetFallback(connectKey: string): UnifiedDevice {
  return {
    id: `harmony:${connectKey}`,
    platform: 'harmony',
    state: 'online',
    displayName: connectKey,
    connectionKey: connectKey,
    label: `${connectKey} · 鸿蒙`,
  }
}

async function enrichHarmonyTarget(connectKey: string): Promise<UnifiedDevice> {
  const base = mapHarmonyTargetFallback(connectKey)
  try {
    const parameters = await getHdcClient().getTarget(connectKey).getParameters()
    const displayName = (parameters['const.product.name'] ?? connectKey).trim() || connectKey
    const softwareVersion = parameters['const.product.software.version'] ?? ''
    const ohosVersion = parseOhosVersion(softwareVersion) || undefined
    const sdkRaw = parameters['const.ohos.apiversion']
    const sdkVersion = sdkRaw != null && String(sdkRaw).trim() !== '' ? String(sdkRaw).trim() : undefined
    return {
      ...base,
      displayName,
      ohosVersion,
      sdkVersion,
      label: buildHarmonyLabel(displayName, connectKey, ohosVersion, sdkVersion),
    }
  } catch {
    return base
  }
}

export async function listHarmonyDevices(): Promise<UnifiedDevice[]> {
  const targets = await getHdcClient().listTargets()
  return Promise.all(targets.map((key) => enrichHarmonyTarget(key)))
}

export async function startHarmonyTracking(onEvent: () => void): Promise<{ stop: () => void }> {
  const tracker = await getHdcClient().trackTargets()
  const notify = (): void => {
    onEvent()
  }
  tracker.on('add', notify)
  tracker.on('remove', notify)
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
