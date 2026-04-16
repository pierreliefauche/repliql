import { PriorityBadge, priorities } from '@/components/PriorityBadge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface PrioritySelectProps {
  priority: number
  onChange: (priority: number) => void
}

export function PrioritySelect({ priority, onChange }: PrioritySelectProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="cursor-pointer outline-none">
        <PriorityBadge priority={priority} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {priorities.map(p => (
          <DropdownMenuItem key={p.value} onSelect={() => onChange(p.value)}>
            <PriorityBadge priority={p.value} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
