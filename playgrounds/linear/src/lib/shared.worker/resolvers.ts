import type { Resolvers } from '@repliql/repliql'
import { getEntityPointer } from '@repliql/utils'

function pointsTo(__typename: string, id: string) {
  return getEntityPointer({ __typename, id })
}

export const resolvers: Resolvers = {
  Query: {
    issue: (_, args: { id: string }, _ctx) => pointsTo('Issue', args.id),

    // issues: async (_, args: { first: number; orderBy: string }, ctx) => {
    //   const issues = await ctx.filterEntityPointers({
    //     __typename: 'Issue',
    //     orderBy: {
    //       updatedAt: 'desc',
    //     },
    //     limit: args.first,
    //   })

    //   return { nodes: issues }
    // },

    searchIssues: async (_, args: { term: string; first?: number }, ctx) => {
      const pointers = await ctx.filterEntityPointers({
        __typename: 'Issue',
        fullTextSearch: args.term,
        limit: args.first,
      })

      const refs = pointers.map(p => p.__ref)
      const issuesOrErrors = await ctx.entityByRef.loadMany(refs)

      const issues = issuesOrErrors.filter(i => i && '__typename' in i)

      // Cheat by swapping typename
      return { nodes: issues.map(entity => ({ ...entity, __typename: 'IssueSearchResult' })) }
    },

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
      args: {
        id: string
        input: { stateId?: string; priority?: number; title?: string; description?: string }
      },
      ctx,
    ) => {
      const { id: issueId, input } = args

      const issue = await ctx.patchEntity({
        __typename: 'Issue',
        id: issueId,
        priority: input.priority,
        state: input.stateId ? pointsTo('WorkflowState', input.stateId) : undefined,
        title: input.title,
        description: input.description,
      })

      return { success: true, issue }
    },
  },
}
