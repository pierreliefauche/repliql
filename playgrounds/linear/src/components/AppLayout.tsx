import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor } from '@phosphor-icons/react';
import { useTheme } from '@/components/theme-provider';

interface AppLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const themes = ['light', 'dark', 'system'] as const;
const themeIcons = { light: Sun, dark: Moon, system: Monitor };

export function AppLayout({ children, onLogout }: AppLayoutProps) {
  const { theme, setTheme } = useTheme();
  const ThemeIcon = themeIcons[theme];

  const cycleTheme = () => {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
    setTheme(next);
  };

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
  );
}
