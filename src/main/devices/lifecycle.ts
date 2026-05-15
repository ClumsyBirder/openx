import { startDeviceDiscovery, stopDeviceDiscovery } from './orchestrator'

export async function initDeviceDiscovery(): Promise<void> {
  await startDeviceDiscovery()
}

export function disposeDeviceDiscovery(): void {
  stopDeviceDiscovery()
}
