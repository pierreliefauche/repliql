import { SunIcon, MoonIcon, MonitorIcon, type Icon } from '@phosphor-icons/react'

import { AppSidebar } from '@/components/AppSidebar'
import { useTheme, THEME_VALUES, type Theme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

interface AppLayoutProps {
  children: React.ReactNode
  onLogout: () => void
}

const themeIcons: Record<Theme, Icon> = { light: SunIcon, dark: MoonIcon, system: MonitorIcon }

export function AppLayout({ children, onLogout }: AppLayoutProps) {
  const { theme, setTheme } = useTheme()
  const ThemeIcon = themeIcons[theme]

  const cycleTheme = () => {
    const next = THEME_VALUES[(THEME_VALUES.indexOf(theme) + 1) % THEME_VALUES.length]
    setTheme(next)
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar onLogout={onLogout} />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center justify-between border-b border-border px-2">
            <SidebarTrigger />
            <Button variant="ghost" size="icon" onClick={cycleTheme} className="h-8 w-8">
              <ThemeIcon className="h-4 w-4" />
            </Button>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  )
}
