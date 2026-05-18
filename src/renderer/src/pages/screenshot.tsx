import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  Download,
  Loader2,
  Columns2,
  Rows2,
  Layers,
  ImageIcon,
  X,
  Copy,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDevicesStore } from '../stores/devices'
import { cn } from '@/lib/utils'
import ImageEditor from 'tui-image-editor'
import 'tui-image-editor/dist/tui-image-editor.css'
import {
  formatHistoryTime,
  MAX_SCREENSHOT_HISTORY,
  stitchImages,
  type ScreenshotHistoryItem,
  type StitchDirection,
} from '../lib/screenshot-history'

const BLANK_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const DARK_THEME = {
  'common.bi.image': '',
  'common.bisize.width': '0px',
  'common.bisize.height': '0px',
  'common.backgroundImage': 'none',
  'common.backgroundColor': '#1a1a2e',
  'common.border': '0px',
  'header.backgroundImage': 'none',
  'header.backgroundColor': '#1a1a2e',
  'header.border': '0px',
  'menu.normalIcon.path': '',
  'menu.normalIcon.name': 'icon-d',
  'menu.activeIcon.path': '',
  'menu.activeIcon.name': 'icon-b',
  'menu.disabledIcon.path': '',
  'menu.disabledIcon.name': 'icon-a',
  'menu.hoverIcon.path': '',
  'menu.hoverIcon.name': 'icon-c',
  'menu.iconSize.width': '24px',
  'menu.iconSize.height': '24px',
  'submenu.backgroundColor': '#1e1e2e',
  'submenu.partition.color': '#3b3b5c',
  'submenu.normalIcon.path': '',
  'submenu.normalIcon.name': 'icon-d',
  'submenu.activeIcon.path': '',
  'submenu.activeIcon.name': 'icon-b',
  'submenu.iconSize.width': '18px',
  'submenu.iconSize.height': '18px',
  'submenu.normalLabel.color': '#aaa',
  'submenu.normalLabel.fontWeight': 'normal',
  'submenu.activeLabel.color': '#fff',
  'submenu.activeLabel.fontWeight': 'normal',
  'checkbox.border': '1px solid #ccc',
  'checkbox.backgroundColor': '#fff',
  'range.pointer.color': '#6ee7b7',
  'range.bar.color': '#2d2d4a',
  'range.subbar.color': '#6ee7b7',
  'range.value.color': '#fff',
  'range.value.fontWeight': 'normal',
  'range.value.fontSize': '11px',
  'range.value.border': '1px solid #353660',
  'range.value.backgroundColor': '#151527',
  'range.title.color': '#ccc',
  'range.title.fontWeight': 'lighter',
  'colorpicker.button.border': '1px solid #1e1e2e',
  'colorpicker.title.color': '#fff',
}

