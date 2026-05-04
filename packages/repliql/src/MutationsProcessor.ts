import { parse } from '@0no-co/graphql.web'
import {
  Client,
  createRequest,
  getOperationName,
  makeOperation,
  type Operation,
  type OperationResult,
  stringifyDocument,
} from '@urql/core'

import type { Database, Mutation } from './database'

type MutationProcessorConfig = {
  db: Database
  client: Pick<Client, 'reexecuteOperation'>
}

export class MutationsProcessor {
  private db: Database
  private client: Pick<Client, 'reexecuteOperation'>

  private mutationOperations = new Map<string, Operation>()
  private mutationResultResolves = new Map<string, (result: OperationResult) => void>()

  private startPromise: Promise<void> | undefined
  private cyclePromise: Promise<void> | undefined
  private queuedCycle = false

  constructor({ db, client }: MutationProcessorConfig) {
    this.db = db
    this.client = client
  }

  private makeMutationOperation(mutation: Mutation): Operation {
    const originalOperation = this.mutationOperations.get(mutation.id)

    const operation = makeOperation(
      'mutation',
      originalOperation || createRequest(parse(mutation.query), mutation.variables),
      {
        ...mutation.context,
        ...originalOperation?.context,
        _instance: undefined, // discard instance id to avoid collisions
        operationId: mutation.id,
        repliqlReplay: true,
        requestPolicy: 'network-only',
      },
    )

    return operation
  }

  public onMutationResult(result: OperationResult) {
    const mutationId = result.operation.context.operationId
    if (!mutationId) {
      return
    }

    if (result.operation.context.repliqlReplay) {
      this.mutationResultResolves.get(result.operation.context.operationId)?.(result)
      this.mutationResultResolves.delete(result.operation.context.operationId)
    }
  }

  public start(): Promise<void> {
    if (!this.startPromise) {
      this.startPromise = (async () => {
        await this.db.requeueInflightMutations()
        await this.db.cleanEntityBases()
        await this.db.reapplyAllMutationPatches()
      })()

      this.startPromise.then(() => this.runCycle())
    }

    return this.startPromise
  }

  public async initMutation(operation: Operation): Promise<Mutation | null> {
    if (operation.kind !== 'mutation') {
      return null
    }

    const mutation = await this.db.insertMutation({
      id: operation.context.operationId,
      name: getOperationName(operation.query) || null,
      query: stringifyDocument(operation.query),
      variables: operation.variables || {},
      extensions: operation.extensions || {},
      context: operation.context || {},
      status: 'pending',
    })

    this.mutationOperations.set(operation.context.operationId, operation)

    return mutation || null
  }

  async runCycle(): Promise<void> {
    await this.start()

    if (this.cyclePromise) {
      this.queuedCycle = true
      await this.cyclePromise
      return
    }

    this.cyclePromise = (async () => {
      try {
        do {
          this.queuedCycle = false
          await this.loop()
        } while (this.queuedCycle)
      } finally {
        this.cyclePromise = undefined
      }
    })()

    await this.cyclePromise
  }

  private async loop(): Promise<void> {
    while (await this.processOne()) {
      // keep going
    }
  }

  private async processOne(): Promise<boolean> {
    const row = await this.db.claimNextPendingMutation()
    if (!row) {
      return false
    }

    return this.processMutation(row)
  }

  private async processMutation(mutation: Mutation): Promise<boolean> {
    const op = this.makeMutationOperation(mutation)

    const { promise: resultPromise, resolve } = Promise.withResolvers<OperationResult>()
    this.mutationResultResolves.set(mutation.id, resolve)

    this.client.reexecuteOperation(op)

    const result = await resultPromise
    console.log(']]]]]]]]]]]]]]]]]]]] got result', mutation, result)

    if (result.error) {
      if (result.error.networkError) {
        // Network error, we move mutation back to pending
        await this.db.requeueInflightMutation(mutation.id)
        return false
      } else {
        // Other failures, the mutation is marked as failed
        await this.db.resolveMutation({ mutationId: mutation.id, status: 'failed' })
        return true
      }
    } else {
      // Mutation succeeded
      this.mutationOperations.delete(mutation.id)
      await this.db.resolveMutation({ mutationId: mutation.id, status: 'applied' })
      return true
    }
  }
}
