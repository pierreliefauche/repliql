import { useQuery } from 'urql';
import { ISSUE_DETAIL_QUERY } from '@/lib/queries';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';

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

interface IssueDetailSheetProps {
  issueId: string | null;
  onClose: () => void;
}

export function IssueDetailSheet({ issueId, onClose }: IssueDetailSheetProps) {
  const [{ data, fetching }] = useQuery({
    query: ISSUE_DETAIL_QUERY,
    variables: { id: issueId! },
    pause: !issueId,
  });

  const issue = data?.issue;

  return (
    <Sheet open={!!issueId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          {fetching ? (
            <>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-full" />
            </>
          ) : issue ? (
            <>
              <SheetDescription className="font-mono text-xs">
                {issue.identifier}
              </SheetDescription>
              <SheetTitle className="text-base">{issue.title}</SheetTitle>
            </>
          ) : (
            <SheetTitle>Issue not found</SheetTitle>
          )}
        </SheetHeader>

        {fetching ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : issue ? (
          <div className="mt-6 space-y-5">
            {/* Status & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: issue.state?.color }}
                  />
                  <span className="text-sm">{issue.state?.name}</span>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Priority</p>
                <Badge variant="secondary" className={`text-xs ${priorityColors[issue.priority] || ''}`}>
                  {priorityLabels[issue.priority] || 'Unknown'}
                </Badge>
              </div>
            </div>

            {/* Assignee */}
            {issue.assignee && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Assignee</p>
                <div className="flex items-center gap-2">
                  {issue.assignee.avatarUrl ? (
                    <img src={issue.assignee.avatarUrl} alt={issue.assignee.name} className="h-5 w-5 rounded-full" />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-medium text-primary">
                      {issue.assignee.name?.[0]}
                    </div>
                  )}
                  <span className="text-sm">{issue.assignee.name}</span>
                </div>
              </div>
            )}

            {/* Project */}
            {issue.project && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Project</p>
                <span className="text-sm">{issue.project.name}</span>
              </div>
            )}

            {/* Labels */}
            {issue.labels?.nodes?.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Labels</p>
                <div className="flex flex-wrap gap-1.5">
                  {issue.labels.nodes.map((label: any) => (
                    <Badge
                      key={label.id}
                      variant="outline"
                      className="text-xs"
                      style={{ borderColor: label.color, color: label.color }}
                    >
                      {label.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Estimate */}
            {issue.estimate != null && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Estimate</p>
                <span className="text-sm">{issue.estimate} pts</span>
              </div>
            )}

            {/* Description */}
            {issue.description && (
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Description</p>
                <div className="rounded-md border bg-secondary/30 p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {issue.description}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4 border-t pt-4 text-xs text-muted-foreground">
              <div>
                <p className="mb-0.5">Created</p>
                <p>{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</p>
              </div>
              <div>
                <p className="mb-0.5">Updated</p>
                <p>{formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}</p>
              </div>
            </div>

            {/* Link to Linear */}
            {issue.url && (
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                Open in Linear <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
