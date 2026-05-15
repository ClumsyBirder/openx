import { useState } from 'react'
import { Sidebar } from './components/sidebar'
import { Header } from './components/header'
import { DashboardPage } from './pages/dashboard'
import { GlobalVariablesPage } from './pages/global-variables'

function App(): React.JSX.Element {
  const [activeMenu, setActiveMenu] = useState('home')

  const renderContent = () => {
    switch (activeMenu) {
      case 'global-variables':
        return <GlobalVariablesPage />
      case 'home':
      default:
        return <DashboardPage />
    }
  }

  return (
    <div className="h-screen flex bg-card">
      {/* 左侧侧边栏（全高度） */} 
      <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />

      {/* 右侧主内容区 */}
      <div className="flex-1 flex flex-col border-l rounded-l-xl bg-background">
        {/* 标题栏 */}
        <Header />

        {/* 页面内容 */}
        <main className="flex-1 p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default App
