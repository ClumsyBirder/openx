import { createLogger } from '../../lib/log'

const logger = createLogger('harmonyAppGallery')

const INFO_URL = 'https://web-drcn.hispace.dbankcloud.com/edge/webedge/appinfo'

interface OnlineBundleInfo {
  name?: string
  icon?: string
}

const cache = new Map<string, OnlineBundleInfo>()

/** 华为应用市场元数据（参考 Echo） */
export async function getOnlineBundleInfo(bundleName: string): Promise<OnlineBundleInfo> {
  if (cache.has(bundleName)) {
    return cache.get(bundleName)!
  }

  logger.debug('fetch online bundle info', bundleName)

  const res = await fetch(INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pkgName: bundleName,
      appId: bundleName,
      locale: 'zh_CN',
      countryCode: 'CN',
      orderApp: 1,
    }),
  })

  if (!res.ok) {
    return {}
  }

  let data: OnlineBundleInfo = {}
  try {
    data = await res.json()
  } catch {
    return {}
  }

  cache.set(bundleName, data)
  return data
}

export function shouldFetchOnlineInfo(bundleName: string, isSystem: boolean): boolean {
  return !isSystem && !bundleName.startsWith('com.huawei')
}
