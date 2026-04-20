import { ArrowSquareOutIcon, X } from '@phosphor-icons/react'
import { DateTime } from 'luxon'
import { useQuery, useMutation } from 'urql'

import { PrioritySelect } from '@/components/PrioritySelect'
import { StatusSelect } from '@/components/StatusSelect'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ISSUE_DETAIL_QUERY,
  UPDATE_ISSUE_PRIORITY_MUTATION,
  UPDATE_ISSUE_STATE_MUTATION,
} from '@/graphql/queries'

interface IssueDetailProps {
  issueId: string
  onClose: () => void
}

export function IssueDetail({ issueId, onClose }: IssueDetailProps) {
  const [{ data, fetching }] = useQuery({
    query: ISSUE_DETAIL_QUERY,
    variables: { id: issueId },
    requestPolicy: 'cache-and-network',
  })
  const [, updatePriority] = useMutation(UPDATE_ISSUE_PRIORITY_MUTATION)
  const [, updateState] = useMutation(UPDATE_ISSUE_STATE_MUTATION)

  const issue = data?.issue

  return (
    <div className="flex h-full flex-col border-l">
      <div className="flex items-center justify-between border-b px-4 py-3">
        {fetching ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{issue?.identifier}</span>
        )}
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {fetching ? (
          <div className="space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : issue ? (
          <div className="space-y-5">
            <h2 className="text-sm font-medium leading-snug">{issue.title}</h2>

            {/* Status & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Status</p>
                {issue.state && issue.team && (
                  <StatusSelect
                    teamId={issue.team.id}
                    state={issue.state}
                    onChange={stateId => updateState({ id: issue.id, stateId })}
                  />
                )}
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Priority</p>
                <PrioritySelect
                  priority={issue.priority}
                  onChange={priority => updatePriority({ id: issue.id, priority })}
                />
              </div>
            </div>

            {/* Assignee */}
            {issue.assignee && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Assignee</p>
                <div className="flex items-center gap-2">
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
                <div className="max-h-64 overflow-y-auto rounded-md border bg-secondary/30 p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {issue.description}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4 border-t pt-4 text-xs text-muted-foreground">
              <div>
                <p className="mb-0.5">Created</p>
                <p>{DateTime.fromISO(issue.createdAt).toRelative()}</p>
              </div>
              <div>
                <p className="mb-0.5">Updated</p>
                <p>{DateTime.fromISO(issue.updatedAt).toRelative()}</p>
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
                Open in Linear <ArrowSquareOutIcon className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
