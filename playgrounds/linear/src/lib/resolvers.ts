import { queryToChangeSubscription } from '@repliql/reactive-kysely'
import type { Resolvers } from '@repliql/repliql'
import { getEntityPointer as pointsTo } from '@repliql/utils'

export const resolvers: Resolvers = {
  Query: {
    issue: (_, args: { id: string }, _ctx) => ({
      __typename: 'Issue',
      id: args.id,
    }),
    workflowStates: async (_, args: { filter: { team: { id: { eq: string } } } }, ctx) => {
      const teamId = args.filter.team.id.eq

      const q = ctx.db.getEntitiesPointersQuery({
        __typename: 'WorkflowState',
        where: {
          team: pointsTo({ __typename: 'Team', id: teamId }),
        },
      })

      console.log('========== get workflow states', q.compile(), queryToChangeSubscription(q))

      const states = await q.execute()
      return { nodes: states }
    },
  },
  Mutation: {},
}
