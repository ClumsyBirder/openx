import type { DeviceApp } from '../../../shared/device-app'

export function appIconSrc(app: DeviceApp): string | undefined {
  if (!app.icon) {
    return undefined
  }
  if (app.icon.startsWith('http') || app.icon.startsWith('data:')) {
    return app.icon
  }
  const mime = app.iconMimeType ?? 'image/png'
  return `data:${mime};base64,${app.icon}`
}
