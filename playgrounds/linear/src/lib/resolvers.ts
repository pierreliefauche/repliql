import { queryToChangeSubscription } from '@repliql/reactive-kysely'
import type { Resolvers } from '@repliql/repliql'
import { getEntityPointer as pointsTo } from '@repliql/utils'

export const resolvers: Resolvers = {
  Query: {
    issue: (_, args: { id: string }, _ctx) => ({
      __typename: 'Issue',
      id: args.id,
    }),

    issues: async (_, args: { first: number; orderBy: string }, ctx) => {
      const q = ctx.db.selectEntityPointersQuery({
        __typename: 'Issue',
        orderBy: {
          updatedAt: 'asc',
        },
        limit: args.first,
      })

      console.log('========== get issues', q.compile(), queryToChangeSubscription(q))

      const issues = await q.execute()
      return { nodes: issues }
    },

    projects: async (_, args: { first: number; orderBy: string }, ctx) => {
      const q = ctx.db.selectEntityPointersQuery({
        __typename: 'Project',
        orderBy: {
          updatedAt: 'asc',
        },
        limit: args.first,
      })

      console.log('========== get projects', q.compile(), queryToChangeSubscription(q))

      const projects = await q.execute()
      return { nodes: projects }
    },

    workflowStates: async (_, args: { filter: { team: { id: { eq: string } } } }, ctx) => {
      const teamId = args.filter.team.id.eq

      const q = ctx.db.selectEntityPointersQuery({
        __typename: 'WorkflowState',
        where: {
          team: pointsTo({ __typename: 'Team', id: teamId }),
        },
        orderBy: {
          id: 'asc',
        },
      })

      console.log('========== get workflow states', q.compile(), queryToChangeSubscription(q))

      const states = await q.execute()
      return { nodes: states }
    },
  },
  Mutation: {},
}
