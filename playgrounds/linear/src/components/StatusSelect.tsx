import { useQuery } from 'urql'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { WORKFLOW_STATES_QUERY } from '@/lib/queries'

interface State {
  id: string
  name: string
  color: string
}

interface StatusSelectProps {
  teamId: string
  state: State
  onChange: (stateId: string) => void
}

export function StatusSelect({ teamId, state, onChange }: StatusSelectProps) {
  const [{ data }] = useQuery({
    query: WORKFLOW_STATES_QUERY,
    variables: { teamId },
  })

  const states: State[] = data?.workflowStates?.nodes ?? []

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="cursor-pointer outline-none">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: state.color }} />
          <span className="text-sm">{state.name}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {states.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => onChange(s.id)}>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-sm">{s.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
