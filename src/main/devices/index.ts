// Android 设备驱动
export * from './android'

// Harmony 设备驱动
export * from './harmony'

// 公共模块
export { getDevicesSnapshot, startDeviceDiscovery, stopDeviceDiscovery } from './orchestrator'
export { initDeviceDiscovery, disposeDeviceDiscovery } from './lifecycle'
export { startDeviceApp, stopDeviceApp, uninstallDeviceApp } from './app-control'
export { listDeviceApps } from './apps'
export { captureDeviceScreenshot } from './screencap'
export { deviceShell } from './shell'
export type { UnifiedDevice, UnifiedDevicePlatform, UnifiedDeviceState } from './types'
