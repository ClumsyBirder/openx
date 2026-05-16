import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  Copy,
  FolderOpen,
  Globe,
  Loader2,
  RefreshCw,
  Server,
  Wrench,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import {
  DEFAULT_BASE_URL,
  getBaseUrl,
  resetBaseUrl,
  setBaseUrl,
  testBackendConnection,
} from '@/lib/settings'
import type { ToolkitItemStatus, ToolkitStatusResult } from '../../../shared/toolkit-status'
import { cn } from '@/lib/utils'

function SourceBadge({ source }: { source: ToolkitItemStatus['source'] }): React.JSX.Element {
  const map: Record<ToolkitItemStatus['source'], { label: string; className: string }> = {
    bundled: { label: '内置', className: 'bg-primary/10 text-primary' },
    env: { label: '环境变量', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    system: { label: '系统 PATH', className: 'bg-muted text-muted-foreground' },
  }
  const config = map[source]
  return <span className={cn('inline-block text-[10px] px-1.5 py-0.5 rounded font-medium', config.className)}>{config.label}</span>
}

export function SettingsPage(): React.JSX.Element {
  const [baseUrlInput, setBaseUrlInput] = useState(() => getBaseUrl())
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    message: string
    latencyMs?: number
  } | null>(null)

  const [logPath, setLogPath] = useState<string | null>(null)
  const [toolkit, setToolkit] = useState<ToolkitStatusResult | null>(null)
  const [toolkitLoading, setToolkitLoading] = useState(false)
  const [copiedLog, setCopiedLog] = useState(false)

  const loadToolkit = useCallback(async () => {
    setToolkitLoading(true)
    try {
      const status = await window.api.toolkit.status()
      setToolkit(status)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setToolkitLoading(false)
    }
  }, [])

  useEffect(() => {
    void window.api.log.getPath().then(setLogPath)
    void loadToolkit()
  }, [loadToolkit])

  const handleSaveBaseUrl = () => {
    const trimmed = baseUrlInput.trim()
    if (!trimmed) {
      toast.error('请输入后端地址')
      return
    }
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `http://${trimmed}`)
      setBaseUrl(url.origin)
      setBaseUrlInput(url.origin)
      setTestResult(null)
      toast.success('后端地址已保存')
    } catch {
      toast.error('地址格式无效')
    }
  }

  const handleResetBaseUrl = () => {
    resetBaseUrl()
    setBaseUrlInput(DEFAULT_BASE_URL)
    setTestResult(null)
    toast.success('已恢复默认地址')
  }

  const handleTestConnection = async () => {
    const trimmed = baseUrlInput.trim()
    if (!trimmed) {
      toast.error('请输入后端地址')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      let url = trimmed
      if (!url.startsWith('http')) url = `http://${url}`
      const result = await testBackendConnection(url)
      setTestResult(result)
      if (result.ok) {
        toast.success(`连接成功（${result.latencyMs}ms）`)
      } else {
        toast.error(result.message)
      }
    } finally {
      setTesting(false)
    }
  }

  const handleCopyLogPath = () => {
    if (!logPath) return
    void navigator.clipboard.writeText(logPath)
    setCopiedLog(true)
    setTimeout(() => setCopiedLog(false), 2000)
  }

  return (
    <TooltipProvider>
      <ScrollArea className="h-full -m-1 p-1">
        <div className="w-full h-full">
          <Tabs defaultValue="general" className="w-full h-full">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="general" className="gap-2">
                <Globe className="w-4 h-4" />
                基本设置
              </TabsTrigger>
              <TabsTrigger value="toolkit" className="gap-2">
                <Wrench className="w-4 h-4" />
                设备工具链
              </TabsTrigger>
            </TabsList>

            {/* 基本设置 */}
            <TabsContent value="general" className="h-full space-y-4">
              <div className="rounded-xl border bg-card">
                <div className="flex items-center gap-3 px-4 py-3 border-b">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Server className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">后端服务</h3>
                    <p className="text-xs text-muted-foreground">自动化测试 API 地址</p>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="base-url" className="text-sm">BASE_URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="base-url"
                        value={baseUrlInput}
                        onChange={(e) => setBaseUrlInput(e.target.value)}
                        placeholder={DEFAULT_BASE_URL}
                        className="font-mono text-sm flex-1"
                      />
                      <Button size="sm" onClick={handleSaveBaseUrl}>
                        保存
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleTestConnection()}
                          disabled={testing}
                        >
                          {testing ? (
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-1.5" />
                          )}
                          检测连通性
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>发送 GET /api/global-variables 请求</TooltipContent>
                    </Tooltip>
                    <Button size="sm" variant="ghost" onClick={handleResetBaseUrl}>
                      恢复默认
                    </Button>
                  </div>
                  {testResult ? (
                    <div
                      className={cn(
                        'flex items-center gap-2 text-sm rounded-lg border px-3 py-2',
                        testResult.ok
                          ? 'border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400'
                          : 'border-destructive/30 bg-destructive/5 text-destructive',
                      )}
                    >
                      {testResult.ok ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>
                        {testResult.message}
                        {testResult.latencyMs != null ? ` · ${testResult.latencyMs}ms` : ''}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 应用日志 */}
              <div className="rounded-xl border bg-card">
                <div className="flex items-center gap-3 px-4 py-3 border-b">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FolderOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">应用日志</h3>
                    <p className="text-xs text-muted-foreground">electron-log 日志文件路径</p>
                  </div>
                </div>
                <div className="p-4">
                  {logPath ? (
                    <div className="flex items-start gap-2">
                      <code className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 break-all font-mono">
                        {logPath}
                      </code>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0 h-8 w-8"
                            onClick={handleCopyLogPath}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{copiedLog ? '已复制' : '复制路径'}</TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      加载中…
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* 设备工具链 */}
            <TabsContent value="toolkit" className="h-full space-y-4">
              <div className="rounded-xl border bg-card">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Wrench className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">设备工具链</h3>
                      <p className="text-xs text-muted-foreground">adb / hdc / aapt 就绪状态</p>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        disabled={toolkitLoading}
                        onClick={() => void loadToolkit()}
                      >
                        {toolkitLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>刷新状态</TooltipContent>
                  </Tooltip>
                </div>
                <div className="p-4 space-y-3">
                  {toolkitLoading && !toolkit ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      检测工具链中…
                    </div>
                  ) : toolkit ? (
                    <>
                      <div className="text-[11px] text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1.5">
                        根目录: {toolkit.toolkitRoot}
                      </div>
                      {toolkit.items.map((item) => (
                        <div
                          key={item.name}
                          className={cn(
                            'rounded-lg border p-3',
                            item.ready ? 'border-border' : 'border-amber-500/30 bg-amber-500/5',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{item.label}</span>
                              <Badge
                                variant={item.ready ? 'default' : 'secondary'}
                                className="text-[10px]"
                              >
                                {item.ready ? '就绪' : '不可用'}
                              </Badge>
                            </div>
                            <SourceBadge source={item.source} />
                          </div>
                          <div className="text-xs text-muted-foreground font-mono break-all">
                            {item.bundledPath ?? item.resolved}
                          </div>
                          {item.version && (
                            <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                              {item.version}
                            </div>
                          )}
                          {!item.ready && item.source === 'system' && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                              未在 PATH 中找到，可设置 OPENX_{item.name.toUpperCase()}_PATH 环境变量
                            </p>
                          )}
                        </div>
                      ))}
                    </>
                  ) : null}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </TooltipProvider>
  )
}
