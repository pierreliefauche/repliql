import { DateTime } from 'luxon'
import { useQuery } from 'urql'
import { Link, Route, useLocation } from 'wouter'

import { IssueDetail } from '@/components/IssueDetail'
import { PriorityBadge } from '@/components/PriorityBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { ISSUES_QUERY } from '@/graphql/queries'

export function IssuesView() {
  const [, navigate] = useLocation()
  const [{ data, fetching, error }] = useQuery({
    query: ISSUES_QUERY,
    variables: { first: 50 },
  })

  console.log('RENDER ISSUES LIST', { fetching, data, error })

  if (error) {
    return (
      <div className="flex items-center justify-center p-12 text-destructive">
        <p>Failed to load issues: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6">
        <h1 className="mb-6 text-lg font-semibold">Issues</h1>

        {fetching && !data ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {data?.issues?.nodes?.map((issue: any) => (
              <Link
                key={issue.id}
                to={`/${issue.id}`}
                className={active =>
                  `flex items-center gap-4 px-4 py-3 transition-colors hover:bg-secondary/50 cursor-pointer ${
                    active ? 'bg-secondary/50' : ''
                  }`
                }
              >
                {issue.state && (
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: issue.state.color }}
                    title={issue.state.name}
                  />
                )}
                <span className="shrink-0 text-xs font-mono text-muted-foreground">
                  {issue.identifier}
                </span>
                <span className="flex-1 truncate text-sm">{issue.title}</span>
                <PriorityBadge priority={issue.priority} />
                {issue.assignee && (
                  <div className="flex items-center gap-1.5">
                    {issue.assignee.avatarUrl ? (
                      <img
                        src={issue.assignee.avatarUrl}
                        alt={issue.assignee.name}
                        className="h-5 w-5 rounded-full"
                      />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-medium text-primary">
                        {issue.assignee.name?.[0]}
                      </div>
                    )}
                  </div>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {DateTime.fromISO(issue.updatedAt).toRelative()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="w-[32rem] shrink-0 overflow-hidden border-l">
        <Route
          path={'/:issueId'}
          component={({ params }) => (
            <IssueDetail issueId={params.issueId} onClose={() => navigate('/')} />
          )}
        />
      </div>
    </div>
  )
}
