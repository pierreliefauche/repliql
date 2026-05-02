import { ReactiveKyselyProvider } from '@repliql/reactive-kysely/react'
import { useState, useMemo } from 'react'
import { Provider as UrqlProvider } from 'urql'
import { Route, Switch, Redirect } from 'wouter'

import { AppLayout } from '@/components/AppLayout'
import { IssuesView } from '@/components/IssuesView'
import { ProjectsView } from '@/components/ProjectsView'
import { TokenScreen } from '@/components/TokenScreen'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ConduitDemo } from '@/conduit-demo/ConduitDemo'
import { createLinearClient, getApiToken, setApiToken, clearApiToken } from '@/lib/urql'

import { kysely } from './lib/kysely'

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
    <ReactiveKyselyProvider value={kysely}>
      <UrqlProvider value={client}>
        <TooltipProvider>
          <Sonner />
          <AppLayout onLogout={handleLogout}>
            <Switch>
              <Route path="/conduit" component={ConduitDemo} />
              <Route path="/issues" component={IssuesView} nest />
              <Route path="/projects" component={ProjectsView} nest />
              <Route path="/" component={() => <Redirect to="/issues" />} />
              <Route component={() => <Redirect to="/" />} />
            </Switch>
          </AppLayout>
        </TooltipProvider>
      </UrqlProvider>
    </ReactiveKyselyProvider>
  )
}

export default App
