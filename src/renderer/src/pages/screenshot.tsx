import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera, Download, Loader2, RotateCw, MousePointer2,
  Square, Circle, ArrowRight, Type, Pencil, Undo2, Redo2,
  Trash2, Minus
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useDevicesStore } from '../stores/devices'
import { ScrollArea } from '@/components/ui/scroll-area'

/** 绘图工具类型 */
export type DrawTool = 'select' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'pencil'

/** 绘图样式 */
interface DrawStyle {
  strokeColor: string
  fillColor: string
  lineWidth: number
}

/** 基础图形 */
interface BaseShape {
  id: string
  tool: DrawTool
  style: DrawStyle
  startX: number
  startY: number
  endX: number
  endY: number
}

/** 箭头专用 */
interface ArrowShape extends BaseShape {
  tool: 'arrow'
}

/** 文字专用 */
interface TextShape extends BaseShape {
  tool: 'text'
  text: string
}

/** 其他图形 */
interface OtherShape extends BaseShape {
  tool: Exclude<DrawTool, 'arrow' | 'text'>
}

type Shape = ArrowShape | TextShape | OtherShape

const DEFAULT_STYLE: DrawStyle = {
  strokeColor: '#ef4444',
  fillColor: 'transparent',
  lineWidth: 3
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#000000', '#ffffff'
]

