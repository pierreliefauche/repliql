import { useState, useMemo } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Provider as UrqlProvider } from 'urql'

import { AppLayout } from '@/components/AppLayout'
import { IssuesView } from '@/components/IssuesView'
import { ProjectsView } from '@/components/ProjectsView'
import { TokenScreen } from '@/components/TokenScreen'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createLinearClient, getApiToken, setApiToken, clearApiToken } from '@/lib/urql'

import NotFound from './pages/NotFound'

const App = () => {
  const [token, setToken] = useState<string | null>(getApiToken)

  const client = useMemo(() => {
    if (!token) return null
    return createLinearClient(token)
  }, [token])

  const handleConnect = (newToken: string) => {
    setApiToken(newToken)
    setToken(newToken)
  }

  const handleLogout = () => {
    clearApiToken()
    setToken(null)
  }

  if (!client || !token) {
    return (
      <>
        <Sonner />
        <TokenScreen onSubmit={handleConnect} />
      </>
    )
  }

  return (
    <UrqlProvider value={client}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AppLayout onLogout={handleLogout}>
            <Routes>
              <Route path="/" element={<IssuesView />} />
              <Route path="/projects" element={<ProjectsView />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </UrqlProvider>
  )
}

export default App
