import type { IpcMainInvokeEvent } from 'electron'
import type { ShellExecResult } from '../../../shared/shell'
import { createLogger } from '../../lib/log'
import { logErr } from '../../devices/device-ref'
import { deviceShell } from '../../devices/shell'

const logger = createLogger('ipc:shell')

export async function handleShellExec(
  _event: IpcMainInvokeEvent,
  deviceId: string,
  cmd: string,
): Promise<ShellExecResult> {
  try {
    const output = await deviceShell(deviceId, cmd)
    return { ok: true, output: output as string }
  } catch (e) {
    logger.warn('shell:exec failed', { deviceId, cmd, error: logErr(e).errMessage })
    return { ok: false, error: logErr(e).errMessage }
  }
}
