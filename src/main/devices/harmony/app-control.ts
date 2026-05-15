import { createLogger } from '../../lib/log'
import { shell } from './base'
import { getHdcClient } from './client'

const logger = createLogger('hdcAppControl')

export async function startHarmonyApp(
  connectKey: string,
  bundleName: string,
  mainAbility: string,
): Promise<void> {
  logger.debug('start', { connectKey, bundleName, mainAbility })
  await shell(connectKey, `aa start -a ${mainAbility} -b ${bundleName}`)
}

export async function stopHarmonyApp(connectKey: string, bundleName: string): Promise<void> {
  logger.debug('stop', { connectKey, bundleName })
  await shell(connectKey, `aa force-stop ${bundleName}`)
}

export async function uninstallHarmonyApp(connectKey: string, bundleName: string): Promise<void> {
  logger.debug('uninstall', { connectKey, bundleName })
  await getHdcClient().getTarget(connectKey).uninstall(bundleName)
}
