import type { DeviceApp } from '../../../shared/device-app'

export function appIconSrc(app: DeviceApp): string | undefined {
  if (!app.icon) {
    return undefined
  }
  const mime = app.iconMimeType ?? 'image/png'
  return `data:${mime};base64,${app.icon}`
}
