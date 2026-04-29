import { isDedicatedPortMessage, isElectedLeaderMessage } from './protocol'

type DedicatedConduitConfig = {
  onSharedWorkerPort?: (sharedWorkerPort: MessagePort) => void
  onElectedLeader?: (sharedWorkerPort: MessagePort) => void
}

export function conduit(config: DedicatedConduitConfig) {
  const { onSharedWorkerPort, onElectedLeader } = config

  let sharedWorkerPort: MessagePort | null = null

  ;(self as DedicatedWorkerGlobalScope).addEventListener('message', (event: MessageEvent) => {
    if (isDedicatedPortMessage(event.data)) {
      sharedWorkerPort = event.data.port
      onSharedWorkerPort?.(event.data.port)

      if (onElectedLeader) {
        sharedWorkerPort.addEventListener('message', ({ data }) => {
          if (isElectedLeaderMessage(data) && sharedWorkerPort) {
            onElectedLeader(sharedWorkerPort)
          }
        })
      }

      sharedWorkerPort.start()
    }
  })
}
