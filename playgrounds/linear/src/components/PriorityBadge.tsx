import { Badge } from '@/components/ui/badge'

export const priorities = [
  { value: 0, label: 'No priority' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
]

const priorityLabels: Record<number, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
}

const priorityColors: Record<number, string> = {
  0: 'bg-muted text-muted-foreground',
  1: 'bg-red-500/15 text-red-600 dark:text-red-400',
  2: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  3: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  4: 'bg-muted text-muted-foreground',
}

export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <Badge variant="secondary" className={`text-xs ${priorityColors[priority] ?? ''}`}>
      {priorityLabels[priority] ?? 'Unknown'}
    </Badge>
  )
}
