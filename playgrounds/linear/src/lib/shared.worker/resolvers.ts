import type { Resolvers } from '@repliql/repliql'
import { getEntityPointer } from '@repliql/utils'

function pointsTo(__typename: string, id: string) {
  return getEntityPointer({ __typename, id })
}

export const resolvers: Resolvers = {
  Query: {
    issue: (_, args: { id: string }, _ctx) => pointsTo('Issue', args.id),

    projects: async (_, args: { first: number; orderBy: string }, ctx) => {
      const projects = await ctx.filterEntityPointers({
        __typename: 'Project',
        orderBy: {
          updatedAt: 'desc',
        },
        limit: args.first,
      })

      return { nodes: projects }
    },

    workflowStates: async (_, args: { filter: { team: { id: { eq: string } } } }, ctx) => {
      const teamId = args.filter.team.id.eq

      const states = await ctx.filterEntityPointers({
        __typename: 'WorkflowState',
        where: {
          team: pointsTo('Team', teamId),
        },
        orderBy: {
          id: 'asc',
        },
      })

      if (!states.length) {
        ctx.markAsStale()
      }

      return { nodes: states }
    },
  },
  Mutation: {
    issueUpdate: async (
      _,
      args: { id: string; input: { stateId?: string; priority?: number } },
      ctx,
    ) => {
      const { id: issueId, input } = args

      const issue = await ctx.patchEntity({
        __typename: 'Issue',
        id: issueId,
        priority: input.priority,
        state: input.stateId ? pointsTo('WorkflowState', input.stateId) : undefined,
      })

      return { success: true, issue }
    },
  },
}
