import { useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from './components/sidebar'
import { Header } from './components/header'
import { DashboardPage } from './pages/dashboard'
import { AppsPage } from './pages/apps'
import { ScreenshotPage } from './pages/screenshot'
import { GlobalVariablesPage } from './pages/global-variables'

function App(): React.JSX.Element {
  const [activeMenu, setActiveMenu] = useState('home')

  const renderContent = () => {
    switch (activeMenu) {
      case 'global-variables':
        return <GlobalVariablesPage />
      case 'apps':
        return <AppsPage />
      case 'screenshot':
        return <ScreenshotPage />
      case 'home':
      default:
        return <DashboardPage />
    }
  }

  return (
    <TooltipProvider>
      <div className="h-screen w-screen flex bg-card overflow-hidden text-foreground">
        {/* 左侧侧边栏（全高度） */}
        <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />

        {/* 右侧主内容区 */}
        <div className="flex-1 flex flex-col border border-border/50 rounded-l-xl bg-background shadow-sm overflow-hidden min-w-0">
          {/* 标题栏 */}
          <Header />

          {/* 页面内容 */}
          <main className="flex-1 p-6 overflow-hidden relative flex flex-col">
            {renderContent()}
          </main>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  )
}

export default App
