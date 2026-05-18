import { ThemeProvider } from 'next-themes'
import './App.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { MirrorWindowPage } from './pages/mirror-window'

const isMirrorWindow = new URLSearchParams(location.search).get('view') === 'mirror'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {isMirrorWindow ? <MirrorWindowPage /> : <App />}
    </ThemeProvider>
  </StrictMode>
)
