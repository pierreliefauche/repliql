import { LoggerConfig, makeLogger } from '@repliql/utils'

import { isDedicatedPortMessage, isElectedLeaderMessage } from './protocol'

type DedicatedConduitConfig = {
  onSharedWorkerPort?: (sharedWorkerPort: MessagePort) => void
  onElectedLeader?: (sharedWorkerPort: MessagePort) => void
  logger?: LoggerConfig
}

export function conduit(config: DedicatedConduitConfig) {
  const { onSharedWorkerPort, onElectedLeader, logger: loggerConfig } = config

  const log = makeLogger({ ...loggerConfig, prefix: `[Conduit] [dedicated]` })
  let sharedWorkerPort: MessagePort | null = null

  ;(self as DedicatedWorkerGlobalScope).addEventListener('message', (event: MessageEvent) => {
    if (isDedicatedPortMessage(event.data)) {
      log.debug('Receiving shared channel port', event.data)

      sharedWorkerPort = event.data.port
      onSharedWorkerPort?.(event.data.port)

      sharedWorkerPort.addEventListener('message', ({ data }) => {
        if (isElectedLeaderMessage(data) && sharedWorkerPort) {
          log.debug('Have been elected leader')
          onElectedLeader?.(sharedWorkerPort)
        }
      })

      sharedWorkerPort.start()
    }
  })
}
