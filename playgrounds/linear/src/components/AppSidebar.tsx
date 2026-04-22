import { CircleIcon, KanbanIcon, SignOutIcon } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { Link, useLocation } from 'wouter'

import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

import { useLiveSelect } from '../lib/kysely'

interface AppSidebarProps {
  onLogout: () => void
}

export function AppSidebar({ onLogout }: AppSidebarProps) {
  const { state } = useSidebar()
  const [currentPath] = useLocation()
  const collapsed = state === 'collapsed'

  const result = useLiveSelect(db => {
    return db
      .selectFrom('entities')
      .where('__typename', '=', 'Issue')
      .where(eb => eb.ref('data', '->>').key('priority'), '=', 1 /* URGENT */)
      .select(eb => eb.fn.countAll().as('count'))
  })

  const urgentIssuesCount = result?.[0].count

  const navItems = useMemo(
    () => [
      {
        title: `Issues${urgentIssuesCount ? ` - ${urgentIssuesCount} urgent!` : ''}`,
        url: '/issues',
        icon: CircleIcon,
      },
      { title: 'Projects', url: '/projects', icon: KanbanIcon },
    ],
    [urgentIssuesCount],
  )

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            {!collapsed && 'Workspace'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      to={item.url}
                      className={cn(
                        'hover:bg-sidebar-accent/50',
                        currentPath.startsWith(item.url) &&
                          'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <SignOutIcon className="h-4 w-4" />
          {!collapsed && <span className="leading-none">Disconnect</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
