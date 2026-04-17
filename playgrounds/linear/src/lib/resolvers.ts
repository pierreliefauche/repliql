import type { Resolvers } from '@repliql/repliql'
import { getEntityPointer as pointsTo } from '@repliql/utils'

export const resolvers: Resolvers = {
  Query: {
    issue: (_, args: { id: string }, _ctx) => ({
      __typename: 'Issue',
      id: args.id,
    }),

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
          team: pointsTo({ __typename: 'Team', id: teamId }),
        },
        orderBy: {
          id: 'asc',
        },
      })

      return { nodes: states }
    },
  },
  Mutation: {},
}
