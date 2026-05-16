import { createLogger } from '../../lib/log'

const logger = createLogger('androidOnlineMetadata')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export interface OnlineAndroidAppInfo {
  name?: string
  icon?: string
  iconMimeType?: string
}

const cache = new Map<string, OnlineAndroidAppInfo>()

function miDetailsUrl(packageName: string): string {
  return `https://app.mi.com/details?id=${encodeURIComponent(packageName)}`
}

function wandoujiaAppUrl(packageName: string): string {
  return `https://www.wandoujia.com/apps/${encodeURIComponent(packageName)}`
}

/** 仅当存在应用详情图标块时认为命中小米详情页，避免泛型列表页标题误判 */
function parseXiaomiDetails(html: string): { name?: string; iconUrl?: string } {
  const flower = html.match(/class="yellow-flower"\s+src="([^"]+)"(?:\s+alt="([^"]*)")?/)
  const iconUrl = flower?.[1]?.trim()
  if (!iconUrl) {
    return {}
  }
  let name = flower?.[2]?.trim()

  const h3 = html.match(/<div class="intro-titles">[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/)
  if (h3?.[1]) {
    name = h3[1].trim()
  }

  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim()
  if (!name && title?.endsWith('-小米应用商店')) {
    const n = title.slice(0, -'-小米应用商店'.length).trim()
    if (n && !n.includes('软件商店') && n !== '手机游戏应用商店') {
      name = n
    }
  }

  return { name, iconUrl }
}

function parseWandoujiaDetails(html: string): { name?: string; iconUrl?: string } {
  const iconM = html.match(
    /(https:\/\/android-artworks\.25pp\.com[^"'>\s]+_con_130x130\.png)/,
  )
  const titleRaw = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim()
  let name: string | undefined
  if (titleRaw) {
    const noSuffix = titleRaw.replace(/_豌豆荚.*$/, '')
    const beforeXiazai = noSuffix.match(/^(.+?)下载/)
    name = (beforeXiazai ? beforeXiazai[1] : noSuffix.split('_')[0] ?? '').trim()
    if (!name) {
      name = undefined
    }
  }
  return { name, iconUrl: iconM?.[1]?.trim() }
}

async function fetchIconAsBase64(iconUrl: string): Promise<{ b64?: string; mime?: string }> {
  try {
    const res = await fetch(iconUrl, {
      headers: {
        'User-Agent': UA,
        Referer: iconUrl.includes('wandoujia') || iconUrl.includes('25pp.com')
          ? 'https://www.wandoujia.com/'
          : 'https://app.mi.com/',
      },
    })
    if (!res.ok) {
      return {}
    }
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png'
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 32) {
      return {}
    }
    return { b64: buf.toString('base64'), mime }
  } catch (e) {
    logger.debug('fetch icon failed', iconUrl, e)
    return {}
  }
}

/** 与鸿蒙 `shouldFetchOnlineInfo` 一致：仅第三方应用走在线元数据 */
export function shouldFetchOnlineAndroidInfo(_packageName: string, isSystem: boolean): boolean {
  return !isSystem
}

/**
 * 小米应用商店详情页 + 豌豆荚应用页（与鸿蒙走华为应用市场类似）。
 * 无官方开放 API，依赖页面结构；失败时静默返回空字段。
 */
export async function getOnlineAndroidAppInfo(packageName: string): Promise<OnlineAndroidAppInfo> {
  if (cache.has(packageName)) {
    return cache.get(packageName)!
  }

  let name: string | undefined
  let iconUrl: string | undefined

  try {
    const miRes = await fetch(miDetailsUrl(packageName), {
      headers: { 'User-Agent': UA },
    })
    if (miRes.ok) {
      const miHtml = await miRes.text()
      const mi = parseXiaomiDetails(miHtml)
      name = mi.name
      iconUrl = mi.iconUrl
    }
  } catch (e) {
    logger.debug('xiaomi market fetch failed', packageName, e)
  }

  if (!iconUrl || !name) {
    try {
      const wRes = await fetch(wandoujiaAppUrl(packageName), {
        headers: { 'User-Agent': UA },
      })
      if (wRes.ok) {
        const wHtml = await wRes.text()
        const w = parseWandoujiaDetails(wHtml)
        if (!name && w.name) {
          name = w.name
        }
        if (!iconUrl && w.iconUrl) {
          iconUrl = w.iconUrl
        }
      }
    } catch (e) {
      logger.debug('wandoujia fetch failed', packageName, e)
    }
  }

  let icon: string | undefined
  let iconMimeType: string | undefined
  if (iconUrl) {
    const img = await fetchIconAsBase64(iconUrl)
    icon = img.b64
    iconMimeType = img.mime
  }

  const out: OnlineAndroidAppInfo = { name, icon, iconMimeType }
  cache.set(packageName, out)
  return out
}
