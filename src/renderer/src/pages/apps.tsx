import { useCallback, useEffect, useState } from 'react'
import {
  Search,
  Smartphone,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Filter,
  Grid3X3,
  List,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DeviceApp } from '../../../shared/device-app'
import { appIconSrc } from '../lib/app-icon'
import { useDevicesStore } from '../stores/devices'

export function AppsPage(): React.JSX.Element {
  const selectedId = useDevicesStore((s) => s.selectedId)
  const selectedDevice = useDevicesStore((s) => s.devices.find((d) => d.id === selectedId))

  const [apps, setApps] = useState<DeviceApp[]>([])
  const [loading, setLoading] = useState(false)
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [uninstallTarget, setUninstallTarget] = useState<DeviceApp | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'user' | 'system'>('user')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  const fetchApps = useCallback(async () => {
    if (!selectedId) {
      setApps([])
      return
    }

    setLoading(true)
    try {
      const result = await window.api.apps.list(selectedId, {
        includeSystem: filterType !== 'user',
      })
      if (result.ok) {
        let list = result.apps
        if (filterType === 'system') {
          list = list.filter((app) => app.isSystem)
        }
        setApps(list)
      } else {
        setApps([])
        toast.error(result.error)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedId, filterType])

  useEffect(() => {
    void fetchApps()
  }, [fetchApps])

  const handleStart = async (app: DeviceApp) => {
    if (!selectedId) return
    const key = `start:${app.packageName}`
    setActionKey(key)
    try {
      const result = await window.api.apps.start(selectedId, {
        packageName: app.packageName,
        mainAbility: app.mainAbility,
      })
      if (result.ok) {
        toast.success(`已启动 ${app.name}`)
      } else {
        toast.error(result.error)
      }
    } finally {
      setActionKey(null)
    }
  }

  const handleStop = async (app: DeviceApp) => {
    if (!selectedId) return
    const key = `stop:${app.packageName}`
    setActionKey(key)
    try {
      const result = await window.api.apps.stop(selectedId, app.packageName)
      if (result.ok) {
        toast.success(`已停止 ${app.name}`)
      } else {
        toast.error(result.error)
      }
    } finally {
      setActionKey(null)
    }
  }

  const handleUninstallConfirm = async () => {
    if (!selectedId || !uninstallTarget) return
    const app = uninstallTarget
    const key = `uninstall:${app.packageName}`
    setActionKey(key)
    try {
      const result = await window.api.apps.uninstall(selectedId, app.packageName)
      if (result.ok) {
        toast.success(`已卸载 ${app.name}`)
        setApps((prev) => prev.filter((item) => item.packageName !== app.packageName))
      } else {
        toast.error(result.error)
      }
    } finally {
      setActionKey(null)
      setUninstallTarget(null)
    }
  }

  const filteredApps = apps.filter((app) => {
    const q = search.toLowerCase()
    return (
      app.name.toLowerCase().includes(q) ||
      app.packageName.toLowerCase().includes(q)
    )
  })

  const renderActions = (app: DeviceApp, compact = false) => {
    const busy = actionKey?.endsWith(`:${app.packageName}`) ?? false
    const btnClass = compact ? 'h-7 w-7' : 'h-8 w-8'
    const iconClass = compact ? 'w-3.5 h-3.5' : 'w-4 h-4'

    return (
      <div className={`flex items-center ${compact ? 'gap-1' : 'justify-end gap-1'}`}>
        <Button
          variant="ghost"
          size="icon"
          className={btnClass}
          title="启动"
          disabled={busy || loading}
          onClick={() => void handleStart(app)}
        >
          {actionKey === `start:${app.packageName}` ? (
            <Loader2 className={`${iconClass} animate-spin`} />
          ) : (
            <Play className={iconClass} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={btnClass}
          title="停止"
          disabled={busy || loading}
          onClick={() => void handleStop(app)}
        >
          {actionKey === `stop:${app.packageName}` ? (
            <Loader2 className={`${iconClass} animate-spin`} />
          ) : (
            <Pause className={iconClass} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={btnClass}
          title="卸载"
          disabled={busy || loading || app.isSystem}
          onClick={() => setUninstallTarget(app)}
        >
          <Trash2 className={`${iconClass} text-destructive`} />
        </Button>
      </div>
    )
  }

  if (!selectedId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        请先在标题栏选择设备
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="relative flex-1 min-w-[200px] max-w-[400px]">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="搜索应用名称或包名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
          <SelectTrigger className="w-[120px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部应用</SelectItem>
            <SelectItem value="user">用户应用</SelectItem>
            <SelectItem value="system">系统应用</SelectItem>
          </SelectContent>
        </Select>

        {selectedDevice && (
          <span className="text-xs text-muted-foreground hidden lg:inline truncate max-w-[200px]">
            {selectedDevice.displayName}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-none h-8 w-8"
              onClick={() => setViewMode('table')}
            >
              <List className={`w-4 h-4 ${viewMode === 'table' ? 'text-primary' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-none h-8 w-8"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className={`w-4 h-4 ${viewMode === 'grid' ? 'text-primary' : ''}`} />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={() => void fetchApps()} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            刷新
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && apps.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {search ? '没有找到应用' : '暂无应用数据'}
          </div>
        ) : viewMode === 'table' ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>应用</TableHead>
                <TableHead>包名</TableHead>
                <TableHead>版本</TableHead>
                <TableHead className="w-[150px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApps.map((app) => {
                const iconSrc = appIconSrc(app)
                return (
                  <TableRow key={app.packageName}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center overflow-hidden shrink-0">
                          {iconSrc ? (
                            <img src={iconSrc} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Smartphone className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{app.name}</div>
                          {app.isSystem && (
                            <Badge variant="secondary" className="text-xs mt-0.5">系统应用</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {app.packageName}
                      </code>
                    </TableCell>
                    <TableCell>
                      {app.version || '-'}
                      {app.versionCode != null ? (
                        <span className="text-muted-foreground text-xs ml-1">({app.versionCode})</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{renderActions(app)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-1">
            {filteredApps.map((app) => {
              const iconSrc = appIconSrc(app)
              return (
                <div
                  key={app.packageName}
                  className="bg-card rounded-xl border border-border p-4 hover:border-primary/50 transition-colors group"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mb-3 overflow-hidden">
                      {iconSrc ? (
                        <img src={iconSrc} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Smartphone className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="mb-1">
                      <span className="font-medium truncate max-w-[120px] block">{app.name}</span>
                    </div>
                    <code className="text-[10px] text-muted-foreground truncate max-w-full mb-2">
                      {app.packageName}
                    </code>
                    <div className="text-xs text-muted-foreground mb-3">
                      {app.version ? `v${app.version}` : '-'}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {renderActions(app, true)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog open={uninstallTarget != null} onOpenChange={(open) => !open && setUninstallTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认卸载</AlertDialogTitle>
            <AlertDialogDescription>
              确定要卸载「{uninstallTarget?.name}」（{uninstallTarget?.packageName}）吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleUninstallConfirm()}
            >
              卸载
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
