import { useQuery } from 'urql'

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { PROJECTS_QUERY } from '@/lib/queries'

export function ProjectsView() {
  const [{ data, fetching, error }] = useQuery({
    query: PROJECTS_QUERY,
    variables: { first: 50 },
  })

  if (error) {
    return (
      <div className="flex items-center justify-center p-12 text-destructive">
        <p>Failed to load projects: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-lg font-semibold">Projects</h1>

      {fetching ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.projects?.nodes?.map((project: any) => (
            <div
              key={project.id}
              className="rounded-lg border bg-card p-5 transition-colors hover:bg-secondary/30"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="font-medium text-sm leading-tight">{project.name}</h3>
                <Badge variant="outline" className="shrink-0 text-xs capitalize">
                  {project.state?.replace('_', ' ') || 'Unknown'}
                </Badge>
              </div>

              {project.description && (
                <p className="mb-3 text-xs text-muted-foreground line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round((project.progress || 0) * 100)}%</span>
              </div>
              <Progress value={(project.progress || 0) * 100} className="h-1.5" />

              <div className="mt-3 flex items-center gap-2">
                {project.lead && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {project.lead.avatarUrl ? (
                      <img
                        src={project.lead.avatarUrl}
                        alt={project.lead.name}
                        className="h-4 w-4 rounded-full"
                      />
                    ) : (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-[9px] font-medium text-primary">
                        {project.lead.name?.[0]}
                      </div>
                    )}
                    <span>{project.lead.name}</span>
                  </div>
                )}
                {project.teams?.nodes?.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    · {project.teams.nodes.map((t: any) => t.name).join(', ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
