import { useState } from 'react';
import { useQuery } from 'urql';
import { ISSUES_QUERY } from '@/lib/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { IssueDetail } from '@/components/IssueDetail';
import { DateTime } from 'luxon';

const priorityLabels: Record<number, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
};

const priorityColors: Record<number, string> = {
  0: 'bg-muted text-muted-foreground',
  1: 'bg-destructive/20 text-destructive',
  2: 'bg-status-in-progress/20 text-status-in-progress',
  3: 'bg-primary/20 text-primary',
  4: 'bg-muted text-muted-foreground',
};

export function IssuesView() {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [{ data, fetching, error }] = useQuery({
    query: ISSUES_QUERY,
    variables: { first: 50 },
  });

  if (error) {
    return (
      <div className="flex items-center justify-center p-12 text-destructive">
        <p>Failed to load issues: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6">
        <h1 className="mb-6 text-lg font-semibold">Issues</h1>

        {fetching ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {data?.issues?.nodes?.map((issue: any) => (
              <div
                key={issue.id}
                className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-secondary/50 cursor-pointer ${
                  selectedIssueId === issue.id ? 'bg-secondary/50' : ''
                }`}
                onClick={() => setSelectedIssueId(issue.id)}
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
                <Badge
                  variant="secondary"
                  className={`text-xs ${priorityColors[issue.priority] || ''}`}
                >
                  {priorityLabels[issue.priority] || 'Unknown'}
                </Badge>
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
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="w-[32rem] shrink-0 overflow-hidden border-l">
        {selectedIssueId && (
          <IssueDetail issueId={selectedIssueId} onClose={() => setSelectedIssueId(null)} />
        )}
      </div>
    </div>
  );
}
