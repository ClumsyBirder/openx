/** 主进程 ↔ 渲染进程 IPC 通道名（main / preload 共用） */
export const IPC = {
  window: {
    minimize: 'window-minimize',
    maximize: 'window-maximize',
    close: 'window-close',
    isMaximized: 'window-is-maximized',
  },
  devices: {
    list: 'devices:list',
    listChanged: 'devices:list-changed',
  },
  shell: {
    exec: 'shell:exec',
  },
  apps: {
    list: 'apps:list',
    start: 'apps:start',
    stop: 'apps:stop',
    uninstall: 'apps:uninstall',
    install: 'apps:install',
  },
  screencap: {
    capture: 'screencap:capture',
  },
  log: {
    getPath: 'log:get-path',
  },
  debug: {
    ping: 'ping',
  },
} as const
