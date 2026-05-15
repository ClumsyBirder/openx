import { createLogger } from '../../lib/log'

const logger = createLogger('harmonyAppGallery')

const INFO_URL = 'https://web-drcn.hispace.dbankcloud.com/edge/webedge/appinfo'

interface OnlineBundleInfo {
  name?: string
  icon?: string
}

const cache = new Map<string, OnlineBundleInfo>()

async function fetchIconAsBase64(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return undefined
    }
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.toString('base64')
  } catch (e) {
    logger.debug('fetch icon failed', url, e)
    return undefined
  }
}

/** 华为应用市场元数据（参考 Echo） */
export async function getOnlineBundleInfo(
  bundleName: string,
): Promise<{ name?: string; icon?: string; iconMimeType?: string }> {
  if (cache.has(bundleName)) {
    const cached = cache.get(bundleName)!
    return {
      name: cached.name,
      icon: cached.icon,
      iconMimeType: cached.icon ? 'image/png' : undefined,
    }
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
    throw new Error(`AppGallery API HTTP ${res.status}`)
  }

  const data = (await res.json()) as OnlineBundleInfo
  cache.set(bundleName, data)

  let iconBase64: string | undefined
  if (data.icon?.startsWith('http')) {
    iconBase64 = await fetchIconAsBase64(data.icon)
  }

  return {
    name: data.name,
    icon: iconBase64,
    iconMimeType: iconBase64 ? 'image/png' : undefined,
  }
}

export function shouldFetchOnlineInfo(bundleName: string, isSystem: boolean): boolean {
  return !isSystem && !bundleName.startsWith('com.huawei')
}