export function ScreenshotPage(): React.JSX.Element {
  const selectedId = useDevicesStore((s) => s.selectedId)
  const selectedDevice = useDevicesStore((s) => s.devices.find((d) => d.id === selectedId))

  const [loading, setLoading] = useState(false)
  const [stitching, setStitching] = useState(false)
  const [hasImage, setHasImage] = useState(false)
  const [captureHistory, setCaptureHistory] = useState<ScreenshotHistoryItem[]>([])
  const [selectedCaptureIds, setSelectedCaptureIds] = useState<Set<string>>(new Set())

  const editorContainerRef = useRef<HTMLDivElement>(null)
  const editorWrapRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<ImageEditor | null>(null)
  const initSizeRef = useRef<{ w: number; h: number } | null>(null)

  // Initialize tui-image-editor once on mount
  useEffect(() => {
    const container = editorContainerRef.current
    if (!container) return

    const wrap = editorWrapRef.current
    const rect = wrap?.getBoundingClientRect()
    const w = Math.max(rect?.width ?? 0, 400)
    const h = Math.max(rect?.height ?? 0, 300)
    initSizeRef.current = { w, h }

    const instance = new ImageEditor(container, {
      includeUI: {
        loadImage: { path: BLANK_IMAGE, name: 'blank' },
        theme: DARK_THEME,
        menu: ['draw', 'shape', 'text', 'filter'],
        menuBarPosition: 'bottom',
        uiSize: { width: `${w}px`, height: `${h}px` },
        usageStatistics: false,
      },
      cssMaxWidth: 10000,
      cssMaxHeight: 10000,
      usageStatistics: false,
    })

    instanceRef.current = instance

    return () => {
      instance.destroy()
      instanceRef.current = null
    }
  }, [])

  // ResizeObserver: keep editor sized to wrapper
  useEffect(() => {
    const wrap = editorWrapRef.current
    if (!wrap) return

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width < 1 || height < 1) return
      const instance = instanceRef.current
      if (!instance) return
      instance.ui.resizeEditor({
        uiSize: { width: `${Math.floor(width)}px`, height: `${Math.floor(height)}px` },
      })
    })

    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  const exportSnapshot = useCallback((): string | null => {
    const instance = instanceRef.current
    if (!instance || !hasImage) return null
    try {
      return instance.toDataURL()
    } catch {
      return null
    }
  }, [hasImage])

  const loadIntoEditor = useCallback(async (dataUrl: string, name: string): Promise<void> => {
    const instance = instanceRef.current
    if (!instance) return
    await instance.loadImageFromURL(dataUrl, name)
    setHasImage(true)
  }, [])

  const pushCaptureHistory = useCallback(
    (dataUrl: string) => {
      const item: ScreenshotHistoryItem = {
        id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dataUrl,
        createdAt: Date.now(),
        deviceId: selectedId ?? undefined,
        deviceName: selectedDevice?.displayName,
      }
      setCaptureHistory((prev) => [item, ...prev].slice(0, MAX_SCREENSHOT_HISTORY))
      return item.id
    },
    [selectedId, selectedDevice],
  )

  const handleScreenshot = useCallback(async () => {
    if (!selectedId) {
      toast.error('请先选择设备')
      return
    }

    setLoading(true)
    try {
      const result = await window.api.screencap.capture(selectedId)
      if (result.ok) {
        const dataUrl = `data:${result.mimeType};base64,${result.data}`
        await loadIntoEditor(dataUrl, `screenshot-${Date.now()}`)
        pushCaptureHistory(dataUrl)
        setSelectedCaptureIds(new Set())
        toast.success('截图成功')
      } else {
        toast.error(result.error || '截图失败')
      }
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }, [selectedId, loadIntoEditor, pushCaptureHistory])

  const handleCopy = useCallback(async () => {
    const dataUrl = exportSnapshot()
    if (!dataUrl) {
      toast.error('没有可复制的图片')
      return
    }
    try {
      const blob = await fetch(dataUrl).then((r) => r.blob())
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast.success('已复制到剪贴板')
    } catch {
      toast.error('复制失败，请检查系统剪贴板权限')
    }
  }, [exportSnapshot])

  const handleDownload = useCallback(() => {
    const dataUrl = exportSnapshot()
    if (!dataUrl) {
      toast.error('没有可下载的图片')
      return
    }
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `screenshot-${Date.now()}.png`
    link.click()
    toast.success('保存成功')
  }, [exportSnapshot])

  const getOrderedSelectedItems = useCallback((): ScreenshotHistoryItem[] => {
    return captureHistory
      .filter((item) => selectedCaptureIds.has(item.id))
      .sort((a, b) => a.createdAt - b.createdAt)
  }, [captureHistory, selectedCaptureIds])

  const toggleCaptureSelection = useCallback((id: string) => {
    setSelectedCaptureIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const loadSingleCapture = useCallback(
    async (item: ScreenshotHistoryItem) => {
      await loadIntoEditor(item.dataUrl, `cap-${item.id}`)
      setSelectedCaptureIds(new Set([item.id]))
      toast.success('已加载到画布')
    },
    [loadIntoEditor],
  )

  const runStitch = useCallback(
    async (direction: StitchDirection, includeCurrentCanvas: boolean) => {
      const selected = getOrderedSelectedItems()
      const urls = selected.map((item) => item.dataUrl)

      if (includeCurrentCanvas) {
        const current = exportSnapshot()
        if (!current) {
          toast.error('当前画布为空，请先截图或加载图片')
          return
        }
        urls.unshift(current)
      }

      if (urls.length < 2) {
        toast.error(includeCurrentCanvas ? '请至少再选择一张历史截图' : '请至少选择两张历史截图')
        return
      }

      setStitching(true)
      try {
        const merged = await stitchImages(urls, direction)
        await loadIntoEditor(merged, `stitch-${Date.now()}`)
        pushCaptureHistory(merged)
        setSelectedCaptureIds(new Set())
        toast.success(includeCurrentCanvas ? '已拼接到画布' : '拼接完成')
      } catch (e) {
        toast.error(String(e))
      } finally {
        setStitching(false)
      }
    },
    [getOrderedSelectedItems, exportSnapshot, loadIntoEditor, pushCaptureHistory],
  )

  const removeSelectedFromHistory = useCallback(() => {
    if (selectedCaptureIds.size === 0) {
      toast.error('请先选择要删除的历史记录')
      return
    }
    setCaptureHistory((prev) => prev.filter((item) => !selectedCaptureIds.has(item.id)))
    setSelectedCaptureIds(new Set())
    toast.success('已删除选中记录')
  }, [selectedCaptureIds])

  const clearCaptureHistory = useCallback(() => {
    setCaptureHistory([])
    setSelectedCaptureIds(new Set())
    toast.success('历史记录已清空')
  }, [])

  if (!selectedId) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center h-full text-muted-foreground">
          请先在标题栏选择设备
        </div>
      </div>
    )
  }

  const selectedCount = selectedCaptureIds.size
  const busy = loading || stitching

  const ToolButton = ({
    icon: Icon,
    onClick,
    title,
    disabled,
  }: {
    icon: React.ComponentType<{ className?: string }>
    onClick: () => void
    title: string
    disabled?: boolean
  }) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <span className="text-sm font-medium text-muted-foreground">截图工具</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleScreenshot} disabled={busy} title="截图">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!hasImage || busy}>
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={!hasImage || busy}>
            <Download className="w-4 h-4 mr-1" />
            保存
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        {/* Editor area */}
        <div
          ref={editorWrapRef}
          className="relative flex-1 min-h-0 overflow-hidden rounded-lg tui-screenshot-editor"
        >
          {!hasImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground pointer-events-none z-10">
              <Camera className="w-16 h-16 opacity-40" />
              <p>点击「截图」按钮获取设备屏幕截图</p>
              <p className="text-xs">支持历史记录多选拼接</p>
            </div>
          )}
          <div ref={editorContainerRef} className="w-full h-full" />
        </div>

        {/* History sidebar */}
        <aside className="w-48 shrink-0 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-border shrink-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-medium">历史记录</span>
              <span className="text-xs text-muted-foreground">{captureHistory.length}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">单击多选 · 双击加载</p>
          </div>

          <div className="p-2 flex items-center gap-1 shrink-0">
            <ToolButton
              icon={Columns2}
              onClick={() => runStitch('horizontal', false)}
              title="横向拼接"
              disabled={busy || selectedCount < 2}
            />
            <ToolButton
              icon={Rows2}
              onClick={() => runStitch('vertical', false)}
              title="纵向拼接"
              disabled={busy || selectedCount < 2}
            />
            <ToolButton
              icon={Layers}
              onClick={() => runStitch('horizontal', true)}
              title="拼接到画布"
              disabled={busy || !hasImage || selectedCount < 1}
            />
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            <ToolButton
              icon={Trash2}
              onClick={removeSelectedFromHistory}
              title="删除选中"
              disabled={selectedCount === 0 || busy}
            />
            <ToolButton
              icon={X}
              onClick={clearCaptureHistory}
              title="清空历史"
              disabled={captureHistory.length === 0 || busy}
            />
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-2 pr-3">
              {captureHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-xs gap-2">
                  <ImageIcon className="w-8 h-8 opacity-40" />
                  暂无历史截图
                </div>
              ) : (
                captureHistory.map((item) => {
                  const selected = selectedCaptureIds.has(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        'w-full rounded-md border p-1 text-left transition-colors',
                        selected
                          ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                          : 'border-border hover:border-primary/50',
                      )}
                      onClick={() => toggleCaptureSelection(item.id)}
                      onDoubleClick={(e) => {
                        e.preventDefault()
                        loadSingleCapture(item)
                      }}
                    >
                      <img
                        src={item.dataUrl}
                        alt=""
                        className="w-full aspect-video object-cover rounded bg-muted"
                        draggable={false}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1 truncate px-0.5">
                        {formatHistoryTime(item.createdAt)}
                      </p>
                      {item.deviceName && (
                        <p className="text-[10px] text-muted-foreground truncate px-0.5">
                          {item.deviceName}
                        </p>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  )
}
