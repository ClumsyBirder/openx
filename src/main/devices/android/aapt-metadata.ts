import AdmZip from 'adm-zip'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  if (!bin) {
    return Promise.reject(new Error('aapt not found'))
  }

  return new Promise((resolve, reject) => {
    const cp = spawn(bin, args, { windowsHide: true })
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
  for (const line of badging.split('\n')) {
    const match = line.match(/^application-label(?:-([\w-]+))?:'((?:\\'|[^'])*)'/)
    if (match) {
      const key = match[1] ?? 'default'
      labels[key] = match[2].replace(/\\'/g, "'")
    }
  }
  return labels['zh-CN'] ?? labels.zh ?? labels.default ?? Object.values(labels)[0]
}

function parseApplicationIcon(badging: string): string | undefined {
  for (const line of badging.split('\n')) {
    if (!line.startsWith('application:')) {
      continue
    }
    const match = line.match(/icon='([^']+)'/)
    if (match) {
      return match[1]
    }
  }
  return undefined
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
  if (!resolveAaptExecutable()) {
    return {}
  }

  try {
    const localApk = await pullApk(serial, remoteApkPath)
    const badging = await runAapt(['dump', 'badging', localApk])
    const name = parseApplicationLabel(badging)
    const iconEntry = parseApplicationIcon(badging)
    const iconData = iconEntry ? extractIconFromApkWithMime(localApk, iconEntry) : {}
    return { name, ...iconData }
  } catch (e) {
    logger.debug('getApkMetadata failed', { serial, remoteApkPath, error: e })
    return {}
  }
}
