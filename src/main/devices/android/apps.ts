import type { DeviceApp } from '../../../shared/device-app'
import { mapConcurrent } from '../../lib/map-concurrent'
import { createLogger } from '../../lib/log'
import { getOnlineAndroidAppInfo, shouldFetchOnlineAndroidInfo } from './online-metadata'
import { shell } from './base'

const logger = createLogger('adbApps')
const VERSION_CHUNK = 40
const ONLINE_CONCURRENCY = 6

function parsePackageLine(line: string): { packageName: string; apkPath: string } | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('package:')) {
    return null
  }
  const body = trimmed.slice('package:'.length)
  const eq = body.lastIndexOf('=')
  if (eq === -1) {
    return null
  }
  return {
    apkPath: body.slice(0, eq),
    packageName: body.slice(eq + 1),
  }
}

function isSystemApkPath(apkPath: string): boolean {
  return (
    apkPath.startsWith('/system/') ||
    apkPath.startsWith('/product/') ||
    apkPath.startsWith('/vendor/') ||
    apkPath.startsWith('/apex/') ||
    apkPath.startsWith('/odm/')
  )
}

function fallbackName(packageName: string): string {
  const parts = packageName.split('.')
  return parts[parts.length - 1] || packageName
}

function parseDumpsysVersion(block: string): { version: string; versionCode?: number } {
  let version = ''
  let versionCode: number | undefined

  for (const line of block.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('versionName=')) {
      version = trimmed.slice('versionName='.length)
    } else if (trimmed.startsWith('versionCode=')) {
      const raw = trimmed.slice('versionCode='.length).split(/\s+/)[0]
      const n = Number.parseInt(raw, 10)
      if (Number.isFinite(n)) {
        versionCode = n
      }
    }
  }

  return { version, versionCode }
}

async function fetchVersionMap(
  serial: string,
  packages: string[],
): Promise<Map<string, { version: string; versionCode?: number }>> {
  const map = new Map<string, { version: string; versionCode?: number }>()
  if (packages.length === 0) {
    return map
  }

  for (let i = 0; i < packages.length; i += VERSION_CHUNK) {
    const chunk = packages.slice(i, i + VERSION_CHUNK)
    const cmds = chunk.map(
      (pkg) =>
        `echo "OPENX_PKG:${pkg}"; dumpsys package ${pkg} 2>/dev/null | grep -E 'versionName=|versionCode=' | head -2`,
    )
    const blocks = await shell(serial, cmds)

    for (const block of blocks) {
      const lines = block.split('\n')
      let currentPkg = ''
      const verLines: string[] = []

      const flush = (): void => {
        if (currentPkg) {
          map.set(currentPkg, parseDumpsysVersion(verLines.join('\n')))
        }
        verLines.length = 0
      }

      for (const line of lines) {
        if (line.startsWith('OPENX_PKG:')) {
          flush()
          currentPkg = line.slice('OPENX_PKG:'.length).trim()
        } else if (line.trim()) {
          verLines.push(line)
        }
      }
      flush()
    }
  }

  return map
}

async function enrichUserAppsMetadata(apps: DeviceApp[]): Promise<void> {
  const targets = apps.filter((app) => shouldFetchOnlineAndroidInfo(app.packageName, app.isSystem))

  await mapConcurrent(targets, ONLINE_CONCURRENCY, async (app) => {
    try {
      const online = await getOnlineAndroidAppInfo(app.packageName)
      if (online.name) {
        app.name = online.name
      }
      if (online.icon) {
        app.icon = online.icon
        app.iconMimeType = online.iconMimeType
      }
    } catch (e) {
      logger.debug('online android info failed', app.packageName, e)
    }
  })
}

/** 列出 Android 已安装应用 */
export async function listAndroidApps(serial: string, includeSystem = true): Promise<DeviceApp[]> {
  logger.debug('listApps', { serial, includeSystem })

  const flag = includeSystem ? ' -f' : ' -f -3'
  const output = await shell(serial, `pm list packages${flag}`)
  const parsed = output
    .split('\n')
    .map(parsePackageLine)
    .filter((item): item is { packageName: string; apkPath: string } => item !== null)

  const versionMap = await fetchVersionMap(
    serial,
    parsed.map((p) => p.packageName),
  )

  const apps = parsed.map(({ packageName, apkPath }) => {
    const ver = versionMap.get(packageName)
    return {
      packageName,
      name: fallbackName(packageName),
      version: ver?.version ?? '',
      versionCode: ver?.versionCode,
      isSystem: isSystemApkPath(apkPath),
    }
  })

  await enrichUserAppsMetadata(apps)

  const filtered = includeSystem ? apps : apps.filter((a) => !a.isSystem)
  return filtered.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}
