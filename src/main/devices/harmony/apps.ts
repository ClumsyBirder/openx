import type { DeviceApp } from '../../../shared/device-app'
import { mapConcurrent } from '../../lib/map-concurrent'
import { createLogger } from '../../lib/log'
import { getOnlineBundleInfo, shouldFetchOnlineInfo } from './app-gallery'
import { shell } from './base'
import {
  isSystemBundle,
  parseBundleDump,
  resolveMainAbility,
} from './bundle-utils'

const logger = createLogger('hdcApps')
const INFO_CHUNK = 25
const ONLINE_CONCURRENCY = 6

/** 列出鸿蒙已安装应用（参考 Echo bm dump） */
export async function listHarmonyApps(connectKey: string, includeSystem = true): Promise<DeviceApp[]> {
  logger.debug('listApps', { connectKey, includeSystem })

  const output = await shell(connectKey, 'bm dump -a')
  const bundleNames = output
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((name) => includeSystem || !isSystemBundle(name))

  if (bundleNames.length === 0) {
    return []
  }

  const apps: DeviceApp[] = []

  for (let i = 0; i < bundleNames.length; i += INFO_CHUNK) {
    const chunk = bundleNames.slice(i, i + INFO_CHUNK)
    const dumps = await shell(
      connectKey,
      chunk.map((name) => `bm dump -n ${name}`),
    )

    chunk.forEach((bundleName, index) => {
      const info = parseBundleDump(dumps[index] ?? '')
      const appInfo = info?.applicationInfo
      const isSystem = appInfo?.isSystemApp ?? isSystemBundle(bundleName)
      apps.push({
        packageName: bundleName,
        name: bundleName,
        version: appInfo?.versionName?.trim() ?? '',
        isSystem,
        mainAbility: resolveMainAbility(info),
      })
    })
  }

  const onlineTargets = apps.filter((app) => shouldFetchOnlineInfo(app.packageName, app.isSystem))
  await mapConcurrent(onlineTargets, ONLINE_CONCURRENCY, async (app) => {
    try {
      const online = await getOnlineBundleInfo(app.packageName)
      if (online.name) {
        app.name = online.name
      }
      if (online.icon) {
        app.icon = online.icon
      }
    } catch (e) {
      logger.debug('online info failed', app.packageName, e)
    }
  })

  const filtered = includeSystem ? apps : apps.filter((a) => !a.isSystem)
  return filtered.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}
