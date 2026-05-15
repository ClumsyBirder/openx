import { useState } from 'react'
import {
  Search,
  Smartphone,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Filter,
  Grid3X3,
  List
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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

// 应用类型
interface AppInfo {
  id: string
  name: string
  packageName: string
  version: string
  versionCode: number
  icon: string
  installedTime: string
  updatedTime: string
  size: string
  isSystem: boolean
  isRunning: boolean
}

// 模拟数据
const mockApps: AppInfo[] = [
  { id: '1', name: '微信', packageName: 'com.tencent.mm', version: '8.0.50', versionCode: 1800, icon: '', installedTime: '2024-01-15', updatedTime: '2024-06-20', size: '256.3 MB', isSystem: false, isRunning: true },
  { id: '2', name: '支付宝', packageName: 'com.eg.Android.AlipayF2F', version: '10.3.50', versionCode: 1350, icon: '', installedTime: '2024-02-10', updatedTime: '2024-07-01', size: '128.5 MB', isSystem: false, isRunning: false },
  { id: '3', name: '淘宝', packageName: 'com.taobao.taobao', version: '10.25.0', versionCode: 1025, icon: '', installedTime: '2024-03-05', updatedTime: '2024-06-15', size: '189.2 MB', isSystem: false, isRunning: true },
  { id: '4', name: '京东', packageName: 'com.jingdong.app.mall', version: '12.5.0', versionCode: 1250, icon: '', installedTime: '2024-01-20', updatedTime: '2024-07-10', size: '156.8 MB', isSystem: false, isRunning: false },
  { id: '5', name: '抖音', packageName: 'com.ss.android.ugc.aweme', version: '28.5.0', versionCode: 2850, icon: '', installedTime: '2024-04-12', updatedTime: '2024-07-08', size: '312.6 MB', isSystem: false, isRunning: true },
  { id: '6', name: '设置', packageName: 'com.android.settings', version: '14.0', versionCode: 1400, icon: '', installedTime: '系统内置', updatedTime: '系统内置', size: '45.2 MB', isSystem: true, isRunning: true },
  { id: '7', name: '电话', packageName: 'com.android.dialer', version: '14.0', versionCode: 1400, icon: '', installedTime: '系统内置', updatedTime: '系统内置', size: '12.8 MB', isSystem: true, isRunning: true },
  { id: '8', name: '相机', packageName: 'com.android.camera2', version: '14.0', versionCode: 1400, icon: '', installedTime: '系统内置', updatedTime: '系统内置', size: '28.5 MB', isSystem: true, isRunning: false },
]

export function AppsPage(): React.JSX.Element {
  const [apps] = useState<AppInfo[]>(mockApps)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'user' | 'system'>('all')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  // 筛选应用
  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(search.toLowerCase()) ||
                          app.packageName.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'all' ||
                        (filterType === 'user' && !app.isSystem) ||
                        (filterType === 'system' && app.isSystem)
    return matchesSearch && matchesType
  })

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 mb-4">
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

        <div className="ml-auto flex items-center gap-2">
          {/* 视图切换 */}
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

          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 视图内容 */}
      <div className="flex-1 overflow-auto">
        {filteredApps.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            没有找到应用
          </div>
        ) : viewMode === 'table' ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>应用</TableHead>
                <TableHead>包名</TableHead>
                <TableHead>版本</TableHead>
                <TableHead>大小</TableHead>
                <TableHead>安装时间</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="w-[150px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApps.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-muted-foreground" />
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
                  <TableCell>{app.version}</TableCell>
                  <TableCell>{app.size}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{app.installedTime}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{app.updatedTime}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="启动">
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="停止">
                        <Pause className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="卸载">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          /* 网格视图 */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-1">
            {filteredApps.map((app) => (
              <div
                key={app.id}
                className="bg-card rounded-xl border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer group"
              >
                <div className="flex flex-col items-center text-center">
                  {/* 应用图标 */}
                  <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mb-3">
                    <Smartphone className="w-8 h-8 text-muted-foreground" />
                  </div>
                  
                  {/* 应用名称 */}
                  <div className="mb-1">
                    <span className="font-medium truncate max-w-[120px]">{app.name}</span>
                  </div>
                  
                  {/* 包名 */}
                  <code className="text-[10px] text-muted-foreground truncate max-w-full mb-2">
                    {app.packageName}
                  </code>
                  
                  {/* 版本 */}
                  <div className="text-xs text-muted-foreground mb-3">
                    v{app.version}
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="启动">
                      <Play className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="停止">
                      <Pause className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="卸载">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
