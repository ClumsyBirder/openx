import { shell as androidShell } from './android/base'
import { parseDeviceRef } from './device-ref'
import { shell as harmonyShell } from './harmony/base'

export async function deviceShell(deviceId: string, cmd: string): Promise<string>
export async function deviceShell(deviceId: string, cmd: string[]): Promise<string[]>
export async function deviceShell(
  deviceId: string,
  cmd: string | string[],
): Promise<string | string[]> {
  const ref = parseDeviceRef(deviceId)
  if (!ref) {
    throw new Error(`Invalid device id: ${deviceId}`)
  }

  if (ref.platform === 'android') {
    if (typeof cmd === 'string') {
      return androidShell(ref.key, cmd)
    }
    return androidShell(ref.key, cmd)
  }

  if (typeof cmd === 'string') {
    return harmonyShell(ref.key, cmd)
  }
  return harmonyShell(ref.key, cmd)
}
