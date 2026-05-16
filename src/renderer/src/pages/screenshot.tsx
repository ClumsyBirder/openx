import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  Download,
  Loader2,
  MousePointer2,
  Square,
  Circle,
  ArrowRight,
  Type,
  Pencil,
  Undo2,
  Redo2,
  Trash2,
  Minus,
  Columns2,
  Rows2,
  Layers,
  ImageIcon,
  X,
  Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDevicesStore } from '../stores/devices'
import { cn } from '@/lib/utils'
import {
  formatHistoryTime,
  MAX_SCREENSHOT_HISTORY,
  stitchImages,
  type ScreenshotHistoryItem,
  type StitchDirection,
} from '../lib/screenshot-history'

/** 绘图工具类型 */
export type DrawTool = 'select' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'pencil'

interface DrawStyle {
  strokeColor: string
  fillColor: string
  lineWidth: number
}

interface BaseShape {
  id: string
  tool: DrawTool
  style: DrawStyle
  startX: number
  startY: number
  endX: number
  endY: number
}

interface ArrowShape extends BaseShape {
  tool: 'arrow'
}

interface TextShape extends BaseShape {
  tool: 'text'
  text: string
}

interface PencilShape {
  id: string
  tool: 'pencil'
  style: DrawStyle
  points: { x: number; y: number }[]
}

interface OtherShape extends BaseShape {
  tool: 'rect' | 'ellipse'
}

type Shape = ArrowShape | TextShape | PencilShape | OtherShape

interface TextEditorState {
  canvasX: number
  canvasY: number
  value: string
}

const DEFAULT_STYLE: DrawStyle = {
  strokeColor: '#ef4444',
  fillColor: 'transparent',
  lineWidth: 3,
}

const COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#000000',
  '#ffffff',
]

const TEXT_LINE_HEIGHT_RATIO = 1.25

function getTextFontSize(shape: TextShape): number {
  return Math.max(12, shape.style.lineWidth * 6)
}

function measureTextShape(
  ctx: CanvasRenderingContext2D,
  shape: TextShape,
): { width: number; height: number; lineHeight: number } {
  const fontSize = getTextFontSize(shape)
  const lineHeight = fontSize * TEXT_LINE_HEIGHT_RATIO
  ctx.font = `${fontSize}px sans-serif`
  const lines = shape.text.split('\n')
  let width = 0
  for (const line of lines) {
    width = Math.max(width, ctx.measureText(line).width)
  }
  return {
    width,
    height: Math.max(lineHeight, lines.length * lineHeight),
    lineHeight,
  }
}

function hitTestText(
  ctx: CanvasRenderingContext2D,
  shape: TextShape,
  x: number,
  y: number,
  padding = 6,
): boolean {
  const { width, height } = measureTextShape(ctx, shape)
  return (
    x >= shape.startX - padding &&
    x <= shape.startX + width + padding &&
    y >= shape.startY - padding &&
    y <= shape.startY + height + padding
  )
}

function drawTextShape(ctx: CanvasRenderingContext2D, shape: TextShape): void {
  const fontSize = getTextFontSize(shape)
  const lineHeight = fontSize * TEXT_LINE_HEIGHT_RATIO
  ctx.font = `${fontSize}px sans-serif`
  ctx.fillStyle = shape.style.strokeColor
  ctx.textBaseline = 'top'
  const lines = shape.text.split('\n')
  lines.forEach((line, index) => {
    ctx.fillText(line, shape.startX, shape.startY + index * lineHeight)
  })
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
  ctx.strokeStyle = shape.style.strokeColor
  ctx.fillStyle = shape.style.fillColor
  ctx.lineWidth = shape.style.lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (shape.tool) {
    case 'rect':
      ctx.strokeRect(shape.startX, shape.startY, shape.endX - shape.startX, shape.endY - shape.startY)
      break

    case 'ellipse': {
      const cx = (shape.startX + shape.endX) / 2
      const cy = (shape.startY + shape.endY) / 2
      const rx = Math.abs(shape.endX - shape.startX) / 2
      const ry = Math.abs(shape.endY - shape.startY) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    }

    case 'arrow':
      drawArrow(ctx, shape.startX, shape.startY, shape.endX, shape.endY)
      break

    case 'pencil': {
      const pts = shape.points
      if (pts.length === 1) {
        ctx.fillStyle = shape.style.strokeColor
        ctx.beginPath()
        ctx.arc(pts[0].x, pts[0].y, shape.style.lineWidth / 2, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y)
      }
      ctx.stroke()
      break
    }

    case 'text':
      drawTextShape(ctx, shape)
      break
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): void {
  const headLen = 15
  const angle = Math.atan2(toY - fromY, toX - fromX)

  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 6),
    toY - headLen * Math.sin(angle - Math.PI / 6),
  )
  ctx.moveTo(toX, toY)
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 6),
    toY - headLen * Math.sin(angle + Math.PI / 6),
  )
  ctx.stroke()
}