export function ScreenshotPage(): React.JSX.Element {
  const selectedId = useDevicesStore((s) => s.selectedId)
  const selectedDevice = useDevicesStore((s) => s.devices.find((d) => d.id === selectedId))

  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tool, setTool] = useState<DrawTool>('select')
  const [style, setStyle] = useState<DrawStyle>(DEFAULT_STYLE)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [history, setHistory] = useState<Shape[][]>([[]])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentShape, setCurrentShape] = useState<Shape | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  /** 截图 */
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
        setScreenshot(dataUrl)
        setShapes([])
        setHistory([[]])
        setHistoryIndex(0)
        toast.success('截图成功')
      } else {
        toast.error(result.error || '截图失败')
      }
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  /** 加载图片到Canvas */
  useEffect(() => {
    if (!screenshot) {
      imageRef.current = null
      return
    }

    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      setImageLoaded(true)
    }
    img.src = screenshot
  }, [screenshot])

  /** 绘制画布 */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 绘制图片
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0)
    }

    // 绘制所有图形
    const allShapes = currentShape ? [...shapes, currentShape] : shapes
    allShapes.forEach((shape) => drawShape(ctx, shape))

    // 绘制橡皮筋
    if (isDrawing && currentShape) {
      ctx.setLineDash([5, 5])
      drawShape(ctx, currentShape)
      ctx.setLineDash([])
    }
  }, [screenshot, shapes, currentShape, isDrawing, imageLoaded])

  /** 绘制单个图形 */
  function drawShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
    ctx.strokeStyle = shape.style.strokeColor
    ctx.fillStyle = shape.style.fillColor
    ctx.lineWidth = shape.style.lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const { startX, startY, endX, endY } = shape

    switch (shape.tool) {
      case 'rect':
        ctx.strokeRect(startX, startY, endX - startX, endY - startY)
        break

      case 'ellipse': {
        const cx = (startX + endX) / 2
        const cy = (startY + endY) / 2
        const rx = Math.abs(endX - startX) / 2
        const ry = Math.abs(endY - startY) / 2
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
        break
      }

      case 'arrow':
        drawArrow(ctx, startX, startY, endX, endY)
        break

      case 'pencil':
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()
        break

      case 'text':
        ctx.font = `${shape.style.lineWidth * 6}px sans-serif`
        ctx.fillStyle = shape.style.strokeColor
        ctx.fillText(shape.text || '文字', startX, startY)
        break
    }
  }

  /** 绘制箭头 */
  function drawArrow(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): void {
    const headLen = 15
    const angle = Math.atan2(toY - fromY, toX - fromX)

    // 主线
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.stroke()

    // 箭头头部
    ctx.beginPath()
    ctx.moveTo(toX, toY)
    ctx.lineTo(
      toX - headLen * Math.cos(angle - Math.PI / 6),
      toY - headLen * Math.sin(angle - Math.PI / 6)
    )
    ctx.moveTo(toX, toY)
    ctx.lineTo(
      toX - headLen * Math.cos(angle + Math.PI / 6),
      toY - headLen * Math.sin(angle + Math.PI / 6)
    )
    ctx.stroke()
  }

  /** 调整Canvas尺寸 */
  const adjustCanvasSize = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const img = imageRef.current
    if (!canvas || !container || !img) return

    const containerRect = container.getBoundingClientRect()
    const padding = 32

    const maxWidth = containerRect.width - padding * 2
    const maxHeight = containerRect.height - padding * 2

    const imgRatio = img.width / img.height
    const containerRatio = maxWidth / maxHeight

    let drawWidth: number
    let drawHeight: number

    if (imgRatio > containerRatio) {
      drawWidth = Math.min(maxWidth, img.width)
      drawHeight = drawWidth / imgRatio
    } else {
      drawHeight = Math.min(maxHeight, img.height)
      drawWidth = drawHeight * imgRatio
    }

    canvas.width = drawWidth
    canvas.height = drawHeight
  }, [])

  useEffect(() => {
    if (imageLoaded) {
      adjustCanvasSize()
    }
  }, [imageLoaded, adjustCanvasSize])

  /** 保存历史 */
  const saveHistory = useCallback((newShapes: Shape[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newShapes)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex])

  /** 撤销 */
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setShapes(history[historyIndex - 1])
    }
  }, [historyIndex, history])

  /** 重做 */
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setShapes(history[historyIndex + 1])
    }
  }, [historyIndex, history])

  /** 清空 */
  const handleClear = useCallback(() => {
    setShapes([])
    saveHistory([])
  }, [saveHistory])

  /** 删除选中的图形 */
  const deleteShape = useCallback((id: string) => {
    const newShapes = shapes.filter((s) => s.id !== id)
    setShapes(newShapes)
    saveHistory(newShapes)
  }, [shapes, saveHistory])

  /** 获取Canvas坐标 */
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }, [])

  /** 鼠标按下 */
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'select') return

    const { x, y } = getCanvasCoords(e)
    setIsDrawing(true)

    const newShape: Shape = {
      id: `shape-${Date.now()}`,
      tool,
      style: { ...style },
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      ...(tool === 'text' ? { text: '文字' } : {})
    } as Shape

    setCurrentShape(newShape)
  }, [tool, style, getCanvasCoords])

  /** 鼠标移动 */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentShape) return

    const { x, y } = getCanvasCoords(e)
    setCurrentShape((prev) => prev ? { ...prev, endX: x, endY: y } : null)
  }, [isDrawing, currentShape, getCanvasCoords])

  /** 鼠标释放 */
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentShape) return

    setIsDrawing(false)
    const newShapes = [...shapes, currentShape]
    setShapes(newShapes)
    saveHistory(newShapes)
    setCurrentShape(null)
  }, [isDrawing, currentShape, shapes, saveHistory])

  /** 下载 */
  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !screenshot) return

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `screenshot-${Date.now()}.png`
    link.click()
    toast.success('保存成功')
  }, [screenshot])

  /** 键盘快捷键 */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault()
        undo()
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete' && shapes.length > 0) {
        const lastShape = shapes[shapes.length - 1]
        deleteShape(lastShape.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, shapes, deleteShape])

  /** 工具栏按钮 */
  const ToolButton = ({
    icon: Icon,
    active,
    onClick,
    title
  }: {
    icon: React.ComponentType<{ className?: string }>
    active?: boolean
    onClick: () => void
    title: string
  }) => (
    <Button
      variant={active ? 'default' : 'ghost'}
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      title={title}
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

  return (
    <div className="flex flex-col h-full">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
        {/* 绘图工具 */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1">
          <ToolButton icon={MousePointer2} active={tool === 'select'} onClick={() => setTool('select')} title="选择" />
          <Separator orientation="vertical" className="h-6" />
          <ToolButton icon={Square} active={tool === 'rect'} onClick={() => setTool('rect')} title="矩形" />
          <ToolButton icon={Circle} active={tool === 'ellipse'} onClick={() => setTool('ellipse')} title="椭圆" />
          <ToolButton icon={ArrowRight} active={tool === 'arrow'} onClick={() => setTool('arrow')} title="箭头" />
          <ToolButton icon={Type} active={tool === 'text'} onClick={() => setTool('text')} title="文字" />
          <ToolButton icon={Pencil} active={tool === 'pencil'} onClick={() => setTool('pencil')} title="画笔" />
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* 颜色选择 */}
        <div className="flex items-center gap-1">
          {COLORS.map((color) => (
            <button
              key={color}
              className={`w-5 h-5 rounded border-2 transition-transform hover:scale-110 ${
                style.strokeColor === color ? 'border-primary' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setStyle({ ...style, strokeColor: color })}
              title={color}
            />
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* 线条粗细 */}
        <div className="flex items-center gap-1">
          <Minus className="h-3 w-3 text-muted-foreground" />
          <input
            type="range"
            min="1"
            max="10"
            value={style.lineWidth}
            onChange={(e) => setStyle({ ...style, lineWidth: Number(e.target.value) })}
            className="w-20"
          />
          <span className="text-xs text-muted-foreground w-4">{style.lineWidth}</span>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* 撤销/重做 */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1">
          <ToolButton icon={Undo2} onClick={undo} title="撤销 (Ctrl+Z)" />
          <ToolButton icon={Redo2} onClick={redo} title="重做 (Ctrl+Y)" />
          <ToolButton icon={Trash2} onClick={handleClear} title="清空" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {selectedDevice && (
            <span className="text-sm text-muted-foreground">{selectedDevice.displayName}</span>
          )}
          <Button variant="outline" size="sm" onClick={handleScreenshot} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Camera className="w-4 h-4 mr-2" />
            )}
            截图
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={!screenshot}>
            <Download className="w-4 h-4 mr-2" />
            保存
          </Button>
        </div>
      </div>

      {/* 画布区域 */}
      <ScrollArea className="flex-1 min-h-0 h-full">
        <div
          ref={containerRef}
          className="flex items-center justify-center h-full min-h-[400px] bg-muted/20 rounded-lg"
        >
          {screenshot ? (
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full rounded-lg shadow-lg cursor-crosshair"
                style={{
                  cursor: tool === 'select' ? 'default' : 'crosshair',
                  aspectRatio: imageRef.current ? `${imageRef.current.width}/${imageRef.current.height}` : undefined
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <Camera className="w-16 h-16" />
              <p>点击「截图」按钮获取设备屏幕截图</p>
              <p className="text-xs">支持矩形、椭圆、箭头、文字、画笔等标注</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 底部状态栏 */}
      {screenshot && (
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground shrink-0">
          <span>工具: {
            {
              select: '选择',
              rect: '矩形',
              ellipse: '椭圆',
              arrow: '箭头',
              text: '文字',
              pencil: '画笔'
            }[tool]
          }</span>
          <Separator orientation="vertical" className="h-3" />
          <span>颜色: {style.strokeColor}</span>
          <Separator orientation="vertical" className="h-3" />
          <span>粗细: {style.lineWidth}px</span>
          <Separator orientation="vertical" className="h-3" />
          <span>图形: {shapes.length}</span>
        </div>
      )}
    </div>
  )
}
