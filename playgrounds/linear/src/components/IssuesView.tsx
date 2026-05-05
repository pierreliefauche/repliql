import { DateTime } from 'luxon'
import { useState } from 'react'
import { useQuery } from 'urql'
import { Link, Route, useLocation } from 'wouter'

import { IssueDetail } from '@/components/IssueDetail'
import { PriorityBadge } from '@/components/PriorityBadge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ISSUES_QUERY, SEARCH_ISSUES_QUERY } from '@/graphql/queries'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

function IssueItem({ issue }: { issue: any }) {
  return (
    <Link
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
      <span className="shrink-0 text-xs font-mono text-muted-foreground">{issue.identifier}</span>
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
  )
}

export function IssuesView() {
  const [, navigate] = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 30)

  const isSearching = debouncedSearchTerm.trim().length > 0

  const [{ data: issuesData, fetching: issuesFetching, error: issuesError }] = useQuery({
    query: ISSUES_QUERY,
    variables: { first: 50 },
    pause: isSearching,
  })

  const [{ data: searchData, fetching: searchFetching, error: searchError }] = useQuery({
    query: SEARCH_ISSUES_QUERY,
    variables: { term: debouncedSearchTerm, first: 50 },
    pause: !isSearching,
    requestPolicy: 'cache-only',
  })

  const data = isSearching ? searchData?.searchIssues : issuesData?.issues
  const fetching = isSearching ? searchFetching : issuesFetching
  const error = isSearching ? searchError : issuesError

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
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold">Issues</h1>
          <Input
            type="search"
            placeholder="Search issues..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {fetching && !data ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {data?.nodes?.map((issue: any) => (
              <IssueItem key={issue.id} issue={issue} />
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
