import AdmZip from 'adm-zip'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { createLogger } from '../../lib/log'
import { resolveAaptExecutable } from '../toolkit-paths'
import { getAdbClient } from './client'

const logger = createLogger('aaptMetadata')

export interface ApkMetadata {
  name?: string
  icon?: string
  iconMimeType?: string
}

function runAapt(args: string[]): Promise<string> {
  const bin = resolveAaptExecutable()
  const cwd = isAbsolute(bin) ? dirname(bin) : undefined

  return new Promise((resolve, reject) => {
    const cp = spawn(bin, args, { windowsHide: true, cwd })
    let stdout = ''
    let stderr = ''
    cp.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    cp.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    cp.on('error', reject)
    cp.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
        return
      }
      reject(new Error(stderr.trim() || `aapt exited with code ${code}`))
    })
  })
}

function parseApplicationLabel(badging: string): string | undefined {
  const labels: Record<string, string> = {}
  for (const raw of badging.split('\n')) {
    const line = raw.trim()
    let m = line.match(/^application-label(?:-([\w-]+))?:'((?:\\'|[^'])*)'/)
    if (m) {
      const key = m[1] ?? 'default'
      labels[key] = m[2].replace(/\\'/g, "'")
      continue
    }
    m = line.match(/^application-label(?:-([\w-]+))?:"((?:\\"|[^"])*)"/)
    if (m) {
      const key = m[1] ?? 'default'
      labels[key] = m[2].replace(/\\"/g, '"')
      continue
    }
    if (line.startsWith('application:')) {
      m = line.match(/\blabel='((?:\\'|[^'])*)'/)
      if (m) {
        labels.default = labels.default ?? m[1].replace(/\\'/g, "'")
        continue
      }
      m = line.match(/\blabel="((?:\\"|[^"])*)"/)
      if (m) {
        labels.default = labels.default ?? m[1].replace(/\\"/g, '"')
      }
    }
  }
  return labels['zh-CN'] ?? labels.zh ?? labels.default ?? Object.values(labels)[0]
}

function parseApplicationIcon(badging: string): string | undefined {
  let bestDensity = -1
  let bestPath: string | undefined
  let fallback: string | undefined

  for (const raw of badging.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('application-icon-')) {
      const dm = line.match(/^application-icon-(\d+):/)
      const pm =
        line.match(/^application-icon-\d+:'([^']+)'/) ??
        line.match(/^application-icon-\d+:"([^"]+)"/)
      if (dm && pm) {
        const d = parseInt(dm[1], 10)
        const p = pm[1]
        if (p.endsWith('.xml')) {
          continue
        }
        if (d > bestDensity) {
          bestDensity = d
          bestPath = p
        }
      }
      continue
    }
    if (line.startsWith('application:')) {
      let m = line.match(/\bicon='([^']+)'/)
      if (!m) {
        m = line.match(/\bicon="([^"]+)"/)
      }
      if (m && !m[1].endsWith('.xml')) {
        fallback = m[1]
      }
    }
  }
  return bestPath ?? fallback
}

function extractIconFromApkWithMime(
  apkPath: string,
  iconEntry: string,
): { icon?: string; iconMimeType?: string } {
  if (iconEntry.endsWith('.xml')) {
    return {}
  }
  try {
    const zip = new AdmZip(apkPath)
    const entry = zip.getEntry(iconEntry)
    if (!entry) {
      return {}
    }
    const ext = iconEntry.split('.').pop()?.toLowerCase()
    const iconMimeType =
      ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
    return {
      icon: entry.getData().toString('base64'),
      iconMimeType,
    }
  } catch (e) {
    logger.debug('extract icon failed', apkPath, iconEntry, e)
    return {}
  }
}

async function pullApk(serial: string, remotePath: string): Promise<string> {
  const safeSerial = serial.replace(/[^\w.-]+/g, '_')
  const dir = join(tmpdir(), 'openx-apk', safeSerial)
  await mkdir(dir, { recursive: true })
  const fileName = `${Buffer.from(remotePath).toString('base64url')}.apk`
  const localPath = join(dir, fileName)

  const device = getAdbClient().getDevice(serial)
  const stream = await device.pull(remotePath)
  await pipeline(stream, createWriteStream(localPath))
  return localPath
}

/** 通过 pull APK + aapt 解析应用 label 与图标 */
export async function getApkMetadata(
  serial: string,
  remoteApkPath: string,
): Promise<ApkMetadata> {
  try {
    const localApk = await pullApk(serial, remoteApkPath)
    const badging = await runAapt(['dump', 'badging', localApk])
    const name = parseApplicationLabel(badging)
    const iconEntry = parseApplicationIcon(badging)
    const iconData = iconEntry ? extractIconFromApkWithMime(localApk, iconEntry) : {}
    return { name, ...iconData }
  } catch (e) {
    logger.warn('getApkMetadata failed', { serial, remoteApkPath, error: e })
    return {}
  }
}