function computeCanvasSize(
  img: HTMLImageElement,
  container: HTMLElement,
): { width: number; height: number } {
  const padding = 32
  const rect = container.getBoundingClientRect()
  const maxWidth = Math.max(rect.width - padding * 2, 64)
  const maxHeight = Math.max(rect.height - padding * 2, 64)

  const imgRatio = img.naturalWidth / img.naturalHeight
  const containerRatio = maxWidth / maxHeight

  if (imgRatio > containerRatio) {
    const width = Math.min(maxWidth, img.naturalWidth)
    return { width, height: width / imgRatio }
  }
  const height = Math.min(maxHeight, img.naturalHeight)
  return { width: height * imgRatio, height }
}

export function ScreenshotPage(): React.JSX.Element {
  const selectedId = useDevicesStore((s) => s.selectedId)
  const selectedDevice = useDevicesStore((s) => s.devices.find((d) => d.id === selectedId))

  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [stitching, setStitching] = useState(false)
  const [tool, setTool] = useState<DrawTool>('select')
  const [style, setStyle] = useState<DrawStyle>(DEFAULT_STYLE)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [shapeStacks, setShapeStacks] = useState<Shape[][]>([[]])
  const [shapeStackIndex, setShapeStackIndex] = useState(0)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentShape, setCurrentShape] = useState<Shape | null>(null)
  const [imageReady, setImageReady] = useState(false)
  const [layoutTick, setLayoutTick] = useState(0)

  const [captureHistory, setCaptureHistory] = useState<ScreenshotHistoryItem[]>([])
  const [selectedCaptureIds, setSelectedCaptureIds] = useState<Set<string>>(new Set())
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)
  const textEditorSuppressBlurRef = useRef(false)
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [textDrag, setTextDrag] = useState<{ id: string; offsetX: number; offsetY: number } | null>(
    null,
  )
  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const shapeStacksRef = useRef(shapeStacks)
  const shapeStackIndexRef = useRef(shapeStackIndex)

  shapeStacksRef.current = shapeStacks
  shapeStackIndexRef.current = shapeStackIndex

  const resetAnnotations = useCallback(() => {
    setShapes([])
    setShapeStacks([[]])
    setShapeStackIndex(0)
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

  const applyBaseImage = useCallback(
    (dataUrl: string, options?: { resetAnnotations?: boolean; addToHistory?: boolean }) => {
      setScreenshot(dataUrl)
      if (options?.resetAnnotations !== false) {
        resetAnnotations()
      }
      if (options?.addToHistory) {
        pushCaptureHistory(dataUrl)
      }
    },
    [pushCaptureHistory, resetAnnotations],
  )

  const getOrderedSelectedItems = useCallback((): ScreenshotHistoryItem[] => {
    return captureHistory
      .filter((item) => selectedCaptureIds.has(item.id))
      .sort((a, b) => a.createdAt - b.createdAt)
  }, [captureHistory, selectedCaptureIds])

  const exportCanvasSnapshot = useCallback((): string | null => {
    const canvas = canvasRef.current
    if (!canvas || !imageReady || canvas.width < 1) {
      return null
    }
    return canvas.toDataURL('image/png')
  }, [imageReady])

  const handleScreenshot = useCallback(async () => {
    if (!selectedId) {
      toast.error('请先选择设备')
      return
    }

    setLoading(true)
    setImageReady(false)
    try {
      const result = await window.api.screencap.capture(selectedId)
      if (result.ok) {
        const dataUrl = `data:${result.mimeType};base64,${result.data}`
        applyBaseImage(dataUrl, { resetAnnotations: true, addToHistory: false })
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
  }, [selectedId, applyBaseImage, pushCaptureHistory])

  useEffect(() => {
    if (!screenshot) {
      imageRef.current = null
      setImageReady(false)
      return
    }

    setImageReady(false)
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      setImageReady(true)
    }
    img.onerror = () => {
      imageRef.current = null
      setImageReady(false)
      toast.error('截图图片加载失败')
    }
    img.src = screenshot

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [screenshot])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !imageReady) {
      return
    }

    const ro = new ResizeObserver(() => {
      setLayoutTick((n) => n + 1)
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [imageReady])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const img = imageRef.current
    if (!canvas || !container || !img || !imageReady) {
      return
    }

    const { width, height } = computeCanvasSize(img, container)
    if (width < 1 || height < 1) {
      return
    }

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)

    for (const shape of shapes) {
      drawShape(ctx, shape)
      if (shape.tool === 'text' && shape.id === selectedTextId) {
        const { width, height } = measureTextShape(ctx, shape)
        ctx.save()
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.strokeRect(shape.startX - 4, shape.startY - 4, width + 8, height + 8)
        ctx.restore()
      }
    }

    if (currentShape) {
      ctx.save()
      if (isDrawing && currentShape.tool !== 'pencil') {
        ctx.setLineDash([5, 5])
      }
      drawShape(ctx, currentShape)
      ctx.restore()
    }
  }, [imageReady, layoutTick, shapes, currentShape, isDrawing, selectedTextId])

  const getTextEditorDisplayPos = useCallback((canvasX: number, canvasY: number) => {
    const canvas = canvasRef.current
    if (!canvas || canvas.width < 1 || canvas.height < 1) {
      return null
    }
    const rect = canvas.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) {
      return null
    }
    return {
      left: (canvasX / canvas.width) * rect.width,
      top: (canvasY / canvas.height) * rect.height,
    }
  }, [])

  useEffect(() => {
    if (!textEditor) {
      return
    }
    textEditorSuppressBlurRef.current = true
    const raf = requestAnimationFrame(() => {
      textInputRef.current?.focus({ preventScroll: true })
      requestAnimationFrame(() => {
        textEditorSuppressBlurRef.current = false
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [textEditor])

  const saveShapeHistory = useCallback((newShapes: Shape[]) => {
    const idx = shapeStackIndexRef.current
    const prev = shapeStacksRef.current
    const next = [...prev.slice(0, idx + 1), newShapes]
    setShapeStacks(next)
    setShapeStackIndex(next.length - 1)
  }, [])

  const undo = useCallback(() => {
    setShapeStackIndex((i) => {
      if (i <= 0) {
        return i
      }
      const next = i - 1
      setShapes(shapeStacksRef.current[next] ?? [])
      return next
    })
  }, [])

  const redo = useCallback(() => {
    setShapeStackIndex((i) => {
      const stack = shapeStacksRef.current
      if (i >= stack.length - 1) {
        return i
      }
      const next = i + 1
      setShapes(stack[next] ?? [])
      return next
    })
  }, [])

  const handleClear = useCallback(() => {
    setShapes([])
    saveShapeHistory([])
  }, [saveShapeHistory])

  const deleteShape = useCallback(
    (id: string) => {
      const next = shapes.filter((s) => s.id !== id)
      setShapes(next)
      saveShapeHistory(next)
    },
    [shapes, saveShapeHistory],
  )

  const toggleCaptureSelection = useCallback((id: string) => {
    setSelectedCaptureIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const loadSingleCapture = useCallback(
    (item: ScreenshotHistoryItem) => {
      applyBaseImage(item.dataUrl)
      setSelectedCaptureIds(new Set([item.id]))
      toast.success('已加载到画布')
    },
    [applyBaseImage],
  )

  const runStitch = useCallback(
    async (direction: StitchDirection, includeCurrentCanvas: boolean) => {
      const selected = getOrderedSelectedItems()
      const urls = selected.map((item) => item.dataUrl)

      if (includeCurrentCanvas) {
        const current = exportCanvasSnapshot()
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
        applyBaseImage(merged, { resetAnnotations: true, addToHistory: true })
        setSelectedCaptureIds(new Set())
        toast.success(includeCurrentCanvas ? '已拼接到画布' : '拼接完成')
      } catch (e) {
        toast.error(String(e))
      } finally {
        setStitching(false)
      }
    },
    [applyBaseImage, exportCanvasSnapshot, getOrderedSelectedItems],
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

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return { x: 0, y: 0 }
    }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const commitTextEditor = useCallback(() => {
    if (!textEditor) {
      return
    }
    const text = textEditor.value.replace(/\r\n/g, '\n')
    setTextEditor(null)
    if (!text.trim()) {
      return
    }

    const newShape: TextShape = {
      id: `shape-${Date.now()}`,
      tool: 'text',
      style: { ...style },
      startX: textEditor.canvasX,
      startY: textEditor.canvasY,
      endX: textEditor.canvasX,
      endY: textEditor.canvasY,
      text,
    }
    const newShapes = [...shapes, newShape]
    setShapes(newShapes)
    saveShapeHistory(newShapes)
  }, [textEditor, shapes, style, saveShapeHistory])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (tool !== 'text' || !imageReady) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const { x, y } = getCanvasCoords(e)
      setTextEditor({ canvasX: x, canvasY: y, value: '' })
    },
    [tool, imageReady, getCanvasCoords],
  )

  const findTextAtPoint = useCallback(
    (x: number, y: number): TextShape | null => {
      const canvas = canvasRef.current
      if (!canvas) {
        return null
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return null
      }
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i]
        if (shape.tool === 'text' && hitTestText(ctx, shape, x, y)) {
          return shape
        }
      }
      return null
    },
    [shapes],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!imageReady) {
        return
      }

      const { x, y } = getCanvasCoords(e)

      if (tool === 'select') {
        const hit = findTextAtPoint(x, y)
        if (hit) {
          setSelectedTextId(hit.id)
          setTextDrag({
            id: hit.id,
            offsetX: x - hit.startX,
            offsetY: y - hit.startY,
          })
        } else {
          setSelectedTextId(null)
        }
        return
      }

      if (tool === 'text') {
        return
      }

      setIsDrawing(true)

      if (tool === 'pencil') {
        const pencilShape: PencilShape = {
          id: `shape-${Date.now()}`,
          tool: 'pencil',
          style: { ...style },
          points: [{ x, y }],
        }
        setCurrentShape(pencilShape)
        return
      }

      const newShape: Shape = {
        id: `shape-${Date.now()}`,
        tool,
        style: { ...style },
        startX: x,
        startY: y,
        endX: x,
        endY: y,
      } as Shape

      setCurrentShape(newShape)
    },
    [tool, style, getCanvasCoords, imageReady, findTextAtPoint],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e)

      if (textDrag) {
        setShapes((prev) =>
          prev.map((shape) => {
            if (shape.id !== textDrag.id || shape.tool !== 'text') {
              return shape
            }
            const nx = x - textDrag.offsetX
            const ny = y - textDrag.offsetY
            return { ...shape, startX: nx, startY: ny, endX: nx, endY: ny }
          }),
        )
        return
      }

      if (!isDrawing || !currentShape) {
        return
      }

      if (currentShape.tool === 'pencil') {
        setCurrentShape((prev) => {
          if (!prev || prev.tool !== 'pencil') {
            return prev
          }
          const last = prev.points[prev.points.length - 1]
          if (last && Math.hypot(last.x - x, last.y - y) < 1.5) {
            return prev
          }
          return { ...prev, points: [...prev.points, { x, y }] }
        })
        return
      }

      setCurrentShape((prev) => {
        if (!prev || prev.tool === 'pencil') {
          return prev
        }
        return { ...prev, endX: x, endY: y }
      })
    },
    [isDrawing, currentShape, getCanvasCoords, textDrag],
  )

  const finishDrawing = useCallback(() => {
    if (!isDrawing || !currentShape) {
      return
    }

    setIsDrawing(false)
    const newShapes = [...shapes, currentShape]
    setShapes(newShapes)
    saveShapeHistory(newShapes)
    setCurrentShape(null)
  }, [isDrawing, currentShape, shapes, saveShapeHistory])

  const handleMouseUp = useCallback(() => {
    if (textDrag) {
      setTextDrag(null)
      setShapes((current) => {
        saveShapeHistory(current)
        return current
      })
      return
    }
    finishDrawing()
  }, [textDrag, finishDrawing, saveShapeHistory])

  useEffect(() => {
    if (!textDrag) {
      return
    }
    const onWindowMouseUp = (): void => {
      handleMouseUp()
    }
    window.addEventListener('mouseup', onWindowMouseUp)
    return () => window.removeEventListener('mouseup', onWindowMouseUp)
  }, [textDrag, handleMouseUp])

  const handleCopy = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !imageReady || canvas.width < 1) {
      toast.error('没有可复制的图片')
      return
    }

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png')
      })
      if (!blob) {
        throw new Error('生成图片失败')
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast.success('已复制到剪贴板')
    } catch {
      toast.error('复制失败，请检查系统剪贴板权限')
    }
  }, [imageReady])

  const handleDownload = useCallback(() => {
    const dataUrl = exportCanvasSnapshot()
    if (!dataUrl) {
      return
    }

    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `screenshot-${Date.now()}.png`
    link.click()
    toast.success('保存成功')
  }, [exportCanvasSnapshot])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        return
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault()
        undo()
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete') {
        if (selectedTextId) {
          deleteShape(selectedTextId)
          setSelectedTextId(null)
        } else if (shapes.length > 0) {
          const lastShape = shapes[shapes.length - 1]
          deleteShape(lastShape.id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, shapes, deleteShape, selectedTextId])

  const ToolButton = ({
    icon: Icon,
    active,
    onClick,
    title,
    disabled,
  }: {
    icon: React.ComponentType<{ className?: string }>
    active?: boolean
    onClick: () => void
    title: string
    disabled?: boolean
  }) => (
    <Button
      variant={active ? 'default' : 'ghost'}
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )

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

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/50 rounded-md">
          <ToolButton
            icon={MousePointer2}
            active={tool === 'select'}
            onClick={() => setTool('select')}
            title="选择（可拖动文字）"
            disabled={busy}
          />
          <Separator orientation="vertical" className="h-6" />
          <ToolButton
            icon={Square}
            active={tool === 'rect'}
            onClick={() => setTool('rect')}
            title="矩形"
            disabled={busy}
          />
          <ToolButton
            icon={Circle}
            active={tool === 'ellipse'}
            onClick={() => setTool('ellipse')}
            title="椭圆"
            disabled={busy}
          />
          <ToolButton
            icon={ArrowRight}
            active={tool === 'arrow'}
            onClick={() => setTool('arrow')}
            title="箭头"
            disabled={busy}
          />
          <ToolButton
            icon={Type}
            active={tool === 'text'}
            onClick={() => setTool('text')}
            title="文字"
            disabled={busy}
          />
          <ToolButton
            icon={Pencil}
            active={tool === 'pencil'}
            onClick={() => setTool('pencil')}
            title="画笔"
            disabled={busy}
          />
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                'w-5 h-5 rounded border-2 transition-transform hover:scale-110',
                style.strokeColor === color ? 'border-primary' : 'border-transparent',
              )}
              style={{ backgroundColor: color }}
              onClick={() => setStyle({ ...style, strokeColor: color })}
              title={color}
              disabled={busy}
            />
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1">
          <Minus className="h-3 w-3 text-muted-foreground" />
          <input
            type="range"
            min="1"
            max="10"
            value={style.lineWidth}
            onChange={(e) => setStyle({ ...style, lineWidth: Number(e.target.value) })}
            className="w-20"
            disabled={busy}
          />
          <span className="text-xs text-muted-foreground w-4">{style.lineWidth}</span>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1 bg-muted/50 rounded-md">
          <ToolButton icon={Undo2} onClick={undo} title="撤销 (Ctrl+Z)" disabled={busy} />
          <ToolButton icon={Redo2} onClick={redo} title="重做 (Ctrl+Y)" disabled={busy} />
          <ToolButton icon={Trash2} onClick={handleClear} title="清空标注" disabled={busy} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleScreenshot} disabled={busy}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!imageReady || busy}>
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={!imageReady || busy}>
            <Download className="w-4 h-4 mr-1" />
            保存
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div
          ref={containerRef}
          className="relative flex-1 min-h-0 flex items-center justify-center p-4 bg-muted/20 rounded-lg overflow-hidden"
        >
         <div
              className="absolute top-3 left-3 z-10 flex flex-col gap-1 rounded-md border border-border/60 bg-background/90 px-3 py-2 text-[11px] leading-snug text-muted-foreground shadow-sm backdrop-blur-sm pointer-events-none"
              aria-hidden
            >
              <span>
                工具:{' '}
                {
                  {
                    select: '选择',
                    rect: '矩形',
                    ellipse: '椭圆',
                    arrow: '箭头',
                    text: '文字',
                    pencil: '画笔',
                  }[tool]
                }
              </span>
              <span className="inline-flex items-center gap-1.5">
                颜色
                <span
                  className="inline-block h-3 w-3 rounded-sm border border-border/80"
                  style={{ backgroundColor: style.strokeColor }}
                />
                <span className="font-mono text-[10px] opacity-80">{style.strokeColor}</span>
              </span>
              <span>粗细: {style.lineWidth}px</span>
              <span>标注: {shapes.length}</span>
              <span>
                历史: {captureHistory.length}
                {selectedCount > 0 ? ` · 已选 ${selectedCount}` : ''}
              </span>
              {tool === 'select' && (
                <span className="text-[10px] opacity-80">选择模式下可拖动文字</span>
              )}
            </div>

          {screenshot ? (
            <div
              ref={canvasWrapRef}
              className="relative inline-flex max-w-full max-h-full rounded-lg shadow-lg border border-border/50 overflow-visible"
            >
              <canvas
                ref={canvasRef}
                className="block max-w-full max-h-full rounded-lg bg-black/5"
                style={{
                  cursor: textDrag
                    ? 'grabbing'
                    : tool === 'select'
                      ? 'default'
                      : tool === 'text'
                        ? 'text'
                        : 'crosshair',
                }}
                onClick={handleCanvasClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />

              {textEditor &&
                (() => {
                  const pos = getTextEditorDisplayPos(textEditor.canvasX, textEditor.canvasY)
                  if (!pos) {
                    return null
                  }
                  const fontSize = Math.max(14, style.lineWidth * 6)
                  return (
                    <div
                      className="absolute z-20 pointer-events-auto"
                      style={{ left: pos.left, top: pos.top }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <textarea
                        ref={textInputRef}
                        value={textEditor.value}
                        placeholder="输入文字，Shift+Enter 换行"
                        rows={3}
                        autoComplete="off"
                        className="resize-y rounded-md border-2 border-primary outline-none"
                        style={{
                          fontSize: `${fontSize}px`,
                          lineHeight: TEXT_LINE_HEIGHT_RATIO,
                          color: style.strokeColor,
                          caretColor: style.strokeColor,
                        }}
                        onChange={(e) =>
                          setTextEditor((prev) =>
                            prev ? { ...prev, value: e.target.value } : null,
                          )
                        }
                        onKeyDown={(e) => {
                          e.stopPropagation()
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault()
                            commitTextEditor()
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            setTextEditor(null)
                          }
                        }}
                        onBlur={() => {
                          if (textEditorSuppressBlurRef.current) {
                            return
                          }
                          commitTextEditor()
                        }}
                      />
                      <p className="mt-0.5 text-[10px] text-muted-foreground bg-background/90 px-1 rounded">
                        Ctrl+Enter 确认 · Esc 取消
                      </p>
                    </div>
                  )
                })()}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <Camera className="w-16 h-16 opacity-40" />
              <p>点击「截图」按钮获取设备屏幕截图</p>
              <p className="text-xs">支持历史记录多选拼接</p>
            </div>
          )}
        </div>

        <aside className="w-48 shrink-0 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-border shrink-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-medium">历史记录</span>
              <span className="text-xs text-muted-foreground">{captureHistory.length}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              单击多选 · 双击加载
            </p>
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
              disabled={busy || !imageReady || selectedCount < 1}
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
